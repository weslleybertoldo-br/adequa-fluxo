import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  updateCardTitle,
  updateCardField,
  setTableRecordFieldValue,
  findCardsByTitleInPipe,
  findTableRecordsByTitle,
  createComment,
  pipefyQuery,
  PIPES_TROCA,
  TABELAS_TROCA,
  FIELD_IMOVEL_ID,
} from "@/lib/pipefy";
import { trocarCodigoStays } from "@/lib/stays";

const PIPE_1_ID = "303781436"; // Pipe 1 — Implantação (onde fica id_da_stays_do_im_vel)
const FIELD_STAYS_ID = "id_da_stays_do_im_vel";

interface TrocaResultado {
  kind: "card" | "record" | "stays";
  itemId: string;
  containerLabel: string;
  phaseName: string | null;
  tituloAntigo: string;
  status: "ok" | "erro";
  erro?: string;
  // Sub-status: atualização do campo "Imóvel" do form (apenas pra cards)
  fieldImovel?: "ok" | "skip" | "erro";
  fieldImovelErro?: string;
  // Sub-status: comentário registrando a troca (apenas pra cards)
  comentario?: "ok" | "skip" | "erro";
  comentarioErro?: string;
  // Sub-status: títulos do _mstitle atualizados (apenas pra Stays)
  staysTitulosCount?: number;
}

async function findExactCardsInPipe(
  pipeId: string,
  pipeLabel: string,
  needle: string
) {
  const matches = await findCardsByTitleInPipe(pipeId, needle);
  const target = needle.toUpperCase().trim();
  return matches
    .filter((m) => m.title.toUpperCase().trim() === target)
    .map((m) => ({
      kind: "card" as const,
      cardId: m.cardId,
      title: m.title,
      phaseName: m.phaseName,
      pipeLabel,
    }));
}

