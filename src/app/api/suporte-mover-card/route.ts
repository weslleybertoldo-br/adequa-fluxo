import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  getSuporteCard,
  updateSuporteCard,
  getProcesso,
  getNomeUsuario,
  addSuporteComment,
  invokeNotifySlack,
  resolverTemplateBotao,
  SUPORTE_USER_WESLLEY,
  PROCESSO_TROCA_ID,
} from "@/lib/suporte-ops";

const SAPRON_API_KEY = "85Rjs5I1QCLQRlWfncYkBbFOeYOn5iXiczeKMfcswao";
const SAPRON_BASE_URL = "https://api.sapron.com.br";

// Deduz "Status do imóvel" via Sapron:
//  - Active   → "Ativo"
//  - Outros   → "Implantação" (imóvel existe na base mas não está ativo)
//  - Ausente  → "" (não preenche)
async function deduzirStatusImovel(
  codigoAntigo: string,
  codigoNovo: string
): Promise<string> {
  try {
    const r = await fetch(`${SAPRON_BASE_URL}/properties/properties_list/`, {
      headers: { "X-SAPRON-API-KEY": SAPRON_API_KEY },
    });
    if (!r.ok) return "";
    const props: Array<{ code: string; status: string }> = await r.json();
    const upAntigo = codigoAntigo.toUpperCase();
    const upNovo = codigoNovo.toUpperCase();
    // Prefere o código novo (estado pós-troca); fallback antigo.
    const match =
      props.find((p) => p.code.toUpperCase() === upNovo) ||
      props.find((p) => p.code.toUpperCase() === upAntigo);
    if (!match) return "";
    if (match.status === "Active") return "Ativo";
    return "Implantação";
  } catch (err) {
    console.error("[suporte-mover-card] sapron falhou:", err);
    return "";
  }
}

interface MoverFlags {
  planilha?: boolean; // Alterado na base de código
  sapron?: boolean; // Alterado no Sapron
  pipefy?: boolean; // Alterado no Pipefy
  stays?: boolean; // Alterado na Stays
  precoMinimo?: "sim" | "nao" | null; // O imóvel tem preço mínimo?
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cardSuporteId = String(body.cardSuporteId || "").trim();
    const codigoAntigo = String(body.codigoAntigo || "").trim();
    const codigoNovo = String(body.codigoNovo || "").trim();
    const flags = (body.flags || {}) as MoverFlags;
    const dryRun = Boolean(body.dryRun);

    if (!cardSuporteId) {
      return NextResponse.json(
        { error: "cardSuporteId obrigatório" },
        { status: 400 }
      );
    }

    // 1) Buscar card atual pra fazer merge no campos_preenchidos
    const atual = await getSuporteCard(cardSuporteId);
    if (!atual) {
      return NextResponse.json(
        { error: `Card ${cardSuporteId} não encontrado no suporte-ops` },
        { status: 404 }
      );
    }

    // 2) Deduzir Status do imóvel via Sapron
    const statusImovel = await deduzirStatusImovel(codigoAntigo, codigoNovo);

    // 3) Montar campos da fase em_andamento
    // O campo "Preço Mínimo" só preenche quando tivermos resposta concreta
    // (sim/não); se "pendente"/null, deixa o existente intacto pra evitar sobrescrita.
    const novoEmAndamento: Record<string, any> = {
      "Status do imóvel": statusImovel,
      "Alterado na base de código": !!flags.planilha,
      "Alterado no Sapron": !!flags.sapron,
      "Alterado no Pipefy": !!flags.pipefy,
      "Alterado na Stays": !!flags.stays,
    };
    if (flags.precoMinimo === "sim") {
      novoEmAndamento["O imóvel tem preço mínimo?"] = "Sim";
    } else if (flags.precoMinimo === "nao") {
      novoEmAndamento["O imóvel tem preço mínimo?"] = "Não";
    }

    const camposPreenchidosAtuais =
      (atual.campos_preenchidos as Record<string, any>) || {};
    const emAndamentoAtual =
      (camposPreenchidosAtuais.em_andamento as Record<string, any>) || {};

