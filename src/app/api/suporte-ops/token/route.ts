import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  clearToken,
  getTokenStatus,
  setInitialToken,
} from "@/lib/suporte-ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest): boolean {
  return requireAuth(req.cookies.get("auth_token")?.value);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const status = await getTokenStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const body = await req.json();
    const t = await setInitialToken(body);
    return NextResponse.json({
      ok: true,
      email: t.email,
      user_id: t.user_id,
      expires_at: t.expires_at,
    });
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
  await clearToken();
  return NextResponse.json({ ok: true });
}
