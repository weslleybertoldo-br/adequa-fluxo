import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, fetchAllCardsFromPhase, searchCardInPhase, updateDueDate, updateAssignee, createComment,
  validateCardId, toBrazilDate, formatDateBR, isDueToday, getNextBusinessDayAt22,
  replaceCommentFupDate, requireAuth, fetchPipe1PhaseMap, PHASE_4_ID, WESLLEY_USER_ID,
} from "@/lib/pipefy";
import { PIPEFY_TAG } from "@/lib/config";
import { getSectionStatus } from "@/lib/comment-parser";

const TAG_ITENS_PEQUENOS = PIPEFY_TAG.ITENS_PEQUENOS;
const TAG_MANUT_PEQUENAS = PIPEFY_TAG.MANUT_PEQUENAS;
const TAG_PIN = "312148103";

function shouldSkipCard(card: any): { skip: boolean; reason: string } {
  const assignees = card.assignees || [];
  const isWeslley = assignees.some((a: any) =>
    a.name?.toLowerCase().includes("weslley") || a.id === "305932218"
  );
  if (!isWeslley) {
    const resp = assignees.map((a: any) => a.name).join(", ") || "Sem responsável";
    return { skip: true, reason: `Responsável: ${resp} (não é Weslley)` };
  }
  if (!card.due_date) return { skip: true, reason: "Sem vencimento definido" };
  if (!isDueToday(card.due_date)) {
    const br = toBrazilDate(new Date(card.due_date));
    return { skip: true, reason: `Vencimento em ${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")} (não é hoje)` };
  }
  return { skip: false, reason: "" };
}

async function processCard(card: any, extraDays = 0, customComment?: string): Promise<{
  cardId: string; title: string; action: "skipped" | "updated" | "error"; details: string;
}> {
  try {
    // Se tem customComment, não pula (é envio manual)
    if (!customComment) {
      const skipCheck = shouldSkipCard(card);
      if (skipCheck.skip) {
        return { cardId: card.id, title: card.title, action: "skipped", details: skipCheck.reason };
      }
    }

    const newDueDate = getNextBusinessDayAt22(2 + extraDays);
    const newDueDateBR = formatDateBR(newDueDate);
    const actions: string[] = [];

    await updateDueDate(card.id, newDueDate);
    actions.push(`Vencimento → ${newDueDateBR} 22:00`);

    // Atualizar responsável para Weslley (só no envio manual)
    if (customComment) {
      const assignees = card.assignees || [];
      const isWeslley = assignees.some((a: any) =>
        a.id === WESLLEY_USER_ID || a.name?.toLowerCase().includes("weslley")
      );
      if (!isWeslley) {
        await updateAssignee(card.id, WESLLEY_USER_ID);
        actions.push("Responsável → Weslley Bertoldo");
      }
    }

    if (customComment) {
      // Atualizar tags baseado no comentário editado
      const itensStatus = getSectionStatus(customComment, "ITENS");
      const manutStatus = getSectionStatus(customComment, "MANUTEN");
      let currentLabels: string[] = (card.labels || []).map((l: any) => l.id);
      let labelsChanged = false;

      // ITENS: ❌ adiciona tag, ✔️ remove
      if (itensStatus === "❌" && !currentLabels.includes(TAG_ITENS_PEQUENOS)) {
        currentLabels.push(TAG_ITENS_PEQUENOS);
        labelsChanged = true;
        actions.push("Tag Itens pequenos adicionada");
      } else if (itensStatus === "✔️" && currentLabels.includes(TAG_ITENS_PEQUENOS)) {
        currentLabels = currentLabels.filter((id) => id !== TAG_ITENS_PEQUENOS);
        labelsChanged = true;
        actions.push("Tag Itens pequenos removida");
      }

      // MANUTENÇÃO: ❌ adiciona tag, ✔️ remove
      if (manutStatus === "❌" && !currentLabels.includes(TAG_MANUT_PEQUENAS)) {
        currentLabels.push(TAG_MANUT_PEQUENAS);
        labelsChanged = true;
        actions.push("Tag Manutenções pequenas adicionada");
      } else if (manutStatus === "✔️" && currentLabels.includes(TAG_MANUT_PEQUENAS)) {
        currentLabels = currentLabels.filter((id) => id !== TAG_MANUT_PEQUENAS);
        labelsChanged = true;
        actions.push("Tag Manutenções pequenas removida");
      }

      // PIN: sempre remover
      if (currentLabels.includes(TAG_PIN)) {
        currentLabels = currentLabels.filter((id) => id !== TAG_PIN);
        labelsChanged = true;
        actions.push("Tag PIN removida");
      }

      if (labelsChanged) {
        const uniqueLabels = [...new Set(currentLabels)];
        const labelArray = uniqueLabels.map((id) => `"${id}"`).join(", ");
        await pipefyQuery(`mutation { updateCard(input: { id: ${card.id}, label_ids: [${labelArray}] }) { card { id } } }`);
      }

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
        searchCardInPhase(PHASE_4_ID, search),
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
      fetchAllCardsFromPhase(PHASE_4_ID),
      fetchPipe1PhaseMap(),
    ]);
    const skipMap = cards.map((c) => ({ card: c, ...shouldSkipCard(c) }));

    return NextResponse.json({
      success: true,
      totalCards: cards.length,
      toUpdate: skipMap.filter((s) => !s.skip).length,
      toSkip: skipMap.filter((s) => s.skip).length,
      cards: skipMap
        .map((s) => {
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
        })
        .sort((a, b) => {
          // Cards com outro responsável (não Weslley) primeiro
          const aIsWeslley = a.assignees.some((n: string) => n.toLowerCase().includes("weslley"));
          const bIsWeslley = b.assignees.some((n: string) => n.toLowerCase().includes("weslley"));
          if (aIsWeslley !== bIsWeslley) return aIsWeslley ? 1 : -1;
          return a.title.localeCompare(b.title);
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

    const processResult = await processCard(card, extraDays, customComment);
    return NextResponse.json({ success: true, ...processResult });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