    const camposPreenchidosNovos = {
      ...camposPreenchidosAtuais,
      em_andamento: { ...emAndamentoAtual, ...novoEmAndamento },
    };

    // Resumo legível pra mensagem
    const resumoCampos = Object.entries(novoEmAndamento)
      .filter(([k]) => k !== "Status do imóvel")
      .map(([k, v]) => `${k}: ${v === true ? "✓" : v === false ? "—" : v}`)
      .join(", ");

    // 4) Construir mensagem do botão "enviar" (template Slack)
    // O processo da Troca de Código tem `campos_gestao_json` com o item
    // {nome:"enviar", tipo:"botao", botao_mensagem:"..."} — replicamos o que
    // o site faz quando o user clica nesse botão: insere comentário com texto
    // = template processado e invoca Edge Function `notify-slack`.
    let templateProcessado = "";
    let nomeResponsavel = "";
    try {
      const processo = await getProcesso(PROCESSO_TROCA_ID);
      const camposGestao = (processo?.campos_gestao_json as any[]) || [];
      const enviar = camposGestao.find(
        (c: any) => c?.nome === "enviar" && c?.tipo === "botao"
      );
      const template = (enviar?.botao_mensagem as string) || "";
      if (template) {
        nomeResponsavel = await getNomeUsuario(atual.responsavel_id || "");
        templateProcessado = resolverTemplateBotao(template, {
          "Status do imóvel": statusImovel,
          "Código Antigo": codigoAntigo,
          "Novo Código": codigoNovo,
          responsavel: nomeResponsavel,
        });
      }
    } catch (err) {
      console.error("[suporte-mover-card] template do botão enviar falhou:", err);
    }

    // 5) Se dryRun, retorna o que SERIA aplicado sem PATCH/Slack
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        cardSuporteId,
        statusAtual: atual.status,
        statusImovel,
        camposAplicados: novoEmAndamento,
        camposAtuais: emAndamentoAtual,
        novoStatus: "aguardando",
        templateBotaoEnviar: templateProcessado || null,
        mensagem: `Preview — Status: ${statusImovel || "(vazio)"}, ${resumoCampos}.`,
      });
    }

    // 6) PATCH: campos_preenchidos + status="aguardando"
    const updated = await updateSuporteCard(cardSuporteId, {
      campos_preenchidos: camposPreenchidosNovos,
      status: "aguardando",
    } as any);

    // 7) Botão "enviar": insere comentário + invoca notify-slack (best-effort)
    let botaoEnviarStatus: "ok" | "skip" | "erro" = "skip";
    let botaoEnviarErro: string | undefined;
    if (templateProcessado) {
      try {
        const comentario = await addSuporteComment(
          cardSuporteId,
          SUPORTE_USER_WESLLEY,
          templateProcessado,
          "app"
        );
        try {
          await invokeNotifySlack({
            card_id: cardSuporteId,
            action: "add_comment",
            comment_id: comentario?.id,
            comment_text: templateProcessado,
            comment_autor: nomeResponsavel || "Sistema",
            comment_via: "app",
          });
        } catch (err: any) {
          // Se o Slack falhar mas o comentário foi criado, ainda conta como ok-parcial
          console.error("[suporte-mover-card] notify-slack falhou:", err);
          botaoEnviarErro = `Comentário criado mas Slack falhou: ${err?.message || err}`;
          botaoEnviarStatus = "erro";
        }
        if (botaoEnviarStatus !== "erro") botaoEnviarStatus = "ok";
      } catch (err: any) {
        botaoEnviarStatus = "erro";
        botaoEnviarErro = err?.message || String(err);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      cardSuporteId,
      statusImovel,
      camposAplicados: novoEmAndamento,
      novoStatus: "aguardando",
      botaoEnviar: { status: botaoEnviarStatus, erro: botaoEnviarErro },
      mensagem: `Card movido para "Aguardando" — Status: ${statusImovel || "(vazio)"}, ${resumoCampos}. Botão enviar: ${botaoEnviarStatus}.`,
      cardAtualizado: { id: updated?.id, status: updated?.status },
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao mover card", status: 500 });
  }
}
