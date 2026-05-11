import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, fetchAllCardsFromPhase, updateDueDate, validateCardId,
  toBrazilDate, formatDateBR, requireAuth, PHASE_3_ID, PHASE_4_ID, PHASE_5_ID,
} from "@/lib/pipefy";

function getPhaseLabel(phaseId: string): string {
  if (phaseId === PHASE_3_ID) return "Fase 3";
  if (phaseId === PHASE_4_ID) return "Fase 4";
  if (phaseId === PHASE_5_ID) return "Fase 5";
  return "Outra";
}

// GET: Buscar cards das fases 3, 4 e 5 por data de vencimento
export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const dateParam = req.nextUrl.searchParams.get("date"); // YYYY-MM-DD
    const countOnly = req.nextUrl.searchParams.get("countOnly") === "true";

    const phases = [
      { id: PHASE_3_ID, label: "Fase 3" },
      { id: PHASE_4_ID, label: "Fase 4" },
      { id: PHASE_5_ID, label: "Fase 5" },
    ];

    // Se countOnly, buscar contagem para múltiplas datas
    if (countOnly) {
      const rawDates = req.nextUrl.searchParams.get("dates")?.split(",") || [];
      const dates = rawDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      const allCards: { due_date: string }[] = [];

      for (const phase of phases) {
        const cards = await fetchAllCardsFromPhase(phase.id);
        for (const c of cards) {
          if (c.due_date) allCards.push({ due_date: c.due_date });
        }
      }

      const counts: Record<string, number> = {};
      for (const d of dates) {
        counts[d] = 0;
      }
      for (const c of allCards) {
        const br = toBrazilDate(new Date(c.due_date));
        const dateStr = `${br.year}-${String(br.month + 1).padStart(2, "0")}-${String(br.day).padStart(2, "0")}`;
        if (counts[dateStr] !== undefined) {
          counts[dateStr]++;
        }
      }

      return NextResponse.json({ success: true, counts });
    }

    if (!dateParam) {
      return NextResponse.json({ error: "Parâmetro 'date' obrigatório (YYYY-MM-DD)" }, { status: 400 });
    }

    const [targetYear, targetMonth, targetDay] = dateParam.split("-").map(Number);
    const allCards: any[] = [];

    for (const phase of phases) {
      const cards = await fetchAllCardsFromPhase(phase.id);
      for (const c of cards) {
        if (!c.due_date) continue;
        const br = toBrazilDate(new Date(c.due_date));
        if (br.year === targetYear && br.month + 1 === targetMonth && br.day === targetDay) {
          allCards.push({
            id: c.id,
            title: c.title,
            phase: phase.label,
            phaseId: phase.id,
            due_date: c.due_date,
            dueFormatted: `${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")}/${br.year}`,
            assignees: (c.assignees || []).map((a: any) => a.name),
            labels: (c.labels || []).map((l: any) => l.name),
          });
        }
      }
    }

    allCards.sort((a, b) => {
      const phaseOrder = ["Fase 3", "Fase 4", "Fase 5"];
      return phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase) || a.title.localeCompare(b.title);
    });

    return NextResponse.json({ success: true, totalCards: allCards.length, cards: allCards });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

// POST: Alterar vencimento de um card
export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { cardId, newDate } = await req.json(); // newDate = "YYYY-MM-DD"
    const validId = validateCardId(cardId);

    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return NextResponse.json({ error: "Data inválida (use YYYY-MM-DD)" }, { status: 400 });
    }

    const isoDate = `${newDate}T22:00:00-03:00`;
    await updateDueDate(validId, isoDate);
    const br = toBrazilDate(new Date(isoDate));
    const formatted = `${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")}/${br.year}`;

    return NextResponse.json({ success: true, details: `Vencimento → ${formatted} 22:00` });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
