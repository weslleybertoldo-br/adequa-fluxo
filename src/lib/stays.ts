// ========================
// Cliente da API Stays (PMS Seazone — ssl.stays.com.br)
// ========================
//
// Doc oficial: https://www.stays.net/external-api/
// Auth: Basic base64(login:senha) — credenciais por app no painel da Stays.
// App dedicada pra esta integração: "Integração API Stays + Claude" (29/29 webhooks).

const STAYS_BASE =
  process.env.STAYS_BASE_URL || "https://ssl.stays.com.br/external/v1";

// Login/senha vêm de env. Fallback embutido (credencial específica desse projeto)
// pra caso a Vercel não tenha a env configurada — substituir por env em prod.
const STAYS_LOGIN = process.env.STAYS_API_LOGIN || "0389d7df";
const STAYS_SENHA = process.env.STAYS_API_SENHA || "a514a65d";

function staysAuthHeader(): string {
  const tok = Buffer.from(`${STAYS_LOGIN}:${STAYS_SENHA}`).toString("base64");
  return `Basic ${tok}`;
}

export async function staysFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `${STAYS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = {
    Authorization: staysAuthHeader(),
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStaysListing(listingId: string): Promise<any> {
  const id = encodeURIComponent(listingId);
  const r = await staysFetch(`/content/listings/${id}`);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Stays GET ${listingId} ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// Scan completo de /content/listings via paginação (skip+limit=100, max ~6k).
// Stays API NÃO suporta filtro server-side por internalName/q/code/search — todos
// retornam 400. Único caminho é paginar tudo e filtrar client-side.
// Cache 10min in-memory pra evitar 30 requests por chamada.
const STAYS_SCAN_PAGE = 100;
const STAYS_SCAN_MAX_PAGES = 60;
const STAYS_CACHE_TTL_MS = 10 * 60 * 1000;
type StaysListingLite = { _id: string; id: string; internalName: string };
let staysListingsCache: { at: number; items: StaysListingLite[] } | null = null;

async function scanStaysListings(forceRefresh = false): Promise<StaysListingLite[]> {
  if (
    !forceRefresh &&
    staysListingsCache &&
    Date.now() - staysListingsCache.at < STAYS_CACHE_TTL_MS
  ) {
    return staysListingsCache.items;
  }
  const out: StaysListingLite[] = [];
  for (let page = 0; page < STAYS_SCAN_MAX_PAGES; page++) {
    const skip = page * STAYS_SCAN_PAGE;
    let r: Response;
    try {
      r = await staysFetch(`/content/listings?limit=${STAYS_SCAN_PAGE}&skip=${skip}`);
    } catch {
      break;
    }
    if (!r.ok) break;
    const arr = await r.json().catch(() => null);
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const it of arr as any[]) {
      out.push({
        _id: String(it?._id || ""),
        id: String(it?.id || ""),
        internalName: String(it?.internalName || ""),
      });
    }
    if (arr.length < STAYS_SCAN_PAGE) break;
  }
  staysListingsCache = { at: Date.now(), items: out };
  return out;
}

// Busca listings cujo internalName contém `codigo` como token (\bcodigo\b, case-insensitive).
// Retorna apenas listings que NAO sao `excludeListingId` (compara contra _id E id).
// Falha graciosamente.
export async function findStaysListingsByInternalName(
  codigo: string,
  excludeListingId?: string
): Promise<Array<{ _id: string; internalName: string }>> {
  if (!codigo) return [];
  const all = await scanStaysListings();
  const re = new RegExp(`\\b${escapeRegex(codigo)}\\b`, "i");
  const excl = excludeListingId ? String(excludeListingId) : "";
  return all
    .filter(
      (it) =>
        re.test(it.internalName) &&
        (!excl || (it._id !== excl && it.id !== excl))
    )
    .map((it) => ({ _id: it._id || it.id, internalName: it.internalName }));
}

// Busca o primeiro listing cujo internalName contém `codigo` como token.
// Usado como fallback quando o Pipe 1 não tem o ID Stays preenchido.
export async function findStaysListingByCode(
  codigo: string
): Promise<{ _id: string; internalName: string } | null> {
  const hits = await findStaysListingsByInternalName(codigo);
  return hits[0] || null;
}

export async function patchStaysListing(
  listingId: string,
  body: Record<string, any>
): Promise<any> {
  const id = encodeURIComponent(listingId);
  const r = await staysFetch(`/content/listings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(
      `Stays PATCH ${listingId} ${r.status}: ${txt.slice(0, 200)}`
    );
  }
  return r.json();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface StaysTrocaResult {
  internalNameAntigo: string;
  internalNameNovo: string;
  // Idioma → { antigo, novo } — só os que tinham o código antigo no texto
  titulosAtualizados: Record<string, { antigo: string; novo: string }>;
  // True se o PATCH realmente foi disparado (false = drift, internalName atual já não bate)
  patchEnviado: boolean;
  // Status do listing apos a operacao:
  //  - "ja_trocado": internalName/titulos ja batem com codigoNovo (PATCH nao disparado)
  //  - "codigo_ausente": nao bate nem com antigo nem com novo (listing diferente)
  //  - "trocado_agora": PATCH disparado e aplicado
  status?: "ja_trocado" | "codigo_ausente" | "trocado_agora";
}

