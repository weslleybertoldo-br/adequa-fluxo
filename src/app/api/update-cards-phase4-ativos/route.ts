import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, fetchAllCardsFromPhase, validateCardId,
  createComment, updateDueDate, getNextBusinessDayAt22,
  formatDateBR, toBrazilDate, requireAuth, PHASE_4_ID, PHASE_5_ID,
} from "@/lib/pipefy";
import { PIPEFY_TAG } from "@/lib/config";

const PIPE_1_PHASE_10 = "326702699";
const IMOVEL_ATIVO_TAG = "314317045";

// Tags de enxoval/itens/manutenção
const TAG_COMPRAR_ENXOVAL = PIPEFY_TAG.COMPRAR_ENXOVAL;
const TAG_ENTREGAR_ENXOVAL = PIPEFY_TAG.ENTREGAR_ENXOVAL;
const TAG_VALIDAR_ENXOVAL = PIPEFY_TAG.VALIDAR_ENXOVAL;
const TAG_ITENS_PEQUENOS = PIPEFY_TAG.ITENS_PEQUENOS;
const TAG_MANUT_PEQUENAS = PIPEFY_TAG.MANUT_PEQUENAS;

// GET: Lista cards da Fase 4 que tambem existem na Fase 10 do Pipe 1
export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    // Buscar cards da fase 10 do Pipe 1 e da Fase 4 do Pipe de Enxoval
    const [phase10Cards, phase4Cards] = await Promise.all([
      fetchAllCardsFromPhase(PIPE_1_PHASE_10),
      fetchAllCardsFromPhase(PHASE_4_ID),
    ]);

    // Montar map de titulo normalizado → fase do Pipe 1
    const ativosTitleToPhase = new Map<string, string>();
    for (const c of phase10Cards) {
      if (!c.title) continue;
      ativosTitleToPhase.set(c.title.toUpperCase().trim(), "Fase 10");
    }

    // Filtrar cards da Fase 4 que existem na fase 10
    const matched = phase4Cards.filter((c: any) =>
      c.title && ativosTitleToPhase.has(c.title.toUpperCase().trim())
    );

    const cards = matched.map((c: any) => {
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
        pipe1Phase: ativosTitleToPhase.get(c.title.toUpperCase().trim()) || "",
        lastComment: lastComment?.text || "",
        lastCommentAuthor: lastComment?.author_name || "",
        lastCommentDate: lastComment?.created_at || "",
      };
    });

    return NextResponse.json({ success: true, totalCards: cards.length, cards });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

// Filtra itens pendentes: remove linhas que começam com ✅/✔️ ou que têm texto após ";" na mesma linha
function filterPendingItems(rawContent: string): string {
  const fullText = rawContent.trim();
  if (!fullText) return "";

  const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
  const pending: string[] = [];
  for (const line of lines) {
    // Linha com ✅ ou ✔️ no início → resolvida
    if (/^[✅✔]/.test(line) || line.startsWith("✔️")) continue;
    // Linha com texto após ";" → justificativa/exceção → resolvida
    const semiIdx = line.indexOf(";");
    if (semiIdx >= 0) {
      const afterSemi = line.slice(semiIdx + 1).trim();
      if (afterSemi.length > 0) continue;
    }
    pending.push(line);
  }
  if (pending.length === 0) return "";
  return pending.join("\n");
}

// Parseia seções do comentário entre emojis
function parseSections(text: string): {
  enxoval: { status: string; content: string; titleLine: string };
  itens: { status: string; content: string };
  manutencao: { status: string; content: string };
} {
  const lines = text.split("\n");

  const findSection = (keyword: string): { status: string; content: string; titleLine: string } => {
    let startIdx = -1;
    let status = "";
    let titleLine = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(new RegExp(`^[❌✔✅]`, "i")) && line.toUpperCase().includes(keyword.toUpperCase())) {
        startIdx = i;
        status = line.startsWith("❌") ? "❌" : "✔️";
        titleLine = line;
        break;
      }
    }
    if (startIdx === -1) return { status: "", content: "", titleLine: "" };

    // Coletar linhas até o próximo emoji de seção ou fim
    const contentLines: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^[❌✔✅]\s*(ENXOVAL|ITENS|MANUTENÇÃO|MANUTEN|INTERNET|PIN)/i) || line.match(/^✔️\s*(ENXOVAL|ITENS|MANUTENÇÃO|MANUTEN|INTERNET|PIN)/i)) break;
      contentLines.push(lines[i]);
    }

    const rawContent = contentLines.join("\n").trim();

    return {
      status,
      content: status === "❌" ? filterPendingItems(rawContent) : "",
      titleLine,
    };
  };

  return {
    enxoval: findSection("ENXOVAL"),
    itens: findSection("ITENS"),
    manutencao: findSection("MANUTEN"),
  };
}

