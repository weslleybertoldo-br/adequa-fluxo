import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, requireAuth, toBrazilDate, PHASE_3_ID, PHASE_4_ID, PHASE_5_ID } from "@/lib/pipefy";
import { PIPEFY_PHASE } from "@/lib/config";

const CONCLUDED_PHASE_ID = PIPEFY_PHASE.CONCLUDED;

const SEARCH_PHASES = [
  { id: PHASE_3_ID, name: "Fase 3" },
  { id: PHASE_4_ID, name: "Fase 4" },
  { id: PHASE_5_ID, name: "Fase 5" },
  { id: CONCLUDED_PHASE_ID, name: "Concluídos" },
];

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("q");
  if (!search || search.trim().length < 2) {
    return NextResponse.json({ error: "Mínimo 2 caracteres" }, { status: 400 });
  }

  try {
    const escaped = JSON.stringify(search.trim()).slice(1, -1);
    const searchUpper = search.trim().toUpperCase();
    const cards: { id: string; title: string; phase: string; dueFormatted: string }[] = [];

    // Buscar em paralelo em todas as fases
    const results = await Promise.all(
      SEARCH_PHASES.map(async (phase) => {
        const result = await pipefyQuery(`{
          phase(id: ${phase.id}) {
            cards(first: 5, search: { title: "${escaped}" }) {
              edges {
                node { id title due_date }
              }
            }
          }
        }`);
        const edges = result?.data?.phase?.cards?.edges || [];
        return edges
          .map((e: any) => e.node)
          .filter((c: any) => c.title.toUpperCase().includes(searchUpper))
          .map((c: any) => {
            let dueFormatted = "Sem vencimento";
            if (c.due_date) {
              const br = toBrazilDate(new Date(c.due_date));
              dueFormatted = `${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")}/${br.year}`;
            }
            return { id: c.id, title: c.title, phase: phase.name, dueFormatted };
          });
      })
    );

    for (const r of results) cards.push(...r);

    return NextResponse.json({ success: true, cards });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
