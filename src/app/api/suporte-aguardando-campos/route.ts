import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { getSuporteCard, updateSuporteCard } from "@/lib/suporte-ops";

interface AguardandoFlags {
  alteradoPipedrive?: boolean;
  alteradoOtas?: boolean;
  alteradoPipefyCsProp?: boolean;
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cardSuporteId = String(body.cardSuporteId || "").trim();
    const flags = (body.flags || {}) as AguardandoFlags;

    if (!cardSuporteId) {
      return NextResponse.json(
        { error: "cardSuporteId obrigatório" },
        { status: 400 }
      );
    }

    // Pega o card pra fazer merge sem sobrescrever campos das outras fases
    const atual = await getSuporteCard(cardSuporteId);
    if (!atual) {
      return NextResponse.json(
        { error: `Card ${cardSuporteId} não encontrado` },
        { status: 404 }
      );
    }

    const camposPreenchidosAtuais =
      (atual.campos_preenchidos as Record<string, any>) || {};
    const aguardandoAtual =
      (camposPreenchidosAtuais.aguardando as Record<string, any>) || {};

    // Os 3 nomes batem com `campos_gestao_json` do processo Troca de Codigo
    const novoAguardando: Record<string, any> = {
      ...aguardandoAtual,
      "Alterado no Pipedrive": !!flags.alteradoPipedrive,
      "Alterado nas OTAs?": !!flags.alteradoOtas,
      "Alterado no Pipefy - CS Prop": !!flags.alteradoPipefyCsProp,
    };

    const camposPreenchidosNovos = {
      ...camposPreenchidosAtuais,
      aguardando: novoAguardando,
    };

    const updated = await updateSuporteCard(cardSuporteId, {
      campos_preenchidos: camposPreenchidosNovos,
    } as any);

    const resumo = Object.entries(novoAguardando)
      .map(([k, v]) => `${k}: ${v ? "✓" : "—"}`)
      .join(", ");

    return NextResponse.json({
      success: true,
      cardSuporteId,
      camposAplicados: novoAguardando,
      mensagem: `Campos da fase Aguardando salvos — ${resumo}`,
      cardAtualizado: { id: updated?.id, status: updated?.status },
    });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao salvar campos", status: 500 });
  }
}
