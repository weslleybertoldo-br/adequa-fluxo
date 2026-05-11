import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, fetchAllCardsFromPhase, searchCardInPhase, updateDueDate, updateAssignee, createComment,
  validateCardId, toBrazilDate, formatDateBR, isDueToday, getNextBusinessDayAt22,
  replaceCommentFupDate, requireAuth, PHASE_3_ID, PHASE_4_ID, WESLLEY_USER_ID,
} from "@/lib/pipefy";
import { SLACK, PIPEFY_TAG } from "@/lib/config";

const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN || "";
const BRUNO_ID = SLACK.USER_BRUNO;

async function sendSlackDM(userId: string, text: string) {
  // Abrir conversa DM
  const openRes = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ users: userId }),
  });
  const openData = await openRes.json();
  if (!openData.ok) throw new Error(`Slack open: ${openData.error}`);

  // Enviar mensagem
  const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_USER_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: openData.channel.id, text }),
  });
  const msgData = await msgRes.json();
  if (!msgData.ok) throw new Error(`Slack msg: ${msgData.error}`);
}

const TAG_ADEQUACAO_COMPLEXA = "314328534";
const TAG_ITENS_PEQUENOS = PIPEFY_TAG.ITENS_PEQUENOS;
const TAG_MANUTENCOES_PEQUENAS = PIPEFY_TAG.MANUT_PEQUENAS;
const TAG_PIN = "312148103";

