import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { updateSuporteCard } from "@/lib/suporte-ops";
import { errorResponse } from "@/lib/errors";

const STATUSES = ["novo", "em_andamento", "aguardando", "concluido", "arquivado"] as const;
type Status = (typeof STATUSES)[number];

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const cardSuporteId = String(body.cardSuporteId || "").trim();
    const novoStatus = String(body.novoStatus || "").trim();
    if (!cardSuporteId) {
      return NextResponse.json({ error: "cardSuporteId obrigatório" }, { status: 400 });
    }
    if (!STATUSES.includes(novoStatus as Status)) {
      return NextResponse.json(
        { error: `novoStatus inválido. Aceitos: ${STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    const updated = await updateSuporteCard(cardSuporteId, { status: novoStatus } as any);
    return NextResponse.json({
      success: true,
      cardSuporteId,
      novoStatus,
      cardAtualizado: { id: updated?.id, status: updated?.status },
    });
  } catch (err: unknown) {
    return errorResponse(err, { context: "suporte-mover-fase" });
  }
}
