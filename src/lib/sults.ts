import puppeteer, { type Browser, type Page } from "puppeteer";
import crypto from "node:crypto";

const SULTS_BASE = process.env.SULTS_BASE_URL || "https://seazone.sults.com.br";
const SULTS_USER = process.env.SULTS_USER || "";
const SULTS_PASSWORD = process.env.SULTS_PASSWORD || "";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

type Session = {
  cookieHeader: string;
  expiresAt: number;
};

let cachedSession: Session | null = null;
const SESSION_TTL_MS = 25 * 60 * 1000;

async function login(): Promise<Session> {
  if (!SULTS_USER || !SULTS_PASSWORD) {
    throw new Error("SULTS_USER e SULTS_PASSWORD não configurados em env");
  }

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page: Page = await browser.newPage();
    await page.setUserAgent(UA);

    await page.goto(`${SULTS_BASE}/login`, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("#form\\:login-usuario-inputText", { timeout: 10000 });
    await page.type("#form\\:login-usuario-inputText", SULTS_USER);
    await page.type("#form\\:login-user-password", SULTS_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
      page.evaluate(() => (document.querySelector("#form\\:j_idt24") as HTMLElement | null)?.click()),
    ]);
    await new Promise((r) => setTimeout(r, 3000));

    if (!page.url().includes("/solucoes") && !page.url().includes("/chamados")) {
      throw new Error(`Falha no login Sults — URL pós-login: ${page.url()}`);
    }

    const cookies = await page.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return { cookieHeader, expiresAt: Date.now() + SESSION_TTL_MS };
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}

async function getSession(): Promise<Session> {
  if (cachedSession && cachedSession.expiresAt > Date.now() + 60_000) return cachedSession;
  cachedSession = await login();
  return cachedSession;
}

function defaultHeaders(referer: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "*/*",
    "X-Request-ID": crypto.randomUUID(),
    page: "search",
    referer,
    "User-Agent": UA,
  };
}

async function apiPost(path: string, body: string, referer: string): Promise<Response> {
  const session = await getSession();
  const res = await fetch(`${SULTS_BASE}${path}`, {
    method: "POST",
    headers: { ...defaultHeaders(referer), Cookie: session.cookieHeader },
    body,
  });
  if (res.status === 401 || res.status === 403) {
    cachedSession = null;
    const fresh = await getSession();
    return fetch(`${SULTS_BASE}${path}`, {
      method: "POST",
      headers: { ...defaultHeaders(referer), Cookie: fresh.cookieHeader },
      body,
    });
  }
  return res;
}

export type ChamadoResumo = {
  id: number;
  titulo: string;
  dtUltAlteracao: string | null;
  dtCriacao: string | null;
  situacao: number | null;
  responsavelNome: string | null;
  url: string;
};

export async function searchChamadosByCode(code: string): Promise<ChamadoResumo[]> {
  const q = new URLSearchParams({
    tela: "todos",
    limit: "30",
    global: code,
    situacaoId: "1,4,5,6",
  });
  const res = await apiPost(
    `/controller/ordem-servico/list?${q}`,
    JSON.stringify({ osArr: [] }),
    `${SULTS_BASE}/chamados/todos`,
  );
  if (!res.ok) throw new Error(`Sults search falhou: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map((d) => ({
    id: Number(d.id),
    titulo: String(d.titulo ?? ""),
    dtUltAlteracao: (d.dtUltAlteracao as string) ?? null,
    dtCriacao: (d.dtCriacao as string) ?? null,
    situacao: (d.situacao as number) ?? null,
    responsavelNome:
      d.responsavel && typeof d.responsavel === "object" ? (d.responsavel as { nome?: string }).nome ?? null : null,
    url: `${SULTS_BASE}/chamados/interacoes/${d.id}`,
  }));
}

export type MediaItem = {
  id: number;
  nome: string;
  url: string;
  urlDownload: string;
  isImage: boolean;
  isVideo: boolean;
  interacaoId: number | null;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|webm|mkv|3gp)(\?|$)/i;

function classify(name: string, url: string): { isImage: boolean; isVideo: boolean } {
  const haystack = `${name} ${url}`;
  return { isImage: IMAGE_EXT.test(haystack), isVideo: VIDEO_EXT.test(haystack) };
}

export async function getChamadoMedia(osId: number): Promise<{
  os: { id: number; titulo: string; codigo: string | null };
  media: MediaItem[];
}> {
  const q = new URLSearchParams({ ordemServicoId: String(osId), os: "true", interacao: "true" });
  const res = await apiPost(
    `/controller/ordem-servico/interacao/list?${q}`,
    "",
    `${SULTS_BASE}/chamados/interacoes/${osId}`,
  );
  if (!res.ok) throw new Error(`Sults interacao falhou: HTTP ${res.status}`);
  const json = (await res.json()) as {
    interacao?: Array<{ interacao?: { id?: number; imgArr?: unknown[]; arquivoArr?: unknown[] } }>;
    os?: { id?: number; titulo?: string };
  };

  const titulo = json.os?.titulo ?? "";
  const codigoMatch = titulo.match(/^([A-Z]{2,5}\d{2,6})/);
  const media: MediaItem[] = [];
  for (const wrapper of json.interacao ?? []) {
    const it = wrapper.interacao;
    if (!it) continue;
    const interacaoId = typeof it.id === "number" ? it.id : null;

    for (const arr of [it.imgArr, it.arquivoArr]) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr as Array<Record<string, unknown>>) {
        const url = (item.url as string) || "";
        const urlDownload = (item.urlDownlaod as string) || (item.urlDownload as string) || url;
        const nome = (item.nome as string) || "";
        if (!url) continue;
        const c = classify(nome, url);
        media.push({
          id: Number(item.id ?? 0),
          nome,
          url,
          urlDownload,
          isImage: c.isImage,
          isVideo: c.isVideo,
          interacaoId,
        });
      }
    }
  }

  return {
    os: {
      id: Number(json.os?.id ?? osId),
      titulo,
      codigo: codigoMatch ? codigoMatch[1] : null,
    },
    media,
  };
}

export function parseChamadoInput(input: string): { osId: number | null; code: string | null } {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/chamados\/(?:interacoes|cardview)\/(\d+)/i);
  if (urlMatch) return { osId: Number(urlMatch[1]), code: null };
  if (/^\d+$/.test(trimmed)) return { osId: Number(trimmed), code: null };
  return { osId: null, code: trimmed.toUpperCase() };
}
