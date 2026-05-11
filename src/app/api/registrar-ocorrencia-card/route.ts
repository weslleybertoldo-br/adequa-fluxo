import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, createComment, validateCardId, requireAuth, toBrazilDate, PHASE_3_ID, PHASE_4_ID, PHASE_5_ID } from "@/lib/pipefy";

const LABEL_OCORRENCIA_ID = "315919223"; // OCORRÊNCIA REGISTRADA

// Buscar card no Pipe 2 (fases 3, 4, 5)
async function findCardInPipe2(code: string): Promise<{ id: string; lastComment: string; labelIds: string[] } | null> {
  const phases = [PHASE_3_ID, PHASE_4_ID, PHASE_5_ID];
  for (const phaseId of phases) {
    try {
      const result = await pipefyQuery(`{
        phase(id: ${phaseId}) {
          cards(first: 3, search: { title: "${JSON.stringify(code).slice(1, -1)}" }) {
            edges {
              node {
                id title
                labels { id name }
                comments { id text }
              }
            }
          }
        }
      }`);
      const edges = result?.data?.phase?.cards?.edges || [];
      const card = edges.find((e: any) => e.node.title.toUpperCase() === code.toUpperCase());
      if (card) {
        return {
          id: card.node.id,
          lastComment: (card.node.comments || [])[0]?.text || "",
          labelIds: (card.node.labels || []).map((l: any) => l.id),
        };
      }
    } catch { /* continua */ }
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });

    const card = await findCardInPipe2(code);
    if (!card) return NextResponse.json({ error: `Card "${code}" não encontrado nas fases 3-5` }, { status: 404 });

    const cardId = validateCardId(card.id);
    const actions: string[] = [];

    // Data de hoje em formato DD/MM
    const today = toBrazilDate(new Date());
    const dd = String(today.day).padStart(2, "0");
    const mm = String(today.month + 1).padStart(2, "0");
    const todayStr = `${dd}/${mm}`;

    // 1. Inserir "Ocorrência registrada | DD/MM" abaixo da linha do FUP
    if (card.lastComment) {
      const lines = card.lastComment.split("\n");
      const newLines: string[] = [];
      let inserted = false;

      for (const line of lines) {
        newLines.push(line);
        if (!inserted && /FUP:?\s*\d{2}[\/\.]\d{2}/i.test(line)) {
          newLines.push("");
          newLines.push(`Ocorrência registrada | ${todayStr}`);
          inserted = true;
        }
      }

      // Se não encontrou FUP, insere no início
      if (!inserted) {
        newLines.splice(0, 0, `Ocorrência registrada | ${todayStr}`, "");
      }

      await createComment(cardId, newLines.join("\n"));
      actions.push("Comentário atualizado");
    } else {
      await createComment(cardId, `Ocorrência registrada | ${todayStr}`);
      actions.push("Comentário criado");
    }

    // 2. Adicionar tag "OCORRÊNCIA REGISTRADA" se não tiver
    if (!card.labelIds.includes(LABEL_OCORRENCIA_ID)) {
      const allLabels = [...card.labelIds, LABEL_OCORRENCIA_ID];
      const labelArray = allLabels.map((id) => `"${id}"`).join(", ");
      await pipefyQuery(`mutation {
        updateCard(input: { id: ${cardId}, label_ids: [${labelArray}] }) {
          card { id }
        }
      }`);
      actions.push("Tag OCORRÊNCIA REGISTRADA adicionada");
    } else {
      actions.push("Tag já existia");
    }

    return NextResponse.json({ success: true, cardId, details: actions.join(" | ") });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
