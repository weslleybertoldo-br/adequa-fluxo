import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, fetchAllCardsFromPhase, searchCardInPhase, updateDueDate, updateAssignee, createComment,
  validateCardId, toBrazilDate, formatDateBR, isDueToday, getNextBusinessDayAt22,
  replaceCommentFupDate, hasSkipTag, requireAuth, fetchPipe1PhaseMap,
  PHASE_3_ID,
} from "@/lib/pipefy";
import { getResponsavel, isResponsavel, type Responsavel } from "@/lib/responsavel";

function shouldSkipCard(card: any): { skip: boolean; reason: string } {
  const tagCheck = hasSkipTag(card);
  if (tagCheck.skip) return tagCheck;

  if (!card.due_date) return { skip: true, reason: "Sem vencimento definido" };

  if (!isDueToday(card.due_date)) {
    const br = toBrazilDate(new Date(card.due_date));
    return { skip: true, reason: `Vencimento em ${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")} (não é hoje)` };
  }

  return { skip: false, reason: "" };
}

async function processCard(card: any, resp: Responsavel, extraDays = 0, customComment?: string): Promise<{
  cardId: string; title: string; action: "skipped" | "updated" | "error"; details: string;
}> {
  try {
    if (!customComment) {
      const skipCheck = shouldSkipCard(card);
      if (skipCheck.skip) {
        return { cardId: card.id, title: card.title, action: "skipped", details: skipCheck.reason };
      }
    }

    const newDueDate = getNextBusinessDayAt22(1 + extraDays);
    const newDueDateBR = formatDateBR(newDueDate);
    const actions: string[] = [];

    await updateDueDate(card.id, newDueDate);
    actions.push(`Vencimento → ${newDueDateBR} 22:00`);

    const assignees = card.assignees || [];
    if (!isResponsavel(assignees, resp)) {
      await updateAssignee(card.id, resp.id);
      actions.push(`Responsável → ${resp.name}`);
    } else {
      actions.push(`Responsável mantido (${resp.name})`);
    }

    if (customComment) {
      await createComment(card.id, customComment);
      actions.push("Comentário editado enviado");
    } else {
      const comments = card.comments || [];
      const lastComment = comments[0];
      if (lastComment?.text) {
        const newText = replaceCommentFupDate(lastComment.text, newDueDateBR);
        await createComment(card.id, newText);
        actions.push("Comentário adicionado");
      } else {
        actions.push("Sem comentário anterior");
      }
    }

    return { cardId: card.id, title: card.title, action: "updated", details: actions.join(" | ") };
  } catch (err: unknown) {
    return { cardId: card.id, title: card.title, action: "error", details: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const search = req.nextUrl.searchParams.get("search");

    if (search) {
      const [card, pipe1Map] = await Promise.all([
        searchCardInPhase(PHASE_3_ID, search),
        fetchPipe1PhaseMap(),
      ]);
      if (!card) return NextResponse.json({ success: true, totalCards: 0, toUpdate: 0, toSkip: 0, cards: [] });
      const skipCheck = shouldSkipCard(card);
      return NextResponse.json({
        success: true, totalCards: 1, toUpdate: skipCheck.skip ? 0 : 1, toSkip: skipCheck.skip ? 1 : 0,
        cards: [{
          id: card.id, title: card.title,
          labels: (card.labels || []).map((l: any) => l.name),
          assignees: (card.assignees || []).map((a: any) => a.name),
          due_date: card.due_date, skip: skipCheck.skip, skipReason: skipCheck.reason,
          pipe1Phase: pipe1Map.get(card.title?.toUpperCase().trim() || "") || "",
        }],
      });
    }

    const [cards, pipe1Map] = await Promise.all([
      fetchAllCardsFromPhase(PHASE_3_ID),
      fetchPipe1PhaseMap(),
    ]);
    const skipMap = cards.map((c) => ({ card: c, ...shouldSkipCard(c) }));

    return NextResponse.json({
      success: true,
      totalCards: cards.length,
      toUpdate: skipMap.filter((s) => !s.skip).length,
      toSkip: skipMap.filter((s) => s.skip).length,
      cards: skipMap.map((s) => {
        const comments = s.card.comments || [];
        const lastComment = comments[0];
        const firstComment = comments[comments.length - 1];
        return {
          id: s.card.id,
          title: s.card.title,
          labels: (s.card.labels || []).map((l: any) => l.name),
          assignees: (s.card.assignees || []).map((a: any) => a.name),
          due_date: s.card.due_date,
          skip: s.skip,
          skipReason: s.reason,
          lastComment: lastComment?.text || "",
          lastCommentAuthor: lastComment?.author_name || "",
          firstComment: firstComment?.text || "",
          pipe1Phase: pipe1Map.get(s.card.title?.toUpperCase().trim() || "") || "",
        };
      }),
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { cardId, extraDays = 0, customComment } = await req.json();
    const validId = validateCardId(cardId);

    const result = await pipefyQuery(`{
      card(id: ${validId}) {
        id title due_date
        labels { id name }
        assignees { id name email }
        comments { id text created_at author_name }
      }
    }`);

    const card = result?.data?.card;
    if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

    const resp = await getResponsavel();
    const processResult = await processCard(card, resp, extraDays, customComment);
    return NextResponse.json({ success: true, ...processResult });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
