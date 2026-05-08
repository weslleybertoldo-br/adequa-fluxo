import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  LOVABLE_SUPA_ANON,
  LOVABLE_SUPA_URL,
  getValidLovableAccessTokenAndUpdate,
} from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function categoriaSingular(plural: string): string {
  return plural.replace(/^Ocorrências/i, "Ocorrência");
}

/**
 * Padroniza uma ocorrencia ja existente:
 * - titulo = codigo_imovel
 * - gravidade = "leve" | "media" | "grave" | "gravissima" (sem " - N pontos")
 * - categoria = singular
 *
 * Usa JWT do user (cookie). RLS deve permitir UPDATE pra solicitante.
 */
export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  const cookieHolder = NextResponse.json({});
  let token: string;
  try {
    token = await getValidLovableAccessTokenAndUpdate(req, cookieHolder);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), needs_token_bootstrap: true },
      { status: 401 }
    );
  }

  // 1. Le a row
  const r = await fetch(
    `${LOVABLE_SUPA_URL}/rest/v1/ocorrencias?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      headers: { apikey: LOVABLE_SUPA_ANON, Authorization: `Bearer ${token}` },
    }
  );
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return NextResponse.json({ error: `read ${r.status}: ${txt}` }, { status: 500 });
  }
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr[0]) {
    return NextResponse.json({ error: "ocorrencia nao encontrada" }, { status: 404 });
  }
  const row = arr[0];

  // 2. Computa valores corrigidos
  const tituloNovo = (row.codigo_imovel && row.codigo_imovel !== "N/A")
    ? row.codigo_imovel
    : row.titulo;
  let gravidadeNova: string = row.gravidade || "";
  // Tira "- N pontos" se houver
  const m = gravidadeNova.match(/^([a-zíãâúéê]+)\s*-\s*\d+\s*pontos?$/i);
  if (m) gravidadeNova = m[1];
  const categoriaNova = row.categoria ? categoriaSingular(row.categoria) : "";

  const patch = {
    titulo: tituloNovo,
    gravidade: gravidadeNova,
    categoria: categoriaNova,
  };

  // 3. PATCH
  const u = await fetch(
    `${LOVABLE_SUPA_URL}/rest/v1/ocorrencias?id=eq.${encodeURIComponent(id)}&select=id,titulo,gravidade,categoria`,
    {
      method: "PATCH",
      headers: {
        apikey: LOVABLE_SUPA_ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    }
  );
  if (!u.ok) {
    const txt = await u.text().catch(() => "");
    return NextResponse.json({ error: `patch ${u.status}: ${txt}` }, { status: 500 });
  }
  const updated = await u.json();
  if (!Array.isArray(updated) || updated.length === 0) {
    return NextResponse.json(
      { error: "PATCH retornou 0 rows (RLS bloqueou)" },
      { status: 500 }
    );
  }

  const finalRes = NextResponse.json({
    success: true,
    before: {
      titulo: row.titulo,
      gravidade: row.gravidade,
      categoria: row.categoria,
    },
    after: updated[0],
  });
  const refreshedCookie = cookieHolder.headers.get("set-cookie");
  if (refreshedCookie) finalRes.headers.set("set-cookie", refreshedCookie);
  return finalRes;
}
