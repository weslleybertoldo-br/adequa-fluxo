import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { LOVABLE_SUPA_ANON, LOVABLE_SUPA_URL } from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_FIXO = "weslley.bertoldo@seazone.com.br";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const r = await fetch(
    `${LOVABLE_SUPA_URL}/rest/v1/ocorrencias?email_solicitante=eq.${encodeURIComponent(EMAIL_FIXO)}&select=id,titulo,codigo_imovel,franquia_nome,area_origem,subcategoria,categoria,gravidade,pontos,status_etapa,criado_em,excluido&order=criado_em.desc&limit=1000`,
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
      { error: `lovable ocorrencias ${r.status}: ${txt.slice(0, 300)}` },
      { status: 500 }
    );
  }
  return NextResponse.json(await r.json());
}
