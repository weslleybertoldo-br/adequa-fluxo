import { errorResponse, errorMessage } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  getSuporteCard,
  getProcesso,
  getNomeUsuario,
  addSuporteComment,
  invokeNotifySlack,
  resolverTemplateBotao,
  SUPORTE_USER_WESLLEY,
  PROCESSO_TROCA_ID,
} from "@/lib/suporte-ops";

// Replica do botao "enviar" do site suporte-ops.seazone.properties:
// resolve o template (`campos_gestao_json[].botao_mensagem`), insere comentario
// no card e invoca a Edge Function `notify-slack` pra postar no thread.
//
// Diferenca pra `suporte-mover-card`: este endpoint NAO faz PATCH no card —
// nao move de fase, nao altera campos. So envia.
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

    if (!cardSuporteId) {
      return NextResponse.json(
        { error: "cardSuporteId obrigatório" },
        { status: 400 }
      );
    }

    const atual = await getSuporteCard(cardSuporteId);
    if (!atual) {
      return NextResponse.json(
        { error: `Card ${cardSuporteId} não encontrado` },
        { status: 404 }
      );
    }

    // Recupera "Status do imóvel" gravado quando o card entrou em Aguardando
    const camposPreenchidos =
      (atual.campos_preenchidos as Record<string, any>) || {};
    const emAndamentoExist =
      (camposPreenchidos.em_andamento as Record<string, any>) || {};
    const statusImovel = String(emAndamentoExist["Status do imóvel"] || "");

    // Monta o template do botao "enviar" igual no suporte-mover-card
    const processo = await getProcesso(PROCESSO_TROCA_ID);
    const camposGestao = (processo?.campos_gestao_json as any[]) || [];
    const enviar = camposGestao.find(
      (c: any) => c?.nome === "enviar" && c?.tipo === "botao"
    );
    const template = String(enviar?.botao_mensagem || "");
    if (!template) {
      return NextResponse.json(
        { error: "Template do botão enviar não encontrado em campos_gestao_json" },
        { status: 500 }
      );
    }

    const nomeResponsavel = await getNomeUsuario(atual.responsavel_id || "");
    const templateProcessado = resolverTemplateBotao(template, {
      "Status do imóvel": statusImovel,
      "Código Antigo": codigoAntigo,
      "Novo Código": codigoNovo,
      responsavel: nomeResponsavel,
    });

    // Insere comentario + notify-slack (best-effort no Slack, igual ao site)
    let slackStatus: "ok" | "erro" = "ok";
    let slackErro: string | undefined;
    let comentarioId: string | undefined;
    try {
      const comentario = await addSuporteComment(
        cardSuporteId,
        SUPORTE_USER_WESLLEY,
        templateProcessado,
        "app"
      );
      comentarioId = comentario?.id;
    } catch (err: unknown) {
      console.error("[suporte-enviar-troca] inserir comentario:", errorMessage(err));
      return NextResponse.json(
        { error: "Falha ao inserir comentário" },
        { status: 502 }
      );
    }

    try {
      await invokeNotifySlack({
        card_id: cardSuporteId,
        action: "add_comment",
        comment_id: comentarioId,
        comment_text: templateProcessado,
        comment_autor: nomeResponsavel || "Sistema",
        comment_via: "app",
      });
    } catch (err: any) {
      console.error("[suporte-enviar-troca] notify-slack falhou:", err);
      slackStatus = "erro";
      slackErro = err?.message || String(err);
    }

    return NextResponse.json({
      success: true,
      cardSuporteId,
      comentarioId,
      slack: { status: slackStatus, erro: slackErro },
      mensagem:
        slackStatus === "ok"
          ? "Comentário enviado e Slack notificado."
          : `Comentário enviado mas Slack falhou: ${slackErro}`,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao enviar", status: 500 });
  }
}
