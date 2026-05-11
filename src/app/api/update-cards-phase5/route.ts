import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery, searchCardInPhase, updateDueDate, createComment,
  validateCardId, toBrazilDate, formatDateBR, isDueToday, getNextBusinessDayAt22,
  replaceCommentFupDate, requireAuth, PHASE_5_ID, PIPE_1_PHASES,
} from "@/lib/pipefy";

const COUNTRY_CODES: Record<string, string> = {
  "1": "EUA", "7": "Rússia", "27": "África do Sul", "30": "Grécia", "31": "Holanda",
  "32": "Bélgica", "33": "França", "34": "Espanha", "36": "Hungria", "39": "Itália",
  "40": "Romênia", "41": "Suíça", "43": "Áustria", "44": "Reino Unido", "45": "Dinamarca",
  "46": "Suécia", "47": "Noruega", "48": "Polônia", "49": "Alemanha", "51": "Peru",
  "52": "México", "53": "Cuba", "54": "Argentina", "56": "Chile", "57": "Colômbia",
  "58": "Venezuela", "60": "Malásia", "61": "Austrália", "62": "Indonésia", "63": "Filipinas",
  "64": "Nova Zelândia", "65": "Singapura", "66": "Tailândia", "81": "Japão", "82": "Coreia do Sul",
  "86": "China", "90": "Turquia", "91": "Índia", "92": "Paquistão", "93": "Afeganistão",
  "212": "Marrocos", "234": "Nigéria", "351": "Portugal", "352": "Luxemburgo",
  "353": "Irlanda", "354": "Islândia", "358": "Finlândia", "380": "Ucrânia",
  "420": "República Tcheca", "421": "Eslováquia", "502": "Guatemala", "503": "El Salvador",
  "504": "Honduras", "506": "Costa Rica", "507": "Panamá", "509": "Haiti",
  "591": "Bolívia", "593": "Equador", "595": "Paraguai", "598": "Uruguai",
  "972": "Israel", "971": "Emirados Árabes",
};

// DDDs válidos do Brasil (2 dígitos, 11-99)
const BRAZIL_DDDS = new Set([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46",
  "47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

function formatPhone(raw: string): string {
  if (!raw) return "";
  try {

  // Limpar: remover espaços, parênteses, hífens
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, "");

  // Se começa com + ou tem mais de 11 dígitos, pode ser internacional
  if (cleaned.startsWith("+") || cleaned.startsWith("00")) {
    const digits = cleaned.replace(/\D/g, "");

    // Verificar se é Brasil (+55)
    if (digits.startsWith("55") && digits.length >= 12) {
      const ddd = digits.slice(2, 4);
      // Se o DDD após 55 é um DDD válido do Brasil, é número brasileiro
      if (BRAZIL_DDDS.has(ddd)) {
        const rest = digits.slice(4);
        if (rest.length === 9) {
          return `(${ddd}) ${rest[0]} ${rest.slice(1, 5)} ${rest.slice(5)}`;
        } else if (rest.length === 8) {
          return `(${ddd}) ${rest.slice(0, 4)} ${rest.slice(4)}`;
        }
        return `(${ddd}) ${rest}`;
      }
    }

    // Número internacional — encontrar o país
    for (const len of [3, 2, 1]) {
      const prefix = digits.slice(0, len);
      if (COUNTRY_CODES[prefix]) {
        return `+${prefix} ${digits.slice(len)} (${COUNTRY_CODES[prefix]})`;
      }
    }

    // País não encontrado, retorna como está com +
    return `+${digits}`;
  }

  // Número sem + mas pode começar com 55 (Brasil)
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    if (BRAZIL_DDDS.has(ddd)) {
      const rest = digits.slice(4);
      if (rest.length === 9) {
        return `(${ddd}) ${rest[0]} ${rest.slice(1, 5)} ${rest.slice(5)}`;
      } else if (rest.length === 8) {
        return `(${ddd}) ${rest.slice(0, 4)} ${rest.slice(4)}`;
      }
      return `(${ddd}) ${rest}`;
    }
  }
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `(${ddd}) ${rest[0]} ${rest.slice(1, 5)} ${rest.slice(5)}`;
  } else if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `(${ddd}) ${rest.slice(0, 4)} ${rest.slice(4)}`;
  }

  return raw;
  } catch { return raw; }
}

async function getOwnerInfo(code: string): Promise<{ nome: string; telefone: string; email: string }> {
  const empty = { nome: "", telefone: "", email: "" };
  try {
    for (const { id: phaseId } of PIPE_1_PHASES) {
      const result = await pipefyQuery(`{
        phase(id: ${phaseId}) {
          cards(first: 3, search: { title: "${JSON.stringify(code).slice(1, -1)}" }) {
            edges {
              node {
                title
                fields { name value }
              }
            }
          }
        }
      }`);
      const edges = result?.data?.phase?.cards?.edges || [];
      const card = edges.find((e: any) => e.node.title.toUpperCase() === code.toUpperCase());
      if (card) {
        const fields = card.node.fields || [];
        const nome = fields.find((f: any) => f.name?.toLowerCase().includes("nome do proprietário"))?.value || "";
        const telefone = fields.find((f: any) => f.name?.toLowerCase().includes("telefone do proprietário"))?.value || "";
        const email = fields.find((f: any) => f.name?.toLowerCase().includes("e-mail do proprietário") || f.name?.toLowerCase().includes("email do proprietário"))?.value || "";
        if (nome || telefone || email) return { nome, telefone: formatPhone(telefone), email };
      }
    }
  } catch { /* silencioso */ }
  return empty;
}

