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

// Busca listings cujo internalName == codigo. Stays API aceita filtro `q`
// (busca textual ampla) ou `internalName` direto, mas comportamento varia por
// versao. Usamos `q=codigo` e filtramos client-side por internalName exato.
// Retorna apenas listings que NAO sao `excludeListingId`. Falha graciosamente.
export async function findStaysListingsByInternalName(
  codigo: string,
  excludeListingId?: string
): Promise<Array<{ _id: string; internalName: string }>> {
  if (!codigo) return [];
  const q = encodeURIComponent(codigo);
  try {
    const r = await staysFetch(`/content/listings?q=${q}&limit=20`);
    if (!r.ok) return [];
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data?.data || data?.items || []);
    const target = codigo.toUpperCase().trim();
    return items
      .filter((it: any) => {
        const idHit = String(it?._id || it?.id || "");
        const internal = String(it?.internalName || "").toUpperCase().trim();
        return internal === target && idHit !== excludeListingId;
      })
      .map((it: any) => ({
        _id: String(it?._id || it?.id || ""),
        internalName: String(it?.internalName || ""),
      }));
  } catch {
    return [];
  }
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

  const antigoNorm = codigoAntigo.toUpperCase().trim();
  const novoNorm = codigoNovo.toUpperCase().trim();
  const internalNameAtualNorm = internalNameAntigo.toUpperCase().trim();

  // 1) internalName
  if (internalNameAtualNorm === antigoNorm) {
    body.internalName = codigoNovo;
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
    if (internalNameAtualNorm === novoNorm || mstitleTemNovo) {
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
