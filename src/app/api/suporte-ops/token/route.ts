import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  buildInitialToken,
  clearTokenCookie,
  getTokenStatus,
  setTokenCookie,
} from "@/lib/suporte-ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  return requireAuth(req.cookies.get("auth_token")?.value);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json(getTokenStatus(req));
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const body = await req.json();
    const t = await buildInitialToken(body);
    const res = NextResponse.json({
      ok: true,
      email: t.email,
      user_id: t.user_id,
      expires_at: t.expires_at,
    });
    setTokenCookie(res, t);
    return res;
  } catch (e) {
    return errorResponse(e, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  clearTokenCookie(res);
  return res;
}
