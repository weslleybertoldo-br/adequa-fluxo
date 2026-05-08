import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  LOVABLE_SUPA_ANON,
  LOVABLE_SUPA_URL,
  getValidLovableAccessTokenAndUpdate,
} from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const cookieHolder = NextResponse.json({});
  let token: string;
  try {
    token = await getValidLovableAccessTokenAndUpdate(req, cookieHolder);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), needs_token: true },
      { status: 401 }
    );
  }
  const r = await fetch(
    `${LOVABLE_SUPA_URL}/rest/v1/franquias?select=id,nome,email&order=nome.asc`,
    { headers: { apikey: LOVABLE_SUPA_ANON, Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `lovable franquias ${r.status}: ${txt.slice(0, 300)}` },
      { status: 500 }
    );
  }
  const res = NextResponse.json(await r.json());
  const refreshedCookie = cookieHolder.headers.get("set-cookie");
  if (refreshedCookie) res.headers.set("set-cookie", refreshedCookie);
  return res;
}
