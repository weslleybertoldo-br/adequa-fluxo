// ========================
// Token storage + auto-refresh do Supabase do suporte-ops.seazone.properties
// ========================
// O site usa Google OAuth via Supabase Auth, JWT expira em 1h.
// Persistimos { access_token, refresh_token, expires_at } em arquivo local
// e refreshamos automaticamente quando faltam <60s pra expirar.
//
// Local: arquivo `.suporte-ops-token.json` na raiz do projeto (gitignored).
// Em prod (Vercel) o filesystem eh ephemeral — usar SUPORTE_OPS_REFRESH_TOKEN
// como env var (long-lived, ~30 dias) e cachear o access_token em memoria.

import fs from "fs/promises";
import path from "path";

const SUPA_URL =
  process.env.SUPORTE_OPS_SUPABASE_URL ||
  "https://fxjpnamoafzomqlncdyn.supabase.co";
const SUPA_ANON =
  process.env.SUPORTE_OPS_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4anBuYW1vYWZ6b21xbG5jZHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzM0MTAsImV4cCI6MjA5MDY0OTQxMH0.69uyyWzQGxeeSx9dhH8GWAhUZfFIgXvW-vbCCiqvEXA";

const TOKEN_FILE = path.join(process.cwd(), ".suporte-ops-token.json");

export interface SuporteOpsToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user_id: string;
  email: string;
  saved_at: number; // unix seconds
}

export interface TokenStatus {
  has_token: boolean;
  valid: boolean;
  expires_at?: number;
  expires_in_seconds?: number;
  email?: string;
  user_id?: string;
  saved_at?: number;
}

let memoryCache: SuporteOpsToken | null = null;

async function readFromDisk(): Promise<SuporteOpsToken | null> {
  try {
    const txt = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function writeToDisk(token: SuporteOpsToken): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

async function loadToken(): Promise<SuporteOpsToken | null> {
  if (memoryCache) return memoryCache;
  const fromDisk = await readFromDisk();
  if (fromDisk) memoryCache = fromDisk;
  return memoryCache;
}

async function saveToken(token: SuporteOpsToken): Promise<void> {
  memoryCache = token;
  await writeToDisk(token);
}

export async function clearToken(): Promise<void> {
  memoryCache = null;
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    /* ja nao existia */
  }
}

function decodeJwtPayload(jwt: string): any {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("JWT mal formado");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const txt = Buffer.from(b64 + pad, "base64").toString("utf-8");
  return JSON.parse(txt);
}

/**
 * Aceita varios formatos:
 *  - Objeto completo: `{access_token, refresh_token, expires_at, user:{id,email}}`
 *  - `{access_token, refresh_token}` — extrai exp/sub/email do JWT
 *  - String tipo `<access_token>\n<refresh_token>` — 2 linhas
 */
export async function setInitialToken(payload: any): Promise<SuporteOpsToken> {
  let access_token: string | undefined;
  let refresh_token: string | undefined;
  let expires_at: number | undefined;
  let user_id: string | undefined;
  let email: string | undefined;

  if (typeof payload === "string") {
    const lines = payload
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      access_token = lines[0];
      refresh_token = lines[1];
    }
  } else if (payload && typeof payload === "object") {
    access_token = payload.access_token;
    refresh_token = payload.refresh_token;
    if (Number.isFinite(Number(payload.expires_at))) {
      expires_at = Number(payload.expires_at);
    }
    const user = payload.user || {};
    user_id = user.id || payload.user_id;
    email = user.email || payload.email;
  }

  if (!access_token || typeof access_token !== "string") {
    throw new Error("access_token ausente — paste o JWT que comeca com eyJ...");
  }
  if (!refresh_token || typeof refresh_token !== "string") {
    throw new Error(
      "refresh_token ausente — pega o campo refresh_token do localStorage do site"
    );
  }

  // Deriva expires_at e user_id do JWT se nao vieram
  if (!expires_at || !user_id || !email) {
    try {
      const claims = decodeJwtPayload(access_token);
      if (!expires_at && Number.isFinite(claims.exp)) expires_at = claims.exp;
      if (!user_id && typeof claims.sub === "string") user_id = claims.sub;
      if (!email && typeof claims.email === "string") email = claims.email;
    } catch (e) {
      throw new Error(
        `access_token nao parece um JWT valido: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (!Number.isFinite(expires_at as number) || (expires_at as number) < 1_700_000_000) {
    throw new Error("expires_at invalido (esperado unix seconds)");
  }
  if (!user_id || typeof user_id !== "string") {
    throw new Error("user_id (sub) ausente no JWT");
  }

  const token: SuporteOpsToken = {
    access_token,
    refresh_token,
    expires_at: expires_at as number,
    user_id,
    email: email || "",
    saved_at: Math.floor(Date.now() / 1000),
  };
  await saveToken(token);
  return token;
}

/**
 * Chama Supabase auth com grant_type=refresh_token. Retorna o token novo
 * (access_token + NOVO refresh_token) e persiste.
 */
export async function refreshToken(): Promise<SuporteOpsToken> {
  const current = await loadToken();
  if (!current) {
    throw new Error(
      "Sem token persistido — bootstrap antes via POST /api/suporte-ops/token"
    );
  }

  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPA_ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Refresh falhou ${res.status}: ${txt.slice(0, 300)} — provavel refresh_token expirado, fazer logout/login no suporte-ops e re-bootstrap`
    );
  }

  const data = await res.json();
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Resposta de refresh sem access_token/refresh_token");
  }

  const next: SuporteOpsToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Number(data.expires_at),
    user_id: data.user?.id || current.user_id,
    email: data.user?.email || current.email,
    saved_at: Math.floor(Date.now() / 1000),
  };
  await saveToken(next);
  return next;
}

/**
 * Retorna access_token valido. Refresha automaticamente se faltam <60s
 * pra expirar. Lanca se nao houver token persistido.
 */
export async function getValidAccessToken(): Promise<string> {
  const current = await loadToken();
  if (!current) {
    throw new Error(
      "Sem token suporte-ops — bootstrap via POST /api/suporte-ops/token"
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (current.expires_at - nowSec > 60) {
    return current.access_token;
  }
  const refreshed = await refreshToken();
  return refreshed.access_token;
}

export async function getTokenStatus(): Promise<TokenStatus> {
  const current = await loadToken();
  if (!current) return { has_token: false, valid: false };
  const nowSec = Math.floor(Date.now() / 1000);
  const expires_in_seconds = current.expires_at - nowSec;
  return {
    has_token: true,
    valid: expires_in_seconds > 0,
    expires_at: current.expires_at,
    expires_in_seconds,
    email: current.email,
    user_id: current.user_id,
    saved_at: current.saved_at,
  };
}
