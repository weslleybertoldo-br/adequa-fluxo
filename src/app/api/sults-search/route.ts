import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";
import { searchChamadosByCode, getChamadoMedia, parseChamadoInput } from "@/lib/sults";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { input } = (await request.json()) as { input?: string };
    if (!input || !input.trim()) return NextResponse.json({ error: "input vazio" }, { status: 400 });

    const { osId, code } = parseChamadoInput(input);

    if (osId) {
      const details = await getChamadoMedia(osId);
      return NextResponse.json({
        mode: "direct",
        chamados: [
          {
            id: details.os.id,
            titulo: details.os.titulo,
            codigo: details.os.codigo,
            dtUltAlteracao: null,
            dtCriacao: null,
            situacao: null,
            responsavelNome: null,
            url: `${process.env.SULTS_BASE_URL || "https://seazone.sults.com.br"}/chamados/interacoes/${details.os.id}`,
          },
        ],
      });
    }

    if (!code) return NextResponse.json({ error: "código inválido" }, { status: 400 });
    const chamados = await searchChamadosByCode(code);
    chamados.sort((a, b) => (b.dtUltAlteracao || "").localeCompare(a.dtUltAlteracao || ""));
    return NextResponse.json({ mode: "search", chamados });
  } catch (err) {
    return errorResponse(err, { context: "sults-search" });
  }
}
