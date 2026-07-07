import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { getResponsavel, setResponsavel } from "@/lib/responsavel";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const resp = await getResponsavel();
    return NextResponse.json({ success: true, responsavel: resp });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { id, name } = await req.json();
    if (!id || !/^\d+$/.test(String(id))) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const nome = String(name || "").trim() || String(id);
    await setResponsavel(String(id), nome);
    return NextResponse.json({ success: true, responsavel: { id: String(id), name: nome } });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
