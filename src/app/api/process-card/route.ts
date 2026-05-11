import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, requireAuth, PIPE_ID, PHASE_5_ID, sanitizeGraphQL } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("@/lib/pdf-parse");

const TABLE_ID = "uPKa2zs_";
const ORG_ID = "330500";

// Step 1: Find card by code directly in Phase 5
async function findCard(code: string) {
  const query = `{
    phase(id: ${PHASE_5_ID}) {
      cards(first: 50, search: { title: "${sanitizeGraphQL(code)}" }) {
        edges {
          node {
            id
            title
            current_phase { id name }
            attachments { path url createdAt }
          }
        }
      }
    }
  }`;

  const result = await pipefyQuery(query);
  const edges = result.data?.phase?.cards?.edges || [];

  const codeUpper = code.toUpperCase();
  const found = edges.find(
    (e: { node: { title: string } }) =>
      e.node.title.toUpperCase() === codeUpper
  );

  return found ? found.node : null;
}

// Step 2: Find enxoval PDF in attachments
function findEnxovalPdf(attachments: { path: string; url: string; createdAt: string | null }[], code: string) {
  // Priority 1: exact match "{CODE}-enxoval.pdf"
  const exactName = `${code}-enxoval.pdf`.toLowerCase();
  const exact = attachments.find((a) => {
    const fileName = a.path.split("/").pop()?.toLowerCase() || "";
    return fileName === exactName;
  });
  if (exact) return exact;

  // Priority 2: most recent file containing "enxoval" in name
  const enxovalFiles = attachments.filter((a) => {
    const fileName = a.path.split("/").pop()?.toLowerCase() || "";
    return fileName.includes("enxoval");
  });

  if (enxovalFiles.length === 0) return null;

  // Sort by createdAt descending (most recent first)
  enxovalFiles.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return enxovalFiles[0];
}

// Step 3: Download and parse PDF
function getItemQty(lines: string[], itemName: string, exactEnd = false): number {
  const escaped = itemName.replace(/[()]/g, "\\$&");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const gluedRegex = exactEnd
      ? new RegExp("^" + escaped + "(\\d+)$")
      : new RegExp("^" + escaped + "(\\d+)");
    const gluedMatch = line.match(gluedRegex);
    if (gluedMatch) return parseInt(gluedMatch[1], 10);

    const spacedRegex = new RegExp("^" + escaped + "[\\s\\t]+(\\d+)");
    const spacedMatch = line.match(spacedRegex);
    if (spacedMatch) {
      if (exactEnd) {
        const afterName = line.substring(itemName.length);
        if (/^[A-Z]/.test(afterName.trim())) continue;
      }
      return parseInt(spacedMatch[1], 10);
    }

    const isExactLine = line === itemName;
    const startsWithName = line.startsWith(itemName);

    if (isExactLine || startsWithName) {
      if (exactEnd && !isExactLine) {
        const rest = line.substring(itemName.length).trim();
        if (rest && /^[A-Z]/.test(rest)) continue;
      }
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (/^\d+$/.test(nextLine)) return parseInt(nextLine, 10);
        const nextMatch = nextLine.match(/^(\d+)\s/);
        if (nextMatch) return parseInt(nextMatch[1], 10);
      }
    }
  }

  const fullText = lines.join("\n");
  const nlRegex = new RegExp(escaped + "\\s*\\n(\\d+)(?:\\n|$)");
  const nlMatch = fullText.match(nlRegex);
  if (nlMatch) return parseInt(nlMatch[1], 10);

  const gluedFull = new RegExp(escaped + "(\\d+)(?:\\n|$)");
  const gfMatch = fullText.match(gluedFull);
  if (gfMatch) return parseInt(gfMatch[1], 10);

  return 0;
}

