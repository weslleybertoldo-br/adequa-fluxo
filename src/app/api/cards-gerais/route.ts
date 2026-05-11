import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, validateCardId, updateDueDate, updateAssignee, createComment,
  requireAuth, sanitizeGraphQL, PHASE_3_ID, PHASE_4_ID, PHASE_5_ID,
} from "@/lib/pipefy";

// Todas as fases do Pipe 2
const ALL_PHASES = [
  { id: "323529355", name: "Fase 0" },
  { id: "323315791", name: "Fase 1" },
  { id: "323529394", name: "Fase 2" },
  { id: PHASE_3_ID, name: "Fase 3" },
  { id: PHASE_4_ID, name: "Fase 4" },
  { id: PHASE_5_ID, name: "Fase 5" },
  { id: "323315793", name: "Concluído" },
  { id: "323691490", name: "CHURN" },
  { id: "329664300", name: "Excluídos" },
];

const ADVANCE_PHASES = [PHASE_3_ID, PHASE_4_ID, PHASE_5_ID];

// GET: Pesquisar card em todas as fases
export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const search = req.nextUrl.searchParams.get("q");
  if (!search || search.trim().length < 2) {
    return NextResponse.json({ error: "Mínimo 2 caracteres" }, { status: 400 });
  }
  try {
    const escaped = sanitizeGraphQL(search.trim());
    const searchUpper = search.trim().toUpperCase();
    const cards: any[] = [];

    const results = await Promise.all(
      ALL_PHASES.map(async (phase) => {
        const result = await pipefyQuery(`{
          phase(id: ${phase.id}) {
            cards(first: 10, search: { title: "${escaped}" }) {
              edges {
                node {
                  id title due_date
                  current_phase { id name }
                  labels { id name }
                  assignees { id name }
                  comments { id text created_at author_name }
                }
              }
            }
          }
        }`);
        const edges = result?.data?.phase?.cards?.edges || [];
        return edges
          .map((e: any) => e.node)
          .filter((c: any) => c.title.toUpperCase().includes(searchUpper))
          .map((c: any) => {
            const comments = c.comments || [];
            const lastComment = comments[0];
            const phaseId = c.current_phase?.id || phase.id;
            const phaseName = c.current_phase?.name || phase.name;
            const canAdvance = ADVANCE_PHASES.includes(String(phaseId));
            return {
              id: c.id,
              title: c.title,
              phase: phaseName,
              phaseId: String(phaseId),
              due_date: c.due_date || "",
              labels: (c.labels || []).map((l: any) => ({ id: l.id, name: l.name })),
              assignees: (c.assignees || []).map((a: any) => ({ id: a.id, name: a.name })),
              lastComment: lastComment?.text || "",
              lastCommentAuthor: lastComment?.author_name || "",
              canAdvance,
              canReturn: true,
            };
          });
      })
    );

    for (const r of results) cards.push(...r);

    // Deduplicar por ID (card pode aparecer em múltiplas buscas)
    const unique = Array.from(new Map(cards.map((c) => [c.id, c])).values());

    return NextResponse.json({ success: true, cards: unique });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

// POST: Atualizar card (comentário, tags, vencimento, responsável, fase)
export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { cardId, actions: requestedActions } = await req.json();
    const validId = validateCardId(cardId);
    const results: { action: string; status: "ok" | "error"; message: string }[] = [];

    // Comentário
    if (requestedActions.comment) {
      try {
        await createComment(validId, requestedActions.comment);
        results.push({ action: "Comentário", status: "ok", message: "Enviado" });
      } catch (e: any) {
        results.push({ action: "Comentário", status: "error", message: e.message });
      }
    }

    // Tags
    if (requestedActions.labelIds) {
      try {
        if (!Array.isArray(requestedActions.labelIds) || requestedActions.labelIds.some((id: string) => !/^\d+$/.test(id))) {
          return NextResponse.json({ error: "labelIds inválidos — apenas IDs numéricos" }, { status: 400 });
        }
        const labelArray = requestedActions.labelIds.map((id: string) => `"${id}"`).join(", ");
        await pipefyQuery(`mutation { updateCard(input: { id: ${validId}, label_ids: [${labelArray}] }) { card { id } } }`);
        results.push({ action: "Tags", status: "ok", message: "Atualizadas" });
      } catch (e: any) {
        results.push({ action: "Tags", status: "error", message: e.message });
      }
    }

    // Vencimento
    if (requestedActions.dueDate) {
      try {
        const isoDate = `${requestedActions.dueDate}T22:00:00-03:00`;
        await updateDueDate(validId, isoDate);
        results.push({ action: "Vencimento", status: "ok", message: requestedActions.dueDate });
      } catch (e: any) {
        results.push({ action: "Vencimento", status: "error", message: e.message });
      }
    }

    // Responsável
    if (requestedActions.assigneeId) {
      try {
        await updateAssignee(validId, requestedActions.assigneeId);
        results.push({ action: "Responsável", status: "ok", message: "Atualizado" });
      } catch (e: any) {
        results.push({ action: "Responsável", status: "error", message: e.message });
      }
    }

    // Mudar fase
    if (requestedActions.moveToPhaseId) {
      try {
        const validPhaseIds = ALL_PHASES.map((p) => p.id);
        if (!/^\d+$/.test(requestedActions.moveToPhaseId) || !validPhaseIds.includes(requestedActions.moveToPhaseId)) {
          return NextResponse.json({ error: "moveToPhaseId inválido — fase não reconhecida" }, { status: 400 });
        }
        await pipefyQuery(`mutation { moveCardToPhase(input: { card_id: ${validId}, destination_phase_id: ${requestedActions.moveToPhaseId} }) { card { id } } }`);
        const phaseName = ALL_PHASES.find((p) => p.id === requestedActions.moveToPhaseId)?.name || requestedActions.moveToPhaseId;
        results.push({ action: "Fase", status: "ok", message: `→ ${phaseName}` });
      } catch (e: any) {
        results.push({ action: "Fase", status: "error", message: e.message });
      }
    }

    const hasError = results.some((r) => r.status === "error");
    return NextResponse.json({ success: !hasError, results });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