async function findExactRecordsInTable(
  tableId: string,
  tableLabel: string,
  needle: string
) {
  const matches = await findTableRecordsByTitle(tableId, needle);
  const target = needle.toUpperCase().trim();
  return matches
    .filter((m) => m.title.toUpperCase().trim() === target)
    .map((m) => ({
      kind: "record" as const,
      recordId: m.recordId,
      title: m.title,
      tableLabel,
    }));
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const codigoAntigo = String(body.codigoAntigo || "").trim();
    const codigoNovo = String(body.codigoNovo || "").trim();

    if (!codigoAntigo || !codigoNovo) {
      return NextResponse.json(
        { error: "codigoAntigo e codigoNovo são obrigatórios" },
        { status: 400 }
      );
    }
    if (codigoAntigo.toUpperCase() === codigoNovo.toUpperCase()) {
      return NextResponse.json(
        { error: "Código antigo e novo são iguais" },
        { status: 400 }
      );
    }
    if (!/^[A-Za-z0-9._-]+$/.test(codigoNovo)) {
      return NextResponse.json(
        { error: "codigoNovo tem caracteres inválidos" },
        { status: 400 }
      );
    }

    // 1) Buscar matches exatos em paralelo (pipes + tabelas)
    const matchesPipes = await Promise.all(
      PIPES_TROCA.map((p) => findExactCardsInPipe(p.id, p.label, codigoAntigo))
    );
    const matchesTabelas = await Promise.all(
      TABELAS_TROCA.map((t) =>
        findExactRecordsInTable(t.id, t.label, codigoAntigo).then((rows) =>
          rows.map((r) => ({ ...r, titleFieldId: t.titleFieldId }))
        )
      )
    );
    const cardsExatos = matchesPipes.flat();
    const recordsExatos = matchesTabelas.flat();

    if (cardsExatos.length + recordsExatos.length === 0) {
      return NextResponse.json({
        success: true,
        codigoAntigo,
        codigoNovo,
        total: 0,
        sucessos: 0,
        erros: 0,
        resultados: [],
        mensagem: `Nenhum item com "${codigoAntigo}" nos pipes/tabelas monitorados.`,
      });
    }

    const resultados: TrocaResultado[] = [];

    // Pré-leitura: extrair `id_da_stays_do_im_vel` do card do Pipe 1 ANTES de
    // qualquer renomeação. O field só existe no Pipe 1 e não muda com a troca,
    // mas lemos antes pra evitar depender do title novo (e pra ter o valor pronto
    // mesmo se algum updateCardTitle falhar no meio do caminho).
    let staysListingId: string | null = null;
    const cardPipe1 = cardsExatos.find((c) => c.pipeLabel.startsWith("Pipe 1"));
    if (cardPipe1) {
      try {
        const r = await pipefyQuery(`{
          card(id: ${cardPipe1.cardId}) {
            fields { field { id } value }
          }
        }`);
        const fs = (r?.data?.card?.fields || []) as any[];
        const sf = fs.find((f) => f?.field?.id === FIELD_STAYS_ID);
        const v = sf?.value;
        if (typeof v === "string" && v.trim()) {
          staysListingId = v.trim();
        }
      } catch (err) {
        console.error("[pipefy-trocar-titulos] falha lendo id_da_stays_do_im_vel:", err);
      }
    }

    // Template do comentário registrando a troca em cada card
    const COMENTARIO_TEMPLATE = `Imóvel passou por troca de código:\nCódigo Antigo: ${codigoAntigo}\nNovo Código: ${codigoNovo}`;

    // 2) Pra cada card, em sequência: title → field "Imóvel" → comentário
    for (const c of cardsExatos) {
      let titleStatus: "ok" | "erro" = "ok";
      let titleErr: string | undefined;
      try {
        await updateCardTitle(c.cardId, codigoNovo);
      } catch (err: any) {
        titleStatus = "erro";
        titleErr = err?.message || String(err);
      }

      // Atualizar o field "Imóvel" do form (mesmo slug em todos os pipes
      // que têm esse campo). Best-effort: se o pipe não tem o field, falha
      // e ignoramos — não derruba o resultado do title.
      let fieldImovel: "ok" | "skip" | "erro" = "skip";
      let fieldImovelErro: string | undefined;
      if (titleStatus === "ok") {
        try {
          await updateCardField(c.cardId, FIELD_IMOVEL_ID, codigoNovo);
          fieldImovel = "ok";
        } catch (err: any) {
          fieldImovel = "erro";
          fieldImovelErro = err?.message || String(err);
        }
      }

      // Comentário no card registrando a troca
      let comentario: "ok" | "skip" | "erro" = "skip";
      let comentarioErro: string | undefined;
      if (titleStatus === "ok") {
        try {
          await createComment(c.cardId, COMENTARIO_TEMPLATE);
          comentario = "ok";
        } catch (err: any) {
          comentario = "erro";
          comentarioErro = err?.message || String(err);
        }
      }

      resultados.push({
        kind: "card",
        itemId: c.cardId,
        containerLabel: c.pipeLabel,
        phaseName: c.phaseName,
        tituloAntigo: c.title,
        status: titleStatus,
        ...(titleErr ? { erro: titleErr } : {}),
        fieldImovel,
        ...(fieldImovelErro ? { fieldImovelErro } : {}),
        comentario,
        ...(comentarioErro ? { comentarioErro } : {}),
      });
    }

    // 3) Atualizar records (setTableRecordFieldValue no title_field, que sincroniza title)
    for (const r of recordsExatos) {
      try {
        await setTableRecordFieldValue(r.recordId, r.titleFieldId, codigoNovo);
        resultados.push({
          kind: "record",
          itemId: r.recordId,
          containerLabel: r.tableLabel,
          phaseName: null,
          tituloAntigo: r.title,
          status: "ok",
        });
      } catch (err: any) {
        resultados.push({
          kind: "record",
          itemId: r.recordId,
          containerLabel: r.tableLabel,
          phaseName: null,
          tituloAntigo: r.title,
          status: "erro",
          erro: err?.message || String(err),
        });
      }
    }

    // 4) Stays — atualizar internalName + sufixo do _mstitle do listing vinculado
    if (staysListingId) {
      try {
        const r = await trocarCodigoStays(
          staysListingId,
          codigoAntigo,
          codigoNovo
        );
        const titulosCount = Object.keys(r.titulosAtualizados).length;
        if (r.patchEnviado) {
          resultados.push({
            kind: "stays",
            itemId: staysListingId,
            containerLabel: "Stays — listing",
            phaseName: null,
            tituloAntigo: r.internalNameAntigo || codigoAntigo,
            status: "ok",
            staysTitulosCount: titulosCount,
          });
        } else {
          // Drift: o internalName atual da Stays não bate com codigoAntigo e
          // nenhum idioma do _mstitle tem o código → não enviou PATCH.
          resultados.push({
            kind: "stays",
            itemId: staysListingId,
            containerLabel: "Stays — listing",
            phaseName: null,
            tituloAntigo: r.internalNameAntigo || codigoAntigo,
            status: "erro",
            erro: `internalName Stays atual ("${r.internalNameAntigo}") não bate com "${codigoAntigo}"; nenhum título contém o código antigo. PATCH não enviado.`,
            staysTitulosCount: 0,
          });
        }
      } catch (err: any) {
        resultados.push({
          kind: "stays",
          itemId: staysListingId,
          containerLabel: "Stays — listing",
          phaseName: null,
          tituloAntigo: codigoAntigo,
          status: "erro",
          erro: err?.message || String(err),
        });
      }
    }

    const sucessos = resultados.filter((r) => r.status === "ok").length;
    const erros = resultados.filter((r) => r.status === "erro").length;

    return NextResponse.json({
      success: true,
      codigoAntigo,
      codigoNovo,
      total: resultados.length,
      sucessos,
      erros,
      resultados,
      mensagem:
        erros === 0
          ? `${sucessos} item(ns) renomeados de "${codigoAntigo}" para "${codigoNovo}".`
          : `${sucessos} ok / ${erros} com erro — ver detalhes.`,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao trocar títulos", status: 500 });
  }
}
