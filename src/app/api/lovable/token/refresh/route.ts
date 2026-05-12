import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  refreshLovableTokenAndUpdate,
  setLovableTokenCookie,
} from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const tmp = NextResponse.json({});
    const next = await refreshLovableTokenAndUpdate(req, tmp);
    const nowSec = Math.floor(Date.now() / 1000);
    const res = NextResponse.json({
      ok: true,
      has_token: true,
      valid: next.expires_at - nowSec > 0,
      expires_at: next.expires_at,
      expires_in_seconds: next.expires_at - nowSec,
      email: next.email,
      user_id: next.user_id,
      full_name: next.full_name,
      saved_at: next.saved_at,
    });
    setLovableTokenCookie(res, next);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Sem token lovable/i.test(msg)) {
      return NextResponse.json(
        { error: "Sem token cadastrado — clique Cadastrar token" },
        { status: 401 }
      );
    }
    if (/Refresh lovable falhou/i.test(msg)) {
      return NextResponse.json(
        { error: "refresh_token expirado — clique Resetar e cadastre token novo" },
        { status: 401 }
      );
    }
    return errorResponse(e, { status: 500 });
  }
}
