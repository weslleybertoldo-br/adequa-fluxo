// ========================
// Token storage + auto-refresh do Supabase do central de ocorrencias e multas
// (Lovable preview app: preview--centraldeocorrenciasemultas.lovable.app)
// ========================
// Cookie httpOnly criptografado (AES-256-GCM com TOKEN_SECRET).
// Mesmo padrao do suporte-ops-auth.ts.

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SUPA_URL =
  process.env.LOVABLE_SUPABASE_URL ||
  "https://olnzcwlzfheprbuhbylc.supabase.co";
const SUPA_ANON =
  process.env.LOVABLE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbnpjd2x6ZmhlcHJidWhieWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzE1NTIsImV4cCI6MjA4OTg0NzU1Mn0.GO349wqdjIdyLtoXgqfU-o0_vOJ_PtFuNk6GHTMn1_A";

const COOKIE_NAME = "lovable_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 dias

export interface LovableToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  email: string;
  full_name: string;
  saved_at: number;
}

export interface LovableTokenStatus {
  has_token: boolean;
  valid: boolean;
  expires_at?: number;
  expires_in_seconds?: number;
  email?: string;
  user_id?: string;
  full_name?: string;
  saved_at?: number;
}

function getKey(): Buffer {
  const secret = process.env.TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("TOKEN_SECRET ausente ou curto demais (>=16 chars)");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(encoded: string): string | null {
  try {
    const buf = Buffer.from(encoded, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
  } catch {
    return null;
  }
}

export function readLovableToken(req: NextRequest): LovableToken | null {
  const c = req.cookies.get(COOKIE_NAME);
  if (!c) return null;
  const d = decrypt(c.value);
  if (!d) return null;
  try {
    return JSON.parse(d);
  } catch {
    return null;
  }
}

export function setLovableTokenCookie(res: NextResponse, token: LovableToken): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: encrypt(JSON.stringify(token)),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearLovableTokenCookie(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function decodeJwtPayload(jwt: string): any {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("JWT mal formado");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const txt = Buffer.from(b64 + pad, "base64").toString("utf-8");
  return JSON.parse(txt);
}

export async function buildInitialLovableToken(payload: any): Promise<LovableToken> {
  let access_token: string | undefined;
  let refresh_token: string | undefined;
  let expires_at: number | undefined;
  let user_id: string | undefined;
  let email: string | undefined;
  let full_name: string | undefined;

  if (typeof payload === "string") {
    const lines = payload.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length >= 2) {
      access_token = lines[0];
      refresh_token = lines[1];
    }
  } else if (payload && typeof payload === "object") {
    access_token = payload.access_token;
    refresh_token = payload.refresh_token;
    if (Number.isFinite(Number(payload.expires_at))) expires_at = Number(payload.expires_at);
    const user = payload.user || {};
    user_id = user.id || payload.user_id;
    email = user.email || payload.email;
    full_name = user?.user_metadata?.full_name || user?.user_metadata?.name || payload.full_name;
  }

  if (!access_token) throw new Error("access_token ausente — paste o JWT");
  if (!refresh_token) throw new Error("refresh_token ausente");

  if (!expires_at || !user_id || !email || !full_name) {
    try {
      const claims = decodeJwtPayload(access_token);
      if (!expires_at && Number.isFinite(claims.exp)) expires_at = claims.exp;
      if (!user_id && typeof claims.sub === "string") user_id = claims.sub;
      if (!email && typeof claims.email === "string") email = claims.email;
      if (!full_name) {
        full_name = claims?.user_metadata?.full_name || claims?.user_metadata?.name || "";
      }
    } catch (e) {
      throw new Error(
        `access_token nao parece JWT valido: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (!Number.isFinite(expires_at as number) || (expires_at as number) < 1_700_000_000) {
    throw new Error("expires_at invalido");
  }
  if (!user_id) throw new Error("user_id (sub) ausente no JWT");

  return {
    access_token,
    refresh_token,
    expires_at: expires_at as number,
    user_id,
    email: email || "",
    full_name: full_name || "",
    saved_at: Math.floor(Date.now() / 1000),
  };
}

async function callSupabaseRefresh(refresh_token: string): Promise<LovableToken> {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPA_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Refresh lovable falhou ${res.status}: ${txt.slice(0, 300)} — re-bootstrap`
    );
  }
  const data = await res.json();
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Resposta de refresh sem tokens");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Number(data.expires_at),
    user_id: data.user?.id || "",
    email: data.user?.email || "",
    full_name: data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || "",
    saved_at: Math.floor(Date.now() / 1000),
  };
}

export async function refreshLovableTokenAndUpdate(
  req: NextRequest,
  res: NextResponse
): Promise<LovableToken> {
  const current = readLovableToken(req);
  if (!current) throw new Error("Sem token lovable — bootstrap antes via /api/lovable/token");
  const next = await callSupabaseRefresh(current.refresh_token);
  if (!next.user_id) next.user_id = current.user_id;
  if (!next.email) next.email = current.email;
  if (!next.full_name) next.full_name = current.full_name;
  setLovableTokenCookie(res, next);
  return next;
}

export async function getValidLovableAccessTokenAndUpdate(
  req: NextRequest,
  res: NextResponse
): Promise<string> {
  const current = readLovableToken(req);
  if (!current) throw new Error("Sem token lovable — bootstrap via /api/lovable/token");
  const nowSec = Math.floor(Date.now() / 1000);
  if (current.expires_at - nowSec > 60) return current.access_token;
  const refreshed = await refreshLovableTokenAndUpdate(req, res);
  return refreshed.access_token;
}

export function getLovableTokenStatus(req: NextRequest): LovableTokenStatus {
  const current = readLovableToken(req);
  if (!current) return { has_token: false, valid: false };
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    has_token: true,
    valid: current.expires_at - nowSec > 0,
    expires_at: current.expires_at,
    expires_in_seconds: current.expires_at - nowSec,
    email: current.email,
    user_id: current.user_id,
    full_name: current.full_name,
    saved_at: current.saved_at,
  };
}

export const LOVABLE_SUPA_URL = SUPA_URL;
export const LOVABLE_SUPA_ANON = SUPA_ANON;
