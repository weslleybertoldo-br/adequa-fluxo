import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { getValidAccessToken } from "@/lib/suporte-ops-auth";
import { SUPORTE_USER_WESLLEY } from "@/lib/suporte-ops";

const SUPA_URL =
  process.env.SUPORTE_OPS_SUPABASE_URL ||
  "https://fxjpnamoafzomqlncdyn.supabase.co";
const SUPA_ANON =
  process.env.SUPORTE_OPS_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4anBuYW1vYWZ6b21xbG5jZHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzM0MTAsImV4cCI6MjA5MDY0OTQxMH0.69uyyWzQGxeeSx9dhH8GWAhUZfFIgXvW-vbCCiqvEXA";

// IDs do projeto suporte-ops descobertos via inspecao da tabela `processos`/`areas`.
// Aba "Suporte Franquias" do pipefy-enxoval sempre cria card no processo
// "Suporte Franquia" (area Franquias).
const AREA_FRANQUIAS = "a0000002-aaaa-0000-0000-000000000002";
const PROCESSO_SUPORTE_FRANQUIA = "58f5867d-3e3e-4428-ae8e-319bc4cc1048";
// Assuntos do processo (enum em campos_json): Comunicacao, Enxoval, Vistoria, Insatisfacao Proprietario
const ASSUNTOS_VALIDOS = ["Comunicação", "Enxoval", "Vistoria", "Insatisfação Proprietário"] as const;

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const {
      codigo,
      categoria,
      setor,
      descricao,
      franqueado,
      assunto,
      urgencia,
    } = await req.json();

    if (!codigo || !descricao) {
      return NextResponse.json(
        { error: "Campos obrigatórios: codigo, descricao" },
        { status: 400 }
      );
    }

    const assuntoFinal =
      assunto && ASSUNTOS_VALIDOS.includes(assunto as any)
        ? assunto
        : "Comunicação";
    const urgenciaFinal = ["crise", "alta", "media", "baixa"].includes(
      (urgencia || "").toLowerCase()
    )
      ? (urgencia as string).toLowerCase()
      : "media";

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : String(e),
          needs_token_bootstrap: true,
        },
        { status: 401 }
      );
    }

    const camposPreenchidos = {
      novo: {
        Setor: setor || "",
        Assunto: assuntoFinal,
        Problema: categoria || "",
        Consultor: franqueado || "",
      },
    };

    const camposAdicionaisTxt = [
      `Setor: ${setor || "-"}`,
      `Assunto: ${assuntoFinal}`,
      `Problema: ${categoria || "-"}`,
      `Consultor: ${franqueado || "-"}`,
    ].join("\n");

    const descricaoCompleta = `${descricao}\n\n--- Campos adicionais ---\n${camposAdicionaisTxt}`;

    const body = {
      codigo_imovel: codigo.trim().toUpperCase() || "SEM-CODIGO",
      area_id: AREA_FRANQUIAS,
      processo_id: PROCESSO_SUPORTE_FRANQUIA,
      solicitante_id: SUPORTE_USER_WESLLEY,
      urgencia: urgenciaFinal,
      status: "novo",
      descricao: descricaoCompleta,
      campos_preenchidos: camposPreenchidos,
    };

    const res = await fetch(`${SUPA_URL}/rest/v1/cards?select=*`, {
      method: "POST",
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `suporte-ops insert ${res.status}: ${txt.slice(0, 400)}` },
        { status: 500 }
      );
    }

    const arr = await res.json();
    if (!Array.isArray(arr) || !arr[0]) {
      return NextResponse.json(
        { error: "INSERT retornou vazio (RLS bloqueou?)" },
        { status: 500 }
      );
    }

    const card = arr[0];
    return NextResponse.json({
      success: true,
      cardId: card.id,
      url: `https://suporte-ops.seazone.properties/kanban?card=${card.id}`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