function normalize(str: string): string {
  return str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasTag(card: any, tagSearch: string): boolean {
  return (card.labels || []).some((l: any) => normalize(l.name || "").includes(normalize(tagSearch)));
}

function classifyCard(card: any): "complexa" | "revisao" | "none" {
  const isComplexa = hasTag(card, "ADEQUACAO COMPLEXA");
  const isRevisaoFinalizada = hasTag(card, "REVISAO DE PENDENCIAS FINALIZADA");

  if (isComplexa) return "complexa";
  if (isRevisaoFinalizada && !isComplexa) return "revisao";
  return "none";
}

// GET: Listar cards da Fase 3 separados por tipo
export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const search = req.nextUrl.searchParams.get("search");

    const formatCard = (c: any) => {
      const lastComment = (c.comments || [])[0];
      const br = c.due_date ? toBrazilDate(new Date(c.due_date)) : null;
      const dueFormatted = br ? `${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")}/${br.year}` : "Sem vencimento";
      return {
        id: c.id, title: c.title, type: classifyCard(c), due_date: c.due_date, dueFormatted,
        assignees: (c.assignees || []).map((a: any) => a.name),
        labels: (c.labels || []).map((l: any) => l.name),
        labelIds: (c.labels || []).map((l: any) => l.id),
        lastComment: lastComment?.text || "", lastCommentAuthor: lastComment?.author_name || "", lastCommentDate: lastComment?.created_at || "",
      };
    };

    if (search) {
      const card = await searchCardInPhase(PHASE_3_ID, search);
      if (!card) return NextResponse.json({ success: true, totalCards: 0, complexaCount: 0, revisaoCount: 0, cards: [] });
      const formatted = formatCard(card);
      return NextResponse.json({
        success: true, totalCards: 1,
        complexaCount: formatted.type === "complexa" ? 1 : 0,
        revisaoCount: formatted.type === "revisao" ? 1 : 0,
        cards: formatted.type !== "none" ? [formatted] : [],
      });
    }

    const cards = await fetchAllCardsFromPhase(PHASE_3_ID);
    const todayCards = cards.filter((c) => c.due_date && isDueToday(c.due_date));
    const result = todayCards.map(formatCard);

    const complexa = result.filter((r) => r.type === "complexa");
    const revisao = result.filter((r) => r.type === "revisao");

    return NextResponse.json({
      success: true,
      totalCards: cards.length,
      complexaCount: complexa.length,
      revisaoCount: revisao.length,
      cards: result,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

// POST: Atualizar card (complexa: +1 dia útil com FUP | revisao: +2 dias úteis com comentário customizado)
export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const { cardId, type, customComment, isComplexa, addItensPequenos, addManutencoesPequenas, addPin, extraDays = 0 } = await req.json();
    const validId = validateCardId(cardId);

    if (type === "complexa") {
      const newDueDate = getNextBusinessDayAt22(1 + extraDays);
      const newDueDateBR = formatDateBR(newDueDate);
      const actions: string[] = [];

      await updateDueDate(validId, newDueDate);
      actions.push(`Vencimento → ${newDueDateBR} 22:00`);

      const result = await pipefyQuery(`{
        card(id: ${validId}) { id title labels { id } comments { id text } }
      }`);
      const card = result?.data?.card;
      const comments = card?.comments || [];
      const lastComment = comments[0];

      if (lastComment?.text) {
        const newText = replaceCommentFupDate(lastComment.text, newDueDateBR);
        await createComment(validId, newText);
        actions.push("Comentário adicionado");
      }

      return NextResponse.json({ success: true, action: "updated", details: actions.join(" | ") });
    }

    if (type === "complexa_update") {
      const actions: string[] = [];

      // Buscar card para labels
      const result = await pipefyQuery(`{
        card(id: ${validId}) { id title labels { id } }
      }`);
      const card = result?.data?.card;
      const currentLabels: string[] = (card?.labels || []).map((l: any) => l.id);

      if (isComplexa) {
        // Manter complexa: +1 dia, atualizar tags conforme checkboxes
        const newDueDate = getNextBusinessDayAt22(1 + extraDays);
        const newDueDateBR = formatDateBR(newDueDate);
        await updateDueDate(validId, newDueDate);
        actions.push(`Vencimento → ${newDueDateBR} 22:00`);

        // Garantir tag complexa + adicionar/remover itens/manut/pin
        const newLabels = currentLabels.filter((id) => id !== TAG_ITENS_PEQUENOS && id !== TAG_MANUTENCOES_PEQUENAS && id !== TAG_PIN);
        if (!newLabels.includes(TAG_ADEQUACAO_COMPLEXA)) newLabels.push(TAG_ADEQUACAO_COMPLEXA);
        if (addItensPequenos) newLabels.push(TAG_ITENS_PEQUENOS);
        if (addManutencoesPequenas) newLabels.push(TAG_MANUTENCOES_PEQUENAS);
        if (addPin) newLabels.push(TAG_PIN);
        const labelArray = [...new Set(newLabels)].map((id) => `"${id}"`).join(", ");
        await pipefyQuery(`mutation { updateCard(input: { id: ${validId}, label_ids: [${labelArray}] }) { card { id } } }`);
        actions.push("Tags atualizadas");
      } else {
        // Desmarcar complexa: +2 dias, remover tag complexa, mover fase 4
        const newDueDate = getNextBusinessDayAt22(2 + extraDays);
        const newDueDateBR = formatDateBR(newDueDate);
        await updateDueDate(validId, newDueDate);
        actions.push(`Vencimento → ${newDueDateBR} 22:00`);

        // Remover tag complexa + adicionar/remover itens/manut/pin
        const newLabels = currentLabels.filter((id) => id !== TAG_ADEQUACAO_COMPLEXA && id !== TAG_ITENS_PEQUENOS && id !== TAG_MANUTENCOES_PEQUENAS && id !== TAG_PIN);
        if (addItensPequenos) newLabels.push(TAG_ITENS_PEQUENOS);
        if (addManutencoesPequenas) newLabels.push(TAG_MANUTENCOES_PEQUENAS);
        if (addPin) newLabels.push(TAG_PIN);
        const labelArray = [...new Set(newLabels)].map((id) => `"${id}"`).join(", ");
        await pipefyQuery(`mutation { updateCard(input: { id: ${validId}, label_ids: [${labelArray}] }) { card { id } } }`);
        actions.push("Tag Complexa removida");

        // Campos obrigatórios
        await pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "envio_de_mensagem_quando_n_o_tiver_mais_pend_ncias_complexas", new_value: "Mensagem enviada" }) { success } }`);
        await pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "revis_o_de_pend_ncias_finalizada", new_value: "Revisão realizada" }) { success } }`);
        actions.push("Campos obrigatórios preenchidos");

        // Mover para Fase 4
        await pipefyQuery(`mutation { moveCardToPhase(input: { card_id: ${validId}, destination_phase_id: ${PHASE_4_ID} }) { card { id } } }`);
        actions.push("Card → Fase 4");
      }

      // Comentário
      if (customComment) {
        await createComment(validId, customComment);
        actions.push("Comentário atualizado");
      }

      // Enviar DM no Slack para Bruno (somente quando Complexa desmarcado → card vai para Fase 4)
      if (!isComplexa && SLACK_USER_TOKEN && card?.title) {
        try {
          await sendSlackDM(BRUNO_ID, `${card.title} - Liberado ✅`);
          actions.push("Slack DM → Bruno");
        } catch (e: unknown) {
          actions.push(`Slack DM erro: ${e instanceof Error ? e.message : "erro"}`);
        }
      } else if (!isComplexa && !SLACK_USER_TOKEN) {
        actions.push("Slack DM não enviado (token não configurado)");
      }

      return NextResponse.json({ success: true, action: "updated", details: actions.join(" | ") });
    }

    if (type === "revisao_update_comment") {
      if (!customComment) return NextResponse.json({ error: "Comentário obrigatório" }, { status: 400 });
      await createComment(validId, customComment);
      return NextResponse.json({ success: true, action: "updated", details: "Comentário adicionado" });
    }

    if (type === "revisao") {
      const actions: string[] = [];

      // Buscar card para labels
      const result = await pipefyQuery(`{
        card(id: ${validId}) { id title labels { id } comments { id text } }
      }`);
      const card = result?.data?.card;
      const currentLabels: string[] = (card?.labels || []).map((l: any) => l.id);

      // 1. Mudar responsável para Weslley
      await updateAssignee(validId, WESLLEY_USER_ID);
      actions.push("Responsável → Weslley");

      if (isComplexa) {
        // Complexa: +1 dia, tag adequação complexa, não muda de fase
        const newDueDate = getNextBusinessDayAt22(1 + extraDays);
        const newDueDateBR = formatDateBR(newDueDate);

        await updateDueDate(validId, newDueDate);
        actions.push(`Vencimento → ${newDueDateBR} 22:00`);

        // Adicionar tags
        const newLabels = currentLabels.filter((id) => id !== TAG_ITENS_PEQUENOS && id !== TAG_MANUTENCOES_PEQUENAS && id !== TAG_PIN);
        if (!newLabels.includes(TAG_ADEQUACAO_COMPLEXA)) newLabels.push(TAG_ADEQUACAO_COMPLEXA);
        if (addItensPequenos) newLabels.push(TAG_ITENS_PEQUENOS);
        if (addManutencoesPequenas) newLabels.push(TAG_MANUTENCOES_PEQUENAS);
        if (addPin) newLabels.push(TAG_PIN);
        const uniqueLabels = [...new Set(newLabels)];
        const labelArray = uniqueLabels.map((id) => `"${id}"`).join(", ");
        await pipefyQuery(`mutation {
          updateCard(input: { id: ${validId}, label_ids: [${labelArray}] }) { card { id } }
        }`);
        actions.push("Tag Adequação Complexa adicionada");
        if (addItensPequenos) actions.push("Tag Itens pequenos");
        if (addManutencoesPequenas) actions.push("Tag Manutenções pequenas");
        if (addPin) actions.push("Tag PIN");

        // Comentário com FUP do dia seguinte
        if (customComment) {
          await createComment(validId, customComment);
          actions.push("Comentário adicionado");
        }
      } else {
        // Normal: +2 dias, mover para fase 4
        const newDueDate = getNextBusinessDayAt22(2 + extraDays);
        const newDueDateBR = formatDateBR(newDueDate);

        await updateDueDate(validId, newDueDate);
        actions.push(`Vencimento → ${newDueDateBR} 22:00`);

        // Adicionar/remover tags conforme checkboxes
        const newLabels = currentLabels.filter((id) => id !== TAG_ITENS_PEQUENOS && id !== TAG_MANUTENCOES_PEQUENAS && id !== TAG_PIN);
        if (addItensPequenos) newLabels.push(TAG_ITENS_PEQUENOS);
        if (addManutencoesPequenas) newLabels.push(TAG_MANUTENCOES_PEQUENAS);
        if (addPin) newLabels.push(TAG_PIN);
        const uniqueLabels = [...new Set(newLabels)];
        if (uniqueLabels.length !== currentLabels.length || !uniqueLabels.every((id) => currentLabels.includes(id))) {
          const labelArray = uniqueLabels.map((id) => `"${id}"`).join(", ");
          await pipefyQuery(`mutation {
            updateCard(input: { id: ${validId}, label_ids: [${labelArray}] }) { card { id } }
          }`);
          actions.push("Tags atualizadas");
        }

        // Comentário customizado
        if (customComment) {
          await createComment(validId, customComment);
          actions.push("Comentário adicionado");
        }

        // Preencher campos obrigatórios antes de mover
        await pipefyQuery(`mutation {
          updateCardField(input: { card_id: ${validId}, field_id: "envio_de_mensagem_quando_n_o_tiver_mais_pend_ncias_complexas", new_value: "Mensagem enviada" }) { success }
        }`);
        await pipefyQuery(`mutation {
          updateCardField(input: { card_id: ${validId}, field_id: "revis_o_de_pend_ncias_finalizada", new_value: "Revisão realizada" }) { success }
        }`);
        actions.push("Campos obrigatórios preenchidos");

        // Mover para Fase 4
        await pipefyQuery(`mutation {
          moveCardToPhase(input: { card_id: ${validId}, destination_phase_id: ${PHASE_4_ID} }) {
            card { id current_phase { name } }
          }
        }`);
        actions.push("Card → Fase 4");
      }

      return NextResponse.json({ success: true, action: "updated", details: actions.join(" | ") });
    }

    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
