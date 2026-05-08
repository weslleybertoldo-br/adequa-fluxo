import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  SUPORTE_OPS_SUPA_ANON,
  SUPORTE_OPS_SUPA_URL,
  getValidAccessTokenAndUpdate,
} from "@/lib/suporte-ops-auth";
import { SUPORTE_USER_WESLLEY } from "@/lib/suporte-ops";

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

    // Cookie holder pra carregar refresh, se necessario
    const cookieHolder = NextResponse.json({});
    let accessToken: string;
    try {
      accessToken = await getValidAccessTokenAndUpdate(req, cookieHolder);
    } catch (e) {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : String(e),
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

    const insRes = await fetch(`${SUPORTE_OPS_SUPA_URL}/rest/v1/cards?select=*`, {
      method: "POST",
      headers: {
        apikey: SUPORTE_OPS_SUPA_ANON,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });

    if (!insRes.ok) {
      const txt = await insRes.text().catch(() => "");
      return NextResponse.json(
        { error: `suporte-ops insert ${insRes.status}: ${txt.slice(0, 400)}` },
        { status: 500 }
      );
    }

    const arr = await insRes.json();
    if (!Array.isArray(arr) || !arr[0]) {
      return NextResponse.json(
        { error: "INSERT retornou vazio (RLS bloqueou?)" },
        { status: 500 }
      );
    }

    const card = arr[0];
    const finalRes = NextResponse.json({
      success: true,
      cardId: card.id,
      url: `https://suporte-ops.seazone.properties/kanban?card=${card.id}`,
    });
    // Propaga eventual cookie atualizado pelo refresh
    const refreshedCookie = cookieHolder.headers.get("set-cookie");
    if (refreshedCookie) finalRes.headers.set("set-cookie", refreshedCookie);
    return finalRes;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
