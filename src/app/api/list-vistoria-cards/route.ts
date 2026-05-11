import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { listVistoriaCards } from "@/lib/enxoval/derive";

export async function POST(request: NextRequest) {
  if (!requireAuth(request.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { code } = (await request.json()) as { code?: string };
    if (!code) {
      return NextResponse.json({ error: "Código não fornecido" }, { status: 400 });
    }
    const cards = await listVistoriaCards(code);
    return NextResponse.json({ success: true, code, cards });
  } catch (error) {
    return errorResponse(error, { status: 500 });
  }
}
