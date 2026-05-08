import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { LOVABLE_SUPA_ANON, LOVABLE_SUPA_URL } from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const r = await fetch(
    `${LOVABLE_SUPA_URL}/rest/v1/subcategorias_ocorrencia?select=id,codigo,descricao,categoria_id,categoria_nome,gravidade,pontos&ativo=eq.true&order=codigo.asc`,
    {
      headers: {
        apikey: LOVABLE_SUPA_ANON,
        Authorization: `Bearer ${LOVABLE_SUPA_ANON}`,
      },
    }
  );
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `lovable subcategorias ${r.status}: ${txt.slice(0, 300)}` },
      { status: 500 }
    );
  }
  return NextResponse.json(await r.json());
}
