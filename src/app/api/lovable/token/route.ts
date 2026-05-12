import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  buildInitialLovableToken,
  clearLovableTokenCookie,
  getLovableTokenStatus,
  setLovableTokenCookie,
} from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  return requireAuth(req.cookies.get("auth_token")?.value);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json(getLovableTokenStatus(req));
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const body = await req.json();
    const t = await buildInitialLovableToken(body);
    const res = NextResponse.json({
      ok: true,
      email: t.email,
      full_name: t.full_name,
      user_id: t.user_id,
      expires_at: t.expires_at,
    });
    setLovableTokenCookie(res, t);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/refresh_token ausente/i.test(msg)) {
      return NextResponse.json(
        { error: "refresh_token ausente — cole no segundo campo (basta ele)" },
        { status: 400 }
      );
    }
    if (/already.?used|Already Used/i.test(msg)) {
      return NextResponse.json(
        { error: "refresh_token já consumido — abra o Lovable, copie o atual e cole novamente (feche o Lovable depois pra evitar revogação por reuso)" },
        { status: 400 }
      );
    }
    if (/Invalid Refresh Token|refresh_token.*not valid|validation_failed/i.test(msg)) {
      return NextResponse.json(
        { error: "refresh_token inválido ou revogado — copie o atual do Lovable (F12 → snippet)" },
        { status: 400 }
      );
    }
    if (/access_token nao parece JWT|JWT mal formado|user_id.*ausente|expires_at invalido/i.test(msg)) {
      return NextResponse.json(
        { error: `access_token inválido: ${msg}` },
        { status: 400 }
      );
    }
    if (/Refresh lovable falhou/i.test(msg)) {
      return NextResponse.json(
        { error: `Supabase rejeitou o refresh_token: ${msg.replace(/^Refresh lovable falhou /, '')}` },
        { status: 400 }
      );
    }
    return errorResponse(e, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  clearLovableTokenCookie(res);
  return res;
}