function parsePdfText(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const codIdx = lines.findIndex((l) => l.startsWith("Cod Imóvel") || l.startsWith("Cod Im"));
  let codigo_imovel = "";
  if (codIdx >= 0) {
    const match = lines[codIdx].match(/Cod\s*Im[óo]vel\s*([A-Z]{2,5}\d{3,5})/i);
    if (match) codigo_imovel = match[1];
    else if (codIdx + 1 < lines.length) codigo_imovel = lines[codIdx + 1].trim();
  }

  const fronha = getItemQty(lines, "FRONHA");
  const toalha_de_banho = getItemQty(lines, "TOALHA BANHO");
  const toalha_de_rosto = getItemQty(lines, "TOALHA ROSTO");
  const toalha_de_piso = getItemQty(lines, "TOALHA PISO") || getItemQty(lines, "TAPETE");
  const toalha_de_maquiagem = getItemQty(lines, "MAQUIAGEM");
  const toalha_de_praia = getItemQty(lines, "TOALHA DE PRAIA") || getItemQty(lines, "TOALHA PRAIA");
  const manta_queen_inverno = getItemQty(lines, "MANTA QUEEN INVERNO");
  const manta_queen = getItemQty(lines, "MANTA QUEEN", true);
  const lencol_solteiro = getItemQty(lines, "LENÇOL SOLTEIRO");
  const virol_solteiro = getItemQty(lines, "VIROL (Sem Elástico) SOLTEIRO");
  const lencol_casal = getItemQty(lines, "LENÇOL CASAL");
  const virol_casal = getItemQty(lines, "VIROL (Sem Elástico) CASAL");
  const lencol_queen = getItemQty(lines, "LENÇOL QUEEN");
  const virol_queen = getItemQty(lines, "VIROL (Sem Elástico) QUEEN");
  const lencol_king = getItemQty(lines, "LENÇOL KING");
  const virol_king = getItemQty(lines, "VIROL (Sem Elástico) KING");
  const edredom_solteiro = getItemQty(lines, "EDREDOM SOLTEIRO");
  const edredom_casal = getItemQty(lines, "EDREDOM CASAL");
  const edredom_queen = getItemQty(lines, "EDREDOM QUEEN");
  const edredom_king = getItemQty(lines, "EDREDOM KING");
  const capa_solteiro = getItemQty(lines, "CAPA EDREDOM SOLTEIRO");
  const capa_casal = getItemQty(lines, "CAPA EDREDOM CASAL");
  const capa_queen = getItemQty(lines, "CAPA EDREDOM QUEEN");
  const capa_king = getItemQty(lines, "CAPA EDREDOM KING");

  return {
    codigo_imovel,
    fronha, toalha_de_banho, toalha_de_rosto, toalha_de_piso,
    toalha_de_maquiagem, toalha_de_praia,
    manta_queen_size: manta_queen + manta_queen_inverno,
    lencol_ou_virol_solteiro: lencol_solteiro + virol_solteiro,
    lencol_ou_virol_casal: lencol_casal + virol_casal,
    lencol_ou_virol_queen_size: lencol_queen + virol_queen,
    lencol_ou_virol_king_size: lencol_king + virol_king,
    edredom_solteiro, edredom_casal,
    edredom_queen_size: edredom_queen,
    edredom_king_size: edredom_king,
    capa_edredom_solteiro: capa_solteiro,
    capa_edredom_casal: capa_casal,
    capa_edredom_queen_size: capa_queen,
    capa_edredom_king_size: capa_king,
  };
}

// Step 4: Upload PDF to Pipefy S3
async function uploadPdfBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const presignQuery = `
    mutation {
      createPresignedUrl(input: {
        organizationId: "${ORG_ID}"
        fileName: "${sanitizeGraphQL(fileName)}"
      }) { url }
    }
  `;
  const presignResult = await pipefyQuery(presignQuery);
  const presignedUrl = presignResult.data?.createPresignedUrl?.url;
  if (!presignedUrl) throw new Error("Falha ao obter URL de upload");

  const uploadRes = await fetch(presignedUrl, { method: "PUT", body: new Uint8Array(buffer) });
  if (!uploadRes.ok) throw new Error(`Upload falhou: ${uploadRes.status}`);

  const fullUrl = presignedUrl.split("?")[0];
  const pathMatch = fullUrl.match(/\.amazonaws\.com\/(.+)$/);
  if (!pathMatch) throw new Error("URL inválida");
  return pathMatch[1];
}

function getTodayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

