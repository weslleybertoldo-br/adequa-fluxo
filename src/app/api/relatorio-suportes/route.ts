import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { SUPORTE_USER_WESLLEY } from "@/lib/suporte-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA_URL =
  process.env.SUPORTE_OPS_SUPABASE_URL ||
  "https://fxjpnamoafzomqlncdyn.supabase.co";
const SUPA_ANON =
  process.env.SUPORTE_OPS_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4anBuYW1vYWZ6b21xbG5jZHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzM0MTAsImV4cCI6MjA5MDY0OTQxMH0.69uyyWzQGxeeSx9dhH8GWAhUZfFIgXvW-vbCCiqvEXA";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const select =
    "id,codigo_imovel,status,urgencia,created_at,area:areas(nome),processo:processos(nome)";
  const r = await fetch(
    `${SUPA_URL}/rest/v1/cards?solicitante_id=eq.${SUPORTE_USER_WESLLEY}&select=${encodeURIComponent(select)}&order=created_at.desc&limit=2000`,
    {
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
      },
    }
  );
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `suporte cards ${r.status}: ${txt.slice(0, 300)}` },
      { status: 500 }
    );
  }
  return NextResponse.json(await r.json());
}
