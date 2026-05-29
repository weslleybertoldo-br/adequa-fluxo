import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ALLOWED_DOMAIN } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url);
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent("GOOGLE_OAUTH_CLIENT_ID não configurado")}`);
  }

  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    hd: ALLOWED_DOMAIN, // sugere o seletor de conta do domínio (validação real é no callback)
    prompt: "select_account",
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