// Step 5: Create record and connect to card
async function createRecordAndConnect(
  data: ReturnType<typeof parsePdfText>,
  filePath: string,
  cardId: string
) {
  const fields = [
    { field_id: "c_digo_do_im_vel", field_value: data.codigo_imovel },
    { field_id: "data_de_compra_do_enxoval", field_value: getTodayFormatted() },
    { field_id: "fronha", field_value: String(data.fronha) },
    { field_id: "toalha_de_banho", field_value: String(data.toalha_de_banho) },
    { field_id: "toalha_de_rosto", field_value: String(data.toalha_de_rosto) },
    { field_id: "toalha_de_piso", field_value: String(data.toalha_de_piso) },
    { field_id: "toalha_de_maquiagem", field_value: String(data.toalha_de_maquiagem) },
    { field_id: "toalha_de_praia", field_value: String(data.toalha_de_praia) },
    { field_id: "manta_queen_size", field_value: String(data.manta_queen_size) },
    { field_id: "lencol_ou_virol_solteiro", field_value: String(data.lencol_ou_virol_solteiro) },
    { field_id: "len_ol_ou_virol_casal", field_value: String(data.lencol_ou_virol_casal) },
    { field_id: "len_ol_ou_virol_queen_size", field_value: String(data.lencol_ou_virol_queen_size) },
    { field_id: "len_ol_ou_virol_king_size", field_value: String(data.lencol_ou_virol_king_size) },
    { field_id: "edredom_solteiro", field_value: String(data.edredom_solteiro) },
    { field_id: "edredom_casal", field_value: String(data.edredom_casal) },
    { field_id: "edredom_queen_size", field_value: String(data.edredom_queen_size) },
    { field_id: "edredom_king_size", field_value: String(data.edredom_king_size) },
    { field_id: "capa_edredom_solteiro", field_value: String(data.capa_edredom_solteiro) },
    { field_id: "capa_edredom_casal", field_value: String(data.capa_edredom_casal) },
    { field_id: "capa_edredom_queen_size", field_value: String(data.capa_edredom_queen_size) },
    { field_id: "capa_edredom_king_size", field_value: String(data.capa_edredom_king_size) },
    { field_id: "valida_o_da_marca_do_enxoval", field_value: "0" },
    { field_id: "comprovante_de_compra_do_propriet_rio", field_value: filePath },
  ];

  const fieldsStr = fields
    .map((f) => `{ field_id: "${f.field_id}", field_value: ${JSON.stringify(f.field_value)} }`)
    .join(", ");

  const createQuery = `
    mutation {
      createTableRecord(input: {
        table_id: "${TABLE_ID}"
        fields_attributes: [${fieldsStr}]
      }) {
        table_record { id title }
      }
    }
  `;

  const createResult = await pipefyQuery(createQuery);
  if (createResult.errors) {
    throw new Error(createResult.errors.map((e: { message: string }) => e.message).join("; "));
  }

  const recordId = createResult.data?.createTableRecord?.table_record?.id;

  // Connect to card
  if (recordId) {
    const connectQuery = `
      mutation {
        updateCardField(input: {
          card_id: ${cardId}
          field_id: "fase_liberado_vistoria_registro_de_enxoval"
          new_value: ["${recordId}"]
        }) { success }
      }
    `;
    await pipefyQuery(connectQuery);
  }

  return recordId;
}

// Main handler: process a single card code
export async function POST(request: NextRequest) {
  if (!requireAuth(request.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      code?: string;
      attachmentPath?: string;
      attachmentUrl?: string;
    };
    const code = body.code;
    if (!code) {
      return NextResponse.json({ error: "Código não fornecido" }, { status: 400 });
    }

    // 1. Find card
    const card = await findCard(code);
    if (!card) {
      return NextResponse.json({ error: `Card "${code}" não encontrado` }, { status: 404 });
    }

    // 2. Pick PDF: usa o que veio na request OU acha por nome
    let pdfAttachment;
    if (body.attachmentPath) {
      pdfAttachment = (card.attachments || []).find(
        (a: { path: string }) => a.path === body.attachmentPath
      );
      if (!pdfAttachment && body.attachmentUrl) {
        pdfAttachment = { path: body.attachmentPath, url: body.attachmentUrl, createdAt: null };
      }
    }
    if (!pdfAttachment) {
      pdfAttachment = findEnxovalPdf(card.attachments || [], code);
    }
    if (!pdfAttachment) {
      return NextResponse.json(
        { error: `Nenhum PDF de enxoval encontrado nos anexos do card "${code}"` },
        { status: 404 }
      );
    }

    // 3. Download PDF
    const pdfRes = await fetch(pdfAttachment.url);
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: `Falha ao baixar PDF: ${pdfRes.status}` },
        { status: 500 }
      );
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    // 4. Parse PDF
    const pdfData = await pdf(pdfBuffer);
    const parsed = parsePdfText(pdfData.text);
    if (!parsed.codigo_imovel) parsed.codigo_imovel = code;

    // 5. Upload PDF to Pipefy S3
    const fileName = pdfAttachment.path.split("/").pop() || `${code}-enxoval.pdf`;
    const filePath = await uploadPdfBuffer(pdfBuffer, fileName);

    // 6. Create record and connect to card
    const recordId = await createRecordAndConnect(parsed, filePath, card.id);

    return NextResponse.json({
      success: true,
      code,
      cardId: card.id,
      recordId,
      data: parsed,
      pdfFile: fileName,
    });
  } catch (error: unknown) {
    return errorResponse(error, { context: "process-card" });
  }
}