// Monta novo comentario para card ativo
function buildNewComment(oldText: string, newDueDateBR: string): string {
  const newShort = newDueDateBR.slice(0, 5); // DD/MM

  // Encontrar a linha do FUP
  const lines = oldText.split("\n");
  let fupIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/FUP:?\s*\d{2}[\/\.]\d{2}/i)) {
      fupIdx = i;
      break;
    }
  }

  // Encontrar a linha dos "....." (separador)
  let separatorIdx = -1;
  for (let i = (fupIdx >= 0 ? fupIdx : 0); i < lines.length; i++) {
    if (lines[i].trim().match(/^\.{3,}/)) {
      separatorIdx = i;
      break;
    }
  }

  // Parte abaixo do FUP (a partir dos "....." inclusive)
  const belowFup = separatorIdx >= 0 ? lines.slice(separatorIdx).join("\n") : "";

  // Acima do FUP: novo texto padrao
  const aboveFup = "✅ Imóvel ativo\n\n🚨 Aguardando o envio dos registros pendentes";

  // FUP com nova data
  const fupLine = `⏭️ Fup: ${newShort}`;

  // Montar comentario final
  const parts = [aboveFup, "", fupLine];
  if (belowFup) {
    parts.push(belowFup);
  }

  return parts.join("\n");
}

