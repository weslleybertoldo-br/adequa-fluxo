import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  findCardsByTitleInPipe,
  findTableRecordsByTitle,
  PIPES_TROCA,
  TABELAS_TROCA,
} from "@/lib/pipefy";

interface MatchedItem {
  kind: "card" | "record";
  containerId: string;
  containerLabel: string;
  itemId: string;
  title: string;
  phaseId: string | null;
  phaseName: string | null;
  url: string | null;
  matchType: "exact" | "partial";
}

async function searchInPipe(
  pipeId: string,
  pipeLabel: string,
  needle: string
): Promise<MatchedItem[]> {
  let matches;
  try {
    matches = await findCardsByTitleInPipe(pipeId, needle);
  } catch (err: any) {
    console.error(
      `[pipefy-preview-troca] findCardsByTitleInPipe falhou em ${pipeLabel}:`,
      err.message
    );
    return [];
  }
  const target = needle.toUpperCase().trim();
  return matches.map((m): MatchedItem => ({
    kind: "card",
    containerId: pipeId,
    containerLabel: pipeLabel,
    itemId: m.cardId,
    title: m.title,
    phaseId: m.phaseId,
    phaseName: m.phaseName,
    url: m.url,
    matchType: m.title.toUpperCase().trim() === target ? "exact" : "partial",
  }));
}

async function searchInTable(
  tableId: string,
  tableLabel: string,
  needle: string
): Promise<MatchedItem[]> {
  let matches;
  try {
    matches = await findTableRecordsByTitle(tableId, needle);
  } catch (err: any) {
    console.error(
      `[pipefy-preview-troca] findTableRecordsByTitle falhou em ${tableLabel}:`,
      err.message
    );
    return [];
  }
  const target = needle.toUpperCase().trim();
  return matches.map((m): MatchedItem => ({
    kind: "record",
    containerId: tableId,
    containerLabel: tableLabel,
    itemId: m.recordId,
    title: m.title,
    phaseId: null,
    phaseName: null,
    url: null,
    matchType: m.title.toUpperCase().trim() === target ? "exact" : "partial",
  }));
}

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const codigoAntigo = (searchParams.get("codigoAntigo") || "").trim();
    const codigoNovo = (searchParams.get("codigoNovo") || "").trim();

    if (!codigoAntigo) {
      return NextResponse.json(
        { error: "codigoAntigo obrigatório" },
        { status: 400 }
      );
    }

    // Pipes + tabelas em paralelo, antigo e (se houver) novo
    const buscas = [
      ...PIPES_TROCA.map((p) => searchInPipe(p.id, p.label, codigoAntigo)),
      ...TABELAS_TROCA.map((t) => searchInTable(t.id, t.label, codigoAntigo)),
    ];
    const buscasNovo = codigoNovo
      ? [
          ...PIPES_TROCA.map((p) => searchInPipe(p.id, p.label, codigoNovo)),
          ...TABELAS_TROCA.map((t) => searchInTable(t.id, t.label, codigoNovo)),
        ]
      : [];

    const [matchesAntigoAll, matchesNovoAll] = await Promise.all([
      Promise.all(buscas).then((arr) => arr.flat()),
      Promise.all(buscasNovo).then((arr) => arr.flat()),
    ]);

    const exatosAntigo = matchesAntigoAll.filter((m) => m.matchType === "exact");
    const parciaisAntigo = matchesAntigoAll.filter((m) => m.matchType === "partial");
    const exatosNovo = matchesNovoAll.filter((m) => m.matchType === "exact");

    let resumo = "";
    if (exatosAntigo.length === 0) {
      resumo = `Nenhum item com "${codigoAntigo}" encontrado nos ${PIPES_TROCA.length} pipes + ${TABELAS_TROCA.length} tabelas monitorados.`;
    } else {
      const porContainer = exatosAntigo.reduce<Record<string, number>>(
        (acc, m) => {
          acc[m.containerLabel] = (acc[m.containerLabel] || 0) + 1;
          return acc;
        },
        {}
      );
      const partes = Object.entries(porContainer).map(
        ([c, n]) => `${c}: ${n}`
      );
      resumo = `${exatosAntigo.length} item(ns) com "${codigoAntigo}" — ${partes.join(", ")}.`;
    }

    if (exatosNovo.length > 0) {
      resumo += ` ⚠ ${exatosNovo.length} item(ns) já existem com "${codigoNovo}" — risco de duplicidade.`;
    }

    return NextResponse.json({
      success: true,
      codigoAntigo,
      codigoNovo,
      resumo,
      // Mantém os nomes antigos (`exatosAntigo` etc) que o frontend já consome,
      // mas com payload expandido (kind: card|record, containerLabel etc).
      exatosAntigo,
      parciaisAntigo,
      exatosNovo,
      pipesPesquisados: PIPES_TROCA,
      tabelasPesquisadas: TABELAS_TROCA,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao consultar Pipefy", status: 500 });
  }
}
