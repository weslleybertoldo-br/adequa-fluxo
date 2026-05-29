import { NextRequest, NextResponse } from "next/server";
import { signToken, AUTH_COOKIE, ALLOWED_DOMAIN } from "@/lib/auth-token";

export const runtime = "nodejs";

function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const part = idToken.split(".")[1];
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  return JSON.parse(json);
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const cookieState = req.cookies.get("oauth_state")?.value;

  const fail = (msg: string) => {
    const r = NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(msg)}`);
    r.cookies.delete("oauth_state");
    return r;
  };

  if (errorParam) return fail(errorParam);
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Sessão de login inválida, tente novamente");
  }

  const client_id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const client_secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!client_id || !client_secret) return fail("OAuth não configurado");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const j = (await tokenRes.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !j.id_token) {
    return fail(j.error_description || j.error || `Google ${tokenRes.status}`);
  }

  let payload: Record<string, unknown>;
  try {
    payload = decodeJwtPayload(j.id_token);
  } catch {
    return fail("Token do Google inválido");
  }

  const email = String(payload.email || "").toLowerCase();
  const verified = payload.email_verified === true || payload.email_verified === "true";
  const hd = String(payload.hd || "");
  const domainOk = email.endsWith(`@${ALLOWED_DOMAIN}`) && (hd === ALLOWED_DOMAIN || hd === "");

  if (!email || !verified || !domainOk) {
    return fail(`Acesso restrito a contas @${ALLOWED_DOMAIN}`);
  }

  const token = signToken(email);
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.set(AUTH_COOKIE.name, token, AUTH_COOKIE.opts);
  res.cookies.delete("oauth_state");
  return res;
}
