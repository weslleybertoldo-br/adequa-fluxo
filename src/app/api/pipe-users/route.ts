import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { listPipeMembers } from "@/lib/responsavel";

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const users = await listPipeMembers();
    return NextResponse.json({ success: true, users });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
