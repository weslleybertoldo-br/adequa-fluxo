import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { fetchAllCardsFromPhase, toBrazilDate, requireAuth, PHASE_3_ID } from "@/lib/pipefy";

function normalize(str: string): string {
  return str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isComplexa(card: any): boolean {
  return (card.labels || []).some((l: any) => normalize(l.name || "").includes("ADEQUACAO COMPLEXA"));
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const cards = await fetchAllCardsFromPhase(PHASE_3_ID);
    const complexaCards = cards.filter(isComplexa);

    return NextResponse.json({
      success: true,
      totalCards: complexaCards.length,
      cards: complexaCards.map((c) => {
        const lastComment = (c.comments || [])[0];
        const br = c.due_date ? toBrazilDate(new Date(c.due_date)) : null;
        const dueFormatted = br
          ? `${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")}/${br.year}`
          : "Sem vencimento";
        return {
          id: c.id,
          title: c.title,
          due_date: c.due_date,
          dueFormatted,
          assignees: (c.assignees || []).map((a: any) => a.name),
          labels: (c.labels || []).map((l: any) => l.name),
          lastComment: lastComment?.text || "",
          lastCommentAuthor: lastComment?.author_name || "",
          lastCommentDate: lastComment?.created_at || "",
        };
      }),
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
