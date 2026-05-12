import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import {
  SUPORTE_OPS_SUPA_ANON,
  SUPORTE_OPS_SUPA_URL,
} from "@/lib/suporte-ops-auth";
import { SUPORTE_USER_WESLLEY } from "@/lib/suporte-ops";

// Defaults: area Franquias + processo "Suporte Franquia" (compat retro).
const AREA_FRANQUIAS_DEFAULT = "a0000002-aaaa-0000-0000-000000000002";
const PROCESSO_SUPORTE_FRANQUIA_DEFAULT = "58f5867d-3e3e-4428-ae8e-319bc4cc1048";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      area_id,
      processo_id,
      processo_nome,
    } = await req.json();

    const areaIdFinal = UUID_RE.test(area_id || "") ? area_id : AREA_FRANQUIAS_DEFAULT;
    const processoIdFinal = UUID_RE.test(processo_id || "") ? processo_id : PROCESSO_SUPORTE_FRANQUIA_DEFAULT;

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

    // Anon-only: RLS de `cards` libera INSERT pra anon (mesmo padrao da
    // Troca de Codigo). Sem necessidade de JWT/bootstrap.

    const camposPreenchidos = {
      novo: {
        Setor: setor || "",
        Assunto: assuntoFinal,
        Problema: categoria || "",
        Consultor: franqueado || "",
      },
    };

    const camposAdicionaisTxt = [
      `Área: ${areaIdFinal === AREA_FRANQUIAS_DEFAULT ? "Franquias" : areaIdFinal}`,
      `Processo: ${processo_nome || "-"}`,
      `Setor: ${setor || "-"}`,
      `Assunto: ${assuntoFinal}`,
      `Problema: ${categoria || "-"}`,
      `Consultor: ${franqueado || "-"}`,
    ].join("\n");

    const descricaoCompleta = `${descricao}\n\n--- Campos adicionais ---\n${camposAdicionaisTxt}`;

    const body = {
      codigo_imovel: codigo.trim().toUpperCase() || "SEM-CODIGO",
      area_id: areaIdFinal,
      processo_id: processoIdFinal,
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
        Authorization: `Bearer ${SUPORTE_OPS_SUPA_ANON}`,
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
    return NextResponse.json({
      success: true,
      cardId: card.id,
      url: `https://suporte-ops.seazone.properties/kanban?card=${card.id}`,
    });
  } catch (err: unknown) {
    return errorResponse(err, { status: 500 });
  }
}