// POST: Atualiza um card da Fase 4 como ativo
export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const validId = validateCardId(body.cardId);
    const rawExtra = typeof body.extraDays === "number" && !isNaN(body.extraDays) ? body.extraDays : 0;
    const extraDays = Math.min(Math.max(rawExtra, -99), 10);
    const customComment: string | undefined = body.customComment;
    const action: string | undefined = body.action;

    // Ação leve: só atualiza o último comentário, sem mover/tags/campos/vencimento
    if (action === "update_comment") {
      const commentText: string | undefined = body.commentText;
      if (!commentText || !commentText.trim()) {
        return NextResponse.json({ error: "Comentário obrigatório" }, { status: 400 });
      }
      const actions: string[] = [];
      const errors: string[] = [];
      try {
        await createComment(validId, commentText);
        actions.push("Comentário adicionado");
      } catch (e: unknown) {
        errors.push(`Comentário: ${e instanceof Error ? e.message : "erro"}`);
      }
      const allDetails = [...actions, ...errors.map((e) => `❌ ${e}`)].join(" | ");
      return NextResponse.json({
        success: errors.length === 0,
        action: "updated",
        details: allDetails,
      });
    }

    // 1. Buscar card completo
    const result = await pipefyQuery(`{
      card(id: ${validId}) {
        id title due_date
        labels { id name }
        comments { id text created_at author_name }
      }
    }`);

    const card = result?.data?.card;
    if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

    const actions: string[] = [];
    const comments = card.comments || [];
    const lastComment = comments[0];

    if (!lastComment?.text && !customComment) {
      return NextResponse.json({ error: "Card sem comentário — não é possível atualizar" }, { status: 400 });
    }

    // 2. Calcular nova data (+3 dias uteis a partir de hoje, ou hoje se extraDays === -99)
    const newDueDate = extraDays === -99 ? getNextBusinessDayAt22(0) : getNextBusinessDayAt22(3 + extraDays);
    const newDueDateBR = formatDateBR(newDueDate);

    // 3. Determinar o comentário final (editado ou gerado)
    const commentToSend = customComment || buildNewComment(lastComment.text, newDueDateBR);

    // Parsear seções do comentário NOVO (editado), não do original
    const sections = commentToSend ? parseSections(commentToSend) : null;

    const errors: string[] = [];

    async function step(name: string, fn: () => Promise<void>) {
      try { await fn(); actions.push(name); } catch (e: unknown) { errors.push(`${name}: ${e instanceof Error ? e.message : "erro"}`); }
    }

    // 4. Atualizar tags baseado no comentário editado
    let updatedLabels = (card.labels || []).map((l: any) => l.id) as string[];
    if (!updatedLabels.includes(IMOVEL_ATIVO_TAG)) updatedLabels.push(IMOVEL_ATIVO_TAG);

    if (sections) {
      if (sections.enxoval.status) {
        if (sections.enxoval.status === "❌") {
          if (!updatedLabels.includes(TAG_VALIDAR_ENXOVAL)) updatedLabels.push(TAG_VALIDAR_ENXOVAL);
        } else {
          updatedLabels = updatedLabels.filter((id) => id !== TAG_COMPRAR_ENXOVAL && id !== TAG_ENTREGAR_ENXOVAL && id !== TAG_VALIDAR_ENXOVAL);
        }
      }
      if (sections.itens.status) {
        if (sections.itens.status === "❌") {
          if (!updatedLabels.includes(TAG_ITENS_PEQUENOS)) updatedLabels.push(TAG_ITENS_PEQUENOS);
        } else {
          updatedLabels = updatedLabels.filter((id) => id !== TAG_ITENS_PEQUENOS);
        }
      }
      if (sections.manutencao.status) {
        if (sections.manutencao.status === "❌") {
          if (!updatedLabels.includes(TAG_MANUT_PEQUENAS)) updatedLabels.push(TAG_MANUT_PEQUENAS);
        } else {
          updatedLabels = updatedLabels.filter((id) => id !== TAG_MANUT_PEQUENAS);
        }
      }
    }

    await step("Tags atualizadas", () => {
      const uniqueLabels = [...new Set(updatedLabels)];
      const labelArray = uniqueLabels.map((id) => `"${id}"`).join(", ");
      return pipefyQuery(`mutation { updateCard(input: { id: ${validId}, label_ids: [${labelArray}] }) { card { id } } }`);
    });

    // 5. Atualizar vencimento
    await step(`Vencimento → ${newDueDateBR} 22:00`, () => updateDueDate(validId, newDueDate));

    // 6. Adicionar comentário
    await step("Comentário adicionado", () => createComment(validId, commentToSend));

    // 7. Campo obrigatório
    await step("Adequações → Imóvel ativado", () =>
      pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "fase_4_adequa_es_sinalizadas", new_value: "Imóvel ativado" }) { success } }`)
    );

    // 8. Mover para Fase 5
    await step("Card → Fase 5", () =>
      pipefyQuery(`mutation { moveCardToPhase(input: { card_id: ${validId}, destination_phase_id: ${PHASE_5_ID} }) { card { id } } }`)
    );

    // 9. Preencher campos (após mover para Fase 5)
    if (sections) {
      if (sections.enxoval.status) {
        if (sections.enxoval.status === "❌") {
          const escaped = JSON.stringify(sections.enxoval.titleLine).slice(1, -1);
          await step("Campo enxoval: pendente", () =>
            pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "valida_o_enxoval", new_value: "${escaped}" }) { success } }`)
          );
        } else {
          await step("Campo enxoval: ok", () =>
            pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "valida_o_enxoval", new_value: "ok" }) { success } }`)
          );
        }
      }
      if (sections.itens.status) {
        if (sections.itens.status === "❌") {
          const escaped = JSON.stringify(sections.itens.content).slice(1, -1);
          await step("Campo itens: pendentes", () =>
            pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "itens_faltantes_atualmente", new_value: "${escaped}" }) { success } }`)
          );
        } else {
          await step("Campo itens: ok", () =>
            pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "itens_faltantes_atualmente", new_value: "ok" }) { success } }`)
          );
        }
      }
      if (sections.manutencao.status) {
        if (sections.manutencao.status === "❌") {
          const escaped = JSON.stringify(sections.manutencao.content).slice(1, -1);
          await step("Campo manutenção: pendentes", () =>
            pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "manuten_es_pendentes_atualmente", new_value: "${escaped}" }) { success } }`)
          );
        } else {
          await step("Campo manutenção: ok", () =>
            pipefyQuery(`mutation { updateCardField(input: { card_id: ${validId}, field_id: "manuten_es_pendentes_atualmente", new_value: "ok" }) { success } }`)
          );
        }
      }
    }

    const allDetails = [...actions, ...errors.map((e) => `❌ ${e}`)].join(" | ");
    return NextResponse.json({
      success: errors.length === 0,
      action: "updated",
      details: allDetails,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
