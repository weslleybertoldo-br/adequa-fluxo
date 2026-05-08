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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  clearLovableTokenCookie(res);
  return res;
}
