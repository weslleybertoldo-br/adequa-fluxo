import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  SUPORTE_OPS_SUPA_ANON,
  SUPORTE_OPS_SUPA_URL,
} from "@/lib/suporte-ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const areaId = req.nextUrl.searchParams.get("area_id");
  const url = areaId
    ? `${SUPORTE_OPS_SUPA_URL}/rest/v1/processos?area_id=eq.${encodeURIComponent(areaId)}&ativo=eq.true&select=id,nome,area_id&order=nome.asc`
    : `${SUPORTE_OPS_SUPA_URL}/rest/v1/processos?ativo=eq.true&select=id,nome,area_id&order=nome.asc`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPORTE_OPS_SUPA_ANON,
      Authorization: `Bearer ${SUPORTE_OPS_SUPA_ANON}`,
    },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `suporte-ops processos ${r.status}: ${txt.slice(0, 300)}` },
      { status: 500 }
    );
  }
  return NextResponse.json(await r.json());
}
