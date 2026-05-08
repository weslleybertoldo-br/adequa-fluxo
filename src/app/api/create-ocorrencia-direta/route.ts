import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { LOVABLE_SUPA_ANON, LOVABLE_SUPA_URL } from "@/lib/lovable-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AREA_ORIGEM_VALIDAS = [
  "Comentários",
  "Manutenções",
  "Implantação",
  "Gestor Regional",
  "Despesas",
  "Outros",
  "Treinamento",
  "Suporte Franquias",
  "Atendimento ao Hóspede",
  "Danos",
  "Qualidade",
  "Cancelamento de vistorias",
];

function escapeStorageName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

function gravidadeFmt(gravidade: string, pontos: number): string {
  const plural = pontos === 1 ? "ponto" : "pontos";
  return `${gravidade} - ${pontos} ${plural}`;
}

function mesAplicacao(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Maceio",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Anon-first: tentamos INSERT com anon key. Se RLS bloquear, instrucao
  // futura sera bootstrap de JWT (mesmo padrao do suporte-ops).
  const authBearer = `Bearer ${LOVABLE_SUPA_ANON}`;

  try {
    const formData = await req.formData();
    const email = (formData.get("email") as string)?.trim();
    const fullName = (formData.get("full_name") as string)?.trim() || "";
    const envolveImovelRaw = (formData.get("envolve_imovel") as string) || "true";
    const envolve_imovel = envolveImovelRaw === "true" || envolveImovelRaw === "Sim";
    const codigoImovel =
      (formData.get("codigo_imovel") as string)?.trim().toUpperCase() ||
      (envolve_imovel ? "" : "N/A");
    const franquiaNome = (formData.get("franquia_nome") as string)?.trim();
    const areaOrigem = (formData.get("area_origem") as string)?.trim();
    const descricao = (formData.get("descricao") as string)?.trim();
    const subcategoriaCodigo = (formData.get("subcategoria_codigo") as string)?.trim();
    const subcategoriaCategoria = (formData.get("subcategoria_categoria") as string)?.trim() || "";
    const subcategoriaGravidade = (formData.get("subcategoria_gravidade") as string)?.trim() || "";
    const subcategoriaPontos = Number(formData.get("subcategoria_pontos") || 0);
    const file = formData.get("evidencia") as File | null;

    if (!email) return NextResponse.json({ error: "email obrigatorio" }, { status: 400 });
    if (!franquiaNome) return NextResponse.json({ error: "franquia obrigatoria" }, { status: 400 });
    if (!areaOrigem || !AREA_ORIGEM_VALIDAS.includes(areaOrigem)) {
      return NextResponse.json(
        { error: `area_origem invalida (validas: ${AREA_ORIGEM_VALIDAS.join(", ")})` },
        { status: 400 }
      );
    }
    if (!descricao) return NextResponse.json({ error: "descricao obrigatoria" }, { status: 400 });
    if (!subcategoriaCodigo) return NextResponse.json({ error: "subcategoria obrigatoria" }, { status: 400 });
    if (envolve_imovel && !codigoImovel) {
      return NextResponse.json(
        { error: "codigo_imovel obrigatorio quando envolve_imovel=true" },
        { status: 400 }
      );
    }
    if (file && file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo > 10MB" }, { status: 400 });
    }

    // 1. Upload da evidencia (opcional)
    let urlAnexo: string | null = null;
    let nomeAnexo: string | null = null;
    if (file && file.size > 0) {
      const ts = Date.now();
      const safeName = escapeStorageName(file.name);
      const objectPath = `${ts}-${safeName}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const upRes = await fetch(
        `${LOVABLE_SUPA_URL}/storage/v1/object/evidencias/${encodeURIComponent(objectPath)}`,
        {
          method: "POST",
          headers: {
            apikey: LOVABLE_SUPA_ANON,
            Authorization: authBearer,
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "false",
          },
          body: buf,
        }
      );
      if (!upRes.ok) {
        const txt = await upRes.text().catch(() => "");
        return NextResponse.json(
          { error: `Upload evidencia ${upRes.status}: ${txt.slice(0, 300)}` },
          { status: 500 }
        );
      }
      urlAnexo = `${LOVABLE_SUPA_URL}/storage/v1/object/public/evidencias/${encodeURIComponent(objectPath)}`;
      nomeAnexo = file.name;
    }

    // 2. INSERT
    const titulo = descricao.split("\n")[0].slice(0, 200);
    const gravidade =
      subcategoriaGravidade && subcategoriaPontos
        ? gravidadeFmt(subcategoriaGravidade, subcategoriaPontos)
        : "";

    const body = {
      titulo,
      descricao,
      franquia_nome: franquiaNome,
      area_origem: areaOrigem,
      status_etapa: "nova-ocorrencia",
      criado_por_email: email,
      criado_por_nome: fullName || email,
      email_solicitante: email,
      envolve_imovel,
      codigo_imovel: codigoImovel || (envolve_imovel ? "" : "N/A"),
      url_anexo: urlAnexo,
      nome_anexo: nomeAnexo,
      gravidade,
      subcategoria: subcategoriaCodigo,
      categoria: subcategoriaCategoria,
      pontos: subcategoriaPontos || null,
      mes_aplicacao: mesAplicacao(),
    };

    const insRes = await fetch(`${LOVABLE_SUPA_URL}/rest/v1/ocorrencias?select=*`, {
      method: "POST",
      headers: {
        apikey: LOVABLE_SUPA_ANON,
        Authorization: authBearer,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
    if (!insRes.ok) {
      const txt = await insRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `lovable INSERT ocorrencia ${insRes.status}: ${txt.slice(0, 400)}`,
          uploaded_url: urlAnexo,
        },
        { status: 500 }
      );
    }
    const arr = await insRes.json();
    if (!Array.isArray(arr) || !arr[0]) {
      return NextResponse.json(
        { error: "INSERT retornou vazio (RLS bloqueou?)", uploaded_url: urlAnexo },
        { status: 500 }
      );
    }
    const ocorrencia = arr[0];
    return NextResponse.json({
      success: true,
      id: ocorrencia.id,
      url: `https://preview--centraldeocorrenciasemultas.lovable.app/adm/funil-ocorrencias?id=${ocorrencia.id}`,
      uploaded_url: urlAnexo,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
