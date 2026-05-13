import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  findCardsByTitleInPipe,
  findTableRecordsByTitle,
  pipefyQuery,
  PIPES_TROCA,
  TABELAS_TROCA,
} from "@/lib/pipefy";
import { getStaysListing } from "@/lib/stays";

const PIPE_1_ID = "303781436";
const FIELD_STAYS_ID = "id_da_stays_do_im_vel";

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

// Procura card no Pipe 1 com title=needle e devolve o `id_da_stays_do_im_vel`
// (campo único do Pipe 1). Pesquisa antigo e novo pra cobrir os dois estados.
// Pipefy as vezes acha pelo titulo historico (buscar QBA0601 retorna o card
// mesmo apos rename pra SLI0601), entao aceita qualquer card cujo titulo
// atual seja codigoAntigo OU codigoNovo.
async function getStaysIdFromPipe1(
  codigoAntigo: string,
  codigoNovo: string
): Promise<{ staysId: string; tituloMatch: string } | null> {
  const seenCardIds = new Set<string>();
  const titulosValidos = new Set(
    [codigoAntigo, codigoNovo].filter(Boolean).map((c) => c.toUpperCase().trim())
  );
  for (const codigo of [codigoAntigo, codigoNovo].filter(Boolean)) {
    try {
      const matches = await findCardsByTitleInPipe(PIPE_1_ID, codigo);
      const exato = matches.find(
        (m) => titulosValidos.has(m.title.toUpperCase().trim())
      );
      if (!exato || seenCardIds.has(exato.cardId)) continue;
      seenCardIds.add(exato.cardId);
      const r = await pipefyQuery(`{
        card(id: ${exato.cardId}) {
          fields { field { id } value }
        }
      }`);
      const fs = (r?.data?.card?.fields || []) as any[];
      const sf = fs.find((f) => f?.field?.id === FIELD_STAYS_ID);
      const v = sf?.value;
      if (typeof v === "string" && v.trim()) {
        return { staysId: v.trim(), tituloMatch: exato.title };
      }
    } catch {
      // ignora e tenta o próximo
    }
  }
  return null;
}

interface StaysCheckResult {
  listingId: string;
  internalName: string;
  // "antigo" = igual ao codigoAntigo (ainda precisa trocar)
  // "novo"   = igual ao codigoNovo (já foi trocado)
  // "drift"  = nem um nem outro (precisa investigar manualmente)
  internalNameStatus: "antigo" | "novo" | "drift";
  // Quantos idiomas do _mstitle ainda têm o codigoAntigo embutido
  mstitleAntigoCount: number;
  // Quantos idiomas já têm o codigoNovo
  mstitleNovoCount: number;
  // Total de idiomas com texto não-vazio
  mstitleTotal: number;
  // Resumo legível
  resumo: string;
}

async function checkStaysListing(
  listingId: string,
  codigoAntigo: string,
  codigoNovo: string
): Promise<StaysCheckResult> {
  const listing = await getStaysListing(listingId);
  const internalName: string = listing.internalName || "";
  const mstitle: Record<string, string> =
    (listing._mstitle && typeof listing._mstitle === "object"
      ? listing._mstitle
      : {}) as Record<string, string>;

  const upAntigo = codigoAntigo.toUpperCase().trim();
  const upNovo = codigoNovo.toUpperCase().trim();
  const upInt = internalName.toUpperCase().trim();

  let internalNameStatus: "antigo" | "novo" | "drift";
  if (upInt === upAntigo) internalNameStatus = "antigo";
  else if (upInt === upNovo) internalNameStatus = "novo";
  else internalNameStatus = "drift";

  let mstitleTotal = 0;
  let mstitleAntigoCount = 0;
  let mstitleNovoCount = 0;
  for (const v of Object.values(mstitle)) {
    if (typeof v !== "string" || !v) continue;
    mstitleTotal++;
    if (v.includes(codigoAntigo)) mstitleAntigoCount++;
    if (v.includes(codigoNovo)) mstitleNovoCount++;
  }

  let resumo = "";
  if (internalNameStatus === "antigo" && mstitleAntigoCount > 0) {
    resumo = `Pendente trocar: internalName "${internalName}" + ${mstitleAntigoCount} título(s) com "${codigoAntigo}".`;
  } else if (internalNameStatus === "novo" && mstitleNovoCount > 0 && mstitleAntigoCount === 0) {
    resumo = `Já trocado: internalName "${internalName}" + ${mstitleNovoCount} título(s) com "${codigoNovo}".`;
  } else if (internalNameStatus === "novo" && mstitleAntigoCount > 0) {
    resumo = `Parcial: internalName já é "${codigoNovo}", mas ${mstitleAntigoCount} título(s) ainda têm "${codigoAntigo}".`;
  } else if (internalNameStatus === "antigo" && mstitleAntigoCount === 0) {
    resumo = `Parcial: internalName ainda é "${codigoAntigo}", títulos já não têm o código antigo.`;
  } else if (internalNameStatus === "drift") {
    resumo = `Drift: internalName "${internalName}" não bate nem com antigo nem com novo. Investigar manualmente.`;
  } else {
    resumo = `internalName="${internalName}", _mstitle: ${mstitleAntigoCount} antigo(s) / ${mstitleNovoCount} novo(s) / ${mstitleTotal} total.`;
  }

  return {
    listingId,
    internalName,
    internalNameStatus,
    mstitleAntigoCount,
    mstitleNovoCount,
    mstitleTotal,
    resumo,
  };
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

    // Stays — read-only check (best-effort; ignora erros pra não quebrar o
    // preview se a Stays estiver fora do ar)
    let staysCheck: StaysCheckResult | null = null;
    let staysCheckErro: string | null = null;
    if (codigoNovo) {
      try {
        const found = await getStaysIdFromPipe1(codigoAntigo, codigoNovo);
        if (found) {
          staysCheck = await checkStaysListing(
            found.staysId,
            codigoAntigo,
            codigoNovo
          );
        }
      } catch (err: any) {
        staysCheckErro = err?.message || String(err);
        console.error("[pipefy-preview-troca] staysCheck falhou:", staysCheckErro);
      }
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
      staysCheck,
      staysCheckErro,
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao consultar Pipefy", status: 500 });
  }
}
