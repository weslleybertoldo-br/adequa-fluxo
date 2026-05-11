import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, fetchAllCardsFromPhase, createComment, validateCardId, requireAuth, PHASE_5_ID } from "@/lib/pipefy";

// Pipe 0 - Onboarding - fases para buscar tags
const PIPE_0_PHASES = [
  "323192886", "326998147", "323192887", "323290601", "323192888",
  "333705823", "333706135", "323543301", "323192900", "323192905",
  "323665911", "338531443", "323634845", "329664298",
];

// Pipe 2 - Adequação - fases para buscar comentário
const PIPE_2_PHASES = [
  "323529355", "323315791", "323529394", "323529403",
  "333848207", "333848127", "323315793",
];

function getEnxovalStatus(comment: string): "ok" | "pendente" | "comprado" | "propria" | "unknown" {
  if (!comment) return "unknown";
  const lines = comment.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^✔️\s*ENXOVAL/i.test(trimmed)) return "ok";
    if (/^❌\s*ENXOVAL\s*:\s*COMPRADO/i.test(trimmed)) return "comprado";
    if (/^❌\s*ENXOVAL\s*:\s*PROP/i.test(trimmed)) return "propria";
    if (/^❌\s*ENXOVAL/i.test(trimmed)) return "pendente";
  }
  return "unknown";
}

// Buscar tags de um card específico no Pipe 0 por search
async function getTagsFromPipe0(code: string): Promise<string[]> {
  // Buscar em paralelo em todas as fases
  const results = await Promise.all(
    PIPE_0_PHASES.map(async (phaseId) => {
      try {
        const result = await pipefyQuery(`{
          phase(id: ${phaseId}) {
            cards(first: 3, search: { title: "${JSON.stringify(code).slice(1, -1)}" }) {
              edges { node { title labels { name } } }
            }
          }
        }`);
        const edges = result?.data?.phase?.cards?.edges || [];
        const card = edges.find((e: any) => e.node.title.toUpperCase() === code.toUpperCase());
        if (card) return (card.node.labels || []).map((l: any) => l.name);
        return null;
      } catch { return null; }
    })
  );
  // Retornar o primeiro resultado encontrado
  return results.find((r) => r !== null) || [];
}

// Buscar tags para múltiplos códigos em paralelo (3 de cada vez)
async function getTagsForCodes(codes: string[]): Promise<Map<string, string[]>> {
  const tagsMap = new Map<string, string[]>();
  for (let i = 0; i < codes.length; i += 3) {
    const batch = codes.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (code) => ({ code, tags: await getTagsFromPipe0(code) }))
    );
    for (const { code, tags } of results) {
      tagsMap.set(code.toUpperCase(), tags);
    }
  }
  return tagsMap;
}

// Buscar card no Pipe 2 (para pegar comentário e id)
async function getCardFromPipe2(code: string): Promise<{ id: string; lastComment: string } | null> {
  for (const phaseId of PIPE_2_PHASES) {
    try {
      const result = await pipefyQuery(`{
        phase(id: ${phaseId}) {
          cards(first: 3, search: { title: "${JSON.stringify(code).slice(1, -1)}" }) {
            edges { node { id title comments { id text } fields { name value } } }
          }
        }
      }`);
      const edges = result?.data?.phase?.cards?.edges || [];
      const card = edges.find((e: any) => e.node.title.toUpperCase() === code.toUpperCase());
      if (card) {
        const comments = card.node.comments || [];
        return {
          id: card.node.id,
          lastComment: comments[0]?.text || "",
        };
      }
    } catch { /* continua */ }
  }
  return null;
}

// GET: Listar cards da Fase 5 com enxoval pendente
export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const allCards = await fetchAllCardsFromPhase(PHASE_5_ID);

    // Filtrar cards com enxoval pendente primeiro
    const pendentes = [];
    for (const c of allCards) {
      const lastComment = (c.comments || [])[0]?.text || "";
      const status = getEnxovalStatus(lastComment);
      if (status === "pendente") pendentes.push({ ...c, lastComment });
    }

    // Buscar tags do Pipe 0 só para os cards pendentes (em paralelo, 3 de cada vez)
    const codes = pendentes.map((c) => c.title);
    const pipe0Tags = await getTagsForCodes(codes);

    const results = pendentes.map((c) => {
      const tags = pipe0Tags.get(c.title?.toUpperCase()) || [];
      const hasEnxovalComprado = tags.some((t) => t.toUpperCase() === "ENXOVAL COMPRADO");
      const hasCompraPropria = tags.some((t) => t.toUpperCase().includes("ENXOVAL COMPRA PR") || t.toUpperCase().includes("COMPRA PRÓPRIA"));

      return {
        id: c.id,
        title: c.title,
        lastComment: c.lastComment,
        tags,
        hasEnxovalComprado,
        hasCompraPropria,
        enxovalType: hasCompraPropria ? "propria" : hasEnxovalComprado ? "comprado" : "pendente",
      };
    });

    return NextResponse.json({
      success: true,
      totalCards: results.length,
      cards: results,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

// POST: Atualizar enxoval (duas situações: COMPRADO PP CSO ou PROP COMPROU POR CONTA PRÓPRIA)
export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { code, enxovalType } = await req.json();
    if (!code) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });

    const pipe2Card = await getCardFromPipe2(code);
    if (!pipe2Card) {
      return NextResponse.json({ error: `Card "${code}" não encontrado no Pipe 2` }, { status: 404 });
    }

    const cardId = validateCardId(pipe2Card.id);
    const actions: string[] = [];

    // Determinar texto baseado no tipo
    const enxovalText = enxovalType === "propria"
      ? "❌ ENXOVAL: PROP COMPROU POR CONTA PRÓPRIA"
      : "❌ ENXOVAL: COMPRADO - PP CSO";

    // 1. Atualizar comentário
    if (pipe2Card.lastComment) {
      const newComment = pipe2Card.lastComment.replace(
        /❌\s*ENXOVAL[^\n]*/gi,
        enxovalText
      );
      await createComment(cardId, newComment);
      actions.push("Comentário atualizado");
    }

    // 2. Atualizar campo "Validação Enxoval"
    await pipefyQuery(`mutation {
      updateCardField(input: {
        card_id: ${cardId}
        field_id: "valida_o_enxoval"
        new_value: "${enxovalText}"
      }) { success }
    }`);
    actions.push(`Validação Enxoval → ${enxovalText}`);

    return NextResponse.json({ success: true, cardId, details: actions.join(" | ") });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