// Atualiza internalName + sufixo do _mstitle em todos os idiomas que contêm o código antigo.
// Estratégia conservadora:
//  - Só altera `internalName` se o atual bater com `codigoAntigo` (case-insensitive).
//  - Em cada idioma do `_mstitle`, faz substituição global do `codigoAntigo` por `codigoNovo`.
//  - Se nem o internalName nem nenhum idioma do _mstitle precisam mudar, NÃO dispara o PATCH.
// Calcula o que seria enviado num PATCH sem executar — read-only.
// Retorna o `body` que iria pro PATCH (vazio se nada precisa mudar).
export async function previewTrocaStays(
  listingId: string,
  codigoAntigo: string,
  codigoNovo: string
): Promise<{
  internalNameAntigo: string;
  internalNameNovo: string;
  titulosAtualizados: Record<string, { antigo: string; novo: string }>;
  body: Record<string, any>;
  precisaPatch: boolean;
  // Sem precisaPatch, distingue listing ja com codigoNovo vs listing com codigo desconhecido
  jaTrocado: boolean;
  codigoAusente: boolean;
}> {
  const listing = await getStaysListing(listingId);
  const internalNameAntigo: string = listing.internalName || "";
  const mstitle: Record<string, string> =
    (listing._mstitle && typeof listing._mstitle === "object"
      ? listing._mstitle
      : {}) as Record<string, string>;

  const body: Record<string, any> = {};
  const titulosAtualizados: Record<string, { antigo: string; novo: string }> = {};

  // Match por token (word-boundary) — aceita internalName exato ("PDAA0611")
  // ou com prefixo/sufixo ("ZU01H - PDAA0611"). Preserva o resto do nome.
  const reAntigoInternal = new RegExp(`\\b${escapeRegex(codigoAntigo)}\\b`, "i");
  const reNovoInternal = new RegExp(`\\b${escapeRegex(codigoNovo)}\\b`, "i");

  // 1) internalName
  if (reAntigoInternal.test(internalNameAntigo)) {
    body.internalName = internalNameAntigo.replace(
      new RegExp(`\\b${escapeRegex(codigoAntigo)}\\b`, "gi"),
      codigoNovo
    );
  }

  // 2) _mstitle por idioma
  const re = new RegExp(escapeRegex(codigoAntigo), "g");
  const newMstitle: Record<string, string> = {};
  let mstitleHasChanges = false;
  for (const [lang, val] of Object.entries(mstitle)) {
    if (typeof val === "string" && val && re.test(val)) {
      const novo = val.replace(re, codigoNovo);
      newMstitle[lang] = novo;
      titulosAtualizados[lang] = { antigo: val, novo };
      mstitleHasChanges = true;
    }
  }
  if (mstitleHasChanges) {
    body._mstitle = newMstitle;
  }

  const precisaPatch = Object.keys(body).length > 0;

  // Quando nao precisa patch, classificar: ja foi trocado OU codigo desconhecido
  let jaTrocado = false;
  let codigoAusente = false;
  if (!precisaPatch) {
    const reNovo = new RegExp(escapeRegex(codigoNovo), "i");
    const mstitleTemNovo = Object.values(mstitle).some(
      (v) => typeof v === "string" && reNovo.test(v)
    );
    if (reNovoInternal.test(internalNameAntigo) || mstitleTemNovo) {
      jaTrocado = true;
    } else {
      codigoAusente = true;
    }
  }

  return {
    internalNameAntigo,
    internalNameNovo: body.internalName ?? internalNameAntigo,
    titulosAtualizados,
    body,
    precisaPatch,
    jaTrocado,
    codigoAusente,
  };
}

export async function trocarCodigoStays(
  listingId: string,
  codigoAntigo: string,
  codigoNovo: string
): Promise<StaysTrocaResult> {
  const preview = await previewTrocaStays(listingId, codigoAntigo, codigoNovo);

  if (!preview.precisaPatch) {
    return {
      internalNameAntigo: preview.internalNameAntigo,
      internalNameNovo: preview.internalNameAntigo,
      titulosAtualizados: {},
      patchEnviado: false,
      status: preview.jaTrocado ? "ja_trocado" : "codigo_ausente",
    };
  }

  await patchStaysListing(listingId, preview.body);

  return {
    internalNameAntigo: preview.internalNameAntigo,
    internalNameNovo: preview.internalNameNovo,
    titulosAtualizados: preview.titulosAtualizados,
    patchEnviado: true,
    status: "trocado_agora",
  };
}