// Buscar cards da Fase 5 com fields (para registro de enxoval)
async function fetchPhase5Cards(): Promise<any[]> {
  let allCards: any[] = [];
  let cursor: string | undefined;
  let pages = 0;
  while (pages < 50) {
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const result = await pipefyQuery(`{
      phase(id: ${PHASE_5_ID}) {
        cards(first: 50${afterClause}) {
          edges {
            node {
              id title due_date
              labels { id name }
              assignees { id name }
              comments { id text created_at author_name }
              fields {
                name value
                connected_repo_items { ... on TableRecord { id title } ... on Card { id title } }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`);
    const data = result?.data?.phase?.cards;
    const edges = data?.edges || [];
    if (edges.length === 0) break;
    allCards = [...allCards, ...edges.map((e: any) => e.node)];
    if (!data?.pageInfo?.hasNextPage) break;
    cursor = data.pageInfo.endCursor;
    if (!cursor) break;
    pages++;
  }
  return allCards;
}

export async function GET(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const search = req.nextUrl.searchParams.get("search");

    const formatPhase5Card = (c: any) => {
      const lastComment = (c.comments || [])[0];
      const br = c.due_date ? toBrazilDate(new Date(c.due_date)) : null;
      const dueFormatted = br ? `${String(br.day).padStart(2, "0")}/${String(br.month + 1).padStart(2, "0")}/${br.year}` : "Sem vencimento";
      const enxovalField = (c.fields || []).find((f: any) => f.name?.toLowerCase().includes("registro de enxoval"));
      const connectedItems = enxovalField?.connected_repo_items || [];
      const hasRecord = connectedItems.length > 0 && !!connectedItems[0]?.id;
      const recordId = hasRecord ? connectedItems[0].id : "";
      return {
        id: c.id, title: c.title, due_date: c.due_date, dueFormatted,
        assignees: (c.assignees || []).map((a: any) => a.name),
        labels: (c.labels || []).map((l: any) => l.name),
        lastComment: lastComment?.text || "", lastCommentAuthor: lastComment?.author_name || "", lastCommentDate: lastComment?.created_at || "",
        hasRecord, recordId,
      };
    };

    if (search) {
      const card = await searchCardInPhase(PHASE_5_ID, search);
      if (!card) return NextResponse.json({ success: true, totalCards: 0, cards: [] });
      const formatted = formatPhase5Card(card);
      const owner = await getOwnerInfo(card.title);
      return NextResponse.json({ success: true, totalCards: 1, cards: [{ ...formatted, owner }] });
    }

    const allCards = await fetchPhase5Cards();
    const cards = allCards.filter((c) => c.due_date && isDueToday(c.due_date));
    const formatted = cards.map(formatPhase5Card);

    // Buscar dados do proprietário em paralelo (batch de 5)
    const owners: Record<string, { nome: string; telefone: string; email: string }> = {};
    for (let i = 0; i < formatted.length; i += 5) {
      const batch = formatted.slice(i, i + 5);
      const results = await Promise.all(batch.map((c) => getOwnerInfo(c.title)));
      batch.forEach((c, idx) => { owners[c.id] = results[idx]; });
    }

    return NextResponse.json({
      success: true,
      totalCards: formatted.length,
      cards: formatted.map((c) => ({ ...c, owner: owners[c.id] || { nome: "", telefone: "", email: "" } })),
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
    const { cardId, extraDays = 0 } = await req.json();
    const validId = validateCardId(cardId);

    const result = await pipefyQuery(`{
      card(id: ${validId}) {
        id title due_date
        current_phase { id }
        comments { id text created_at author_name }
      }
    }`);

    const card = result?.data?.card;
    if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

    // Validar que o card pertence à Fase 5
    if (String(card.current_phase?.id) !== PHASE_5_ID) {
      return NextResponse.json({ error: "Card não pertence à Fase 5" }, { status: 400 });
    }

    const newDueDate = getNextBusinessDayAt22(3 + extraDays);
    const newDueDateBR = formatDateBR(newDueDate);
    const actions: string[] = [];

    await updateDueDate(card.id, newDueDate);
    actions.push(`Vencimento → ${newDueDateBR} 22:00`);

    const comments = card.comments || [];
    const lastComment = comments[0];
    if (lastComment?.text) {
      const newText = replaceCommentFupDate(lastComment.text, newDueDateBR);
      await createComment(card.id, newText);
      actions.push("Comentário adicionado");
    } else {
      actions.push("Sem comentário anterior");
    }

    return NextResponse.json({
      success: true,
      cardId: card.id,
      title: card.title,
      action: "updated",
      details: actions.join(" | "),
      newDueDate: newDueDateBR,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
