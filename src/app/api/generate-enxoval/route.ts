import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery,
  requireAuth,
  PHASE_5_ID,
  sanitizeGraphQL,
} from "@/lib/pipefy";
import { deriveEnxovalSnapshot, listVistoriaCards } from "@/lib/enxoval/derive";
import { gerarEnxovalPdf } from "@/lib/enxoval/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const TABLE_ID = "uPKa2zs_";
const ORG_ID = "330500";

async function findFase5Card(code: string) {
  const query = `{
    phase(id: ${PHASE_5_ID}) {
      cards(first: 50, search: { title: "${sanitizeGraphQL(code)}" }) {
        edges { node { id title } }
      }
    }
  }`;
  const r = await pipefyQuery(query);
  const edges = r.data?.phase?.cards?.edges || [];
  const u = code.toUpperCase();
  return (
    edges.find(
      (e: { node: { title: string } }) =>
        e.node.title.toUpperCase().trim() === u
    )?.node ?? null
  );
}

async function uploadPdfBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const presignQuery = `
    mutation {
      createPresignedUrl(input: {
        organizationId: "${ORG_ID}"
        fileName: "${sanitizeGraphQL(fileName)}"
      }) { url }
    }
  `;
  const presign = await pipefyQuery(presignQuery);
  const presignedUrl = presign.data?.createPresignedUrl?.url;
  if (!presignedUrl) throw new Error("Falha ao obter URL de upload");

  const upload = await fetch(presignedUrl, {
    method: "PUT",
    body: new Uint8Array(buffer),
  });
  if (!upload.ok) throw new Error(`Upload falhou: ${upload.status}`);
  const fullUrl = presignedUrl.split("?")[0];
  const m = fullUrl.match(/\.amazonaws\.com\/(.+)$/);
  if (!m) throw new Error("URL inválida");
  return m[1];
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function createTableRecord(
  snapshot: Awaited<ReturnType<typeof deriveEnxovalSnapshot>>,
  filePath: string,
  cardId: string
) {
  const ag = Object.fromEntries(
    snapshot.resultado.resumoItens.map((i) => [i.descricao, i.quantidade])
  ) as Record<string, number>;

  const fields = [
    { id: "c_digo_do_im_vel", v: snapshot.codigoImovel },
    { id: "data_de_compra_do_enxoval", v: todayBR() },
    { id: "fronha", v: String(ag["FRONHA"] ?? 0) },
    { id: "toalha_de_banho", v: String(ag["TOALHA BANHO"] ?? 0) },
    { id: "toalha_de_rosto", v: String(ag["TOALHA ROSTO"] ?? 0) },
    { id: "toalha_de_piso", v: String((ag["TAPETE"] ?? 0) || (ag["TOALHA PISO"] ?? 0)) },
    { id: "toalha_de_maquiagem", v: String(ag["MAQUIAGEM"] ?? 0) },
    { id: "toalha_de_praia", v: String(ag["TOALHA DE PRAIA"] ?? ag["TOALHA PRAIA"] ?? 0) },
    {
      id: "manta_queen_size",
      v: String((ag["MANTA QUEEN"] ?? 0) + (ag["MANTA QUEEN INVERNO"] ?? 0)),
    },
    {
      id: "lencol_ou_virol_solteiro",
      v: String((ag["LENÇOL SOLTEIRO"] ?? 0) + (ag["VIROL (Sem Elástico) SOLTEIRO"] ?? 0)),
    },
    {
      id: "len_ol_ou_virol_casal",
      v: String((ag["LENÇOL CASAL"] ?? 0) + (ag["VIROL (Sem Elástico) CASAL"] ?? 0)),
    },
    {
      id: "len_ol_ou_virol_queen_size",
      v: String((ag["LENÇOL QUEEN"] ?? 0) + (ag["VIROL (Sem Elástico) QUEEN"] ?? 0)),
    },
    {
      id: "len_ol_ou_virol_king_size",
      v: String((ag["LENÇOL KING"] ?? 0) + (ag["VIROL (Sem Elástico) KING"] ?? 0)),
    },
    { id: "edredom_solteiro", v: String(ag["EDREDOM SOLTEIRO"] ?? 0) },
    { id: "edredom_casal", v: String(ag["EDREDOM CASAL"] ?? 0) },
    { id: "edredom_queen_size", v: String(ag["EDREDOM QUEEN"] ?? 0) },
    { id: "edredom_king_size", v: String(ag["EDREDOM KING"] ?? 0) },
    { id: "capa_edredom_solteiro", v: String(ag["CAPA EDREDOM SOLTEIRO"] ?? 0) },
    { id: "capa_edredom_casal", v: String(ag["CAPA EDREDOM CASAL"] ?? 0) },
    { id: "capa_edredom_queen_size", v: String(ag["CAPA EDREDOM QUEEN"] ?? 0) },
    { id: "capa_edredom_king_size", v: String(ag["CAPA EDREDOM KING"] ?? 0) },
    { id: "valida_o_da_marca_do_enxoval", v: "0" },
    // String (não array): formato que process-card e submit-pipefy sempre usaram com sucesso.
    // Array fazia o Pipefy Web servir o path stripped sob "start-form-attachments/{cardId}/..." → 404.
    { id: "comprovante_de_compra_do_propriet_rio", v: filePath },
  ];

  const fieldsStr = fields
    .map((f) => `{ field_id: "${f.id}", field_value: ${JSON.stringify(f.v)} }`)
    .join(", ");

  const createQuery = `
    mutation {
      createTableRecord(input: {
        table_id: "${TABLE_ID}"
        fields_attributes: [${fieldsStr}]
      }) { table_record { id title } }
    }
  `;
  const createRes = await pipefyQuery(createQuery);
  if (createRes.errors) {
    throw new Error(createRes.errors.map((e: { message: string }) => e.message).join("; "));
  }
  const recordId = createRes.data?.createTableRecord?.table_record?.id;
  if (!recordId) throw new Error("Falha ao criar registro");

  // Conecta ao card Fase 5
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
  return recordId;
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      code?: string;
      vistoriaCardId?: string;
      // Modo "anexo": usar este PDF preexistente em vez de gerar um novo.
      attachmentPath?: string;
      attachmentUrl?: string;
    };
    const code = body.code?.trim();
    if (!code) {
      return NextResponse.json({ error: "Código não fornecido" }, { status: 400 });
    }

    // 1. Card Fase 5
    const fase5 = await findFase5Card(code);
    if (!fase5) {
      return NextResponse.json(
        { error: `Card "${code}" não encontrado na Fase 5` },
        { status: 404 }
      );
    }

    // 2. Card Vistoria — exige escolha se houver mais de um
    const vistorias = await listVistoriaCards(code);
    if (vistorias.length === 0) {
      return NextResponse.json(
        { error: `Nenhum card de Vistoria encontrado para "${code}"` },
        { status: 404 }
      );
    }
    let vistoriaCardId = body.vistoriaCardId;
    if (!vistoriaCardId) {
      if (vistorias.length > 1) {
        return NextResponse.json(
          {
            error: "MULTIPLE_VISTORIAS",
            message: "Há mais de uma vistoria. Escolha qual usar.",
            cards: vistorias,
          },
          { status: 409 }
        );
      }
      vistoriaCardId = vistorias[0].id;
    }

    // 3. Snapshot consolidado + cálculo (sempre do PIPE 3)
    const snapshot = await deriveEnxovalSnapshot(code, vistoriaCardId);

    // 4. PDF: ou anexa o que veio (modo "anexo"), ou gera do zero (modo "vistoria")
    let pdfBuffer: Buffer;
    let fileName: string;
    if (body.attachmentUrl) {
      const r = await fetch(body.attachmentUrl);
      if (!r.ok) {
        return NextResponse.json(
          { error: `Falha ao baixar PDF anexado: HTTP ${r.status}` },
          { status: 502 }
        );
      }
      pdfBuffer = Buffer.from(await r.arrayBuffer());
      fileName =
        body.attachmentPath?.split("/").pop() ||
        `${code}-enxoval.pdf`;
    } else {
      pdfBuffer = await gerarEnxovalPdf(snapshot);
      fileName = `${code}-enxoval.pdf`;
    }

    // 5. Upload S3 Pipefy
    const filePath = await uploadPdfBuffer(pdfBuffer, fileName);

    // 6. Cria registro na tabela (com PDF) e conecta ao card Fase 5
    const recordId = await createTableRecord(snapshot, filePath, fase5.id);

    return NextResponse.json({
      success: true,
      code,
      cardId: fase5.id,
      vistoriaCardId,
      recordId,
      snapshot: {
        proprietario: snapshot.proprietario,
        franquia: snapshot.franquia,
        cluster: snapshot.cluster,
        fornecedor: snapshot.fornecedor,
        kits: snapshot.kits,
        subtotalKits: snapshot.resultado.subtotalKits,
        frete: snapshot.resultado.frete,
        totalComFrete: snapshot.resultado.totalComFrete,
      },
    });
  } catch (error) {
    return errorResponse(error, { status: 500 });
  }
}
