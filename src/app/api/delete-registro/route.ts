import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  pipefyQuery,
  requireAuth,
  PHASE_5_ID,
  sanitizeGraphQL,
} from "@/lib/pipefy";

const TABLE_ID = "uPKa2zs_";

async function findFase5Card(code: string) {
  const q = `{
    phase(id: ${PHASE_5_ID}) {
      cards(first: 50, search: { title: "${sanitizeGraphQL(code)}" }) {
        edges { node { id title fields { name connected_repo_items { ... on TableRecord { id } } } } }
      }
    }
  }`;
  const r = await pipefyQuery(q);
  const edges = r.data?.phase?.cards?.edges || [];
  const u = code.toUpperCase().trim();
  return (
    edges.find(
      (e: { node: { title: string } }) => e.node.title.toUpperCase().trim() === u
    )?.node ?? null
  );
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { code?: string; recordId?: string };
    const code = body.code?.trim();
    if (!code) {
      return NextResponse.json({ error: "Código não fornecido" }, { status: 400 });
    }

    const card = await findFase5Card(code);
    if (!card) {
      return NextResponse.json(
        { error: `Card "${code}" não encontrado na Fase 5` },
        { status: 404 }
      );
    }

    // Descobre recordId se não veio
    let recordId = body.recordId;
    if (!recordId) {
      const enxField = (card.fields || []).find((f: { name: string }) =>
        f.name?.toLowerCase().includes("registro de enxoval")
      );
      const conn = enxField?.connected_repo_items || [];
      if (conn.length > 0 && conn[0]?.id) recordId = conn[0].id;
    }

    if (!recordId) {
      return NextResponse.json(
        { error: "Nenhum registro de enxoval encontrado para este card" },
        { status: 404 }
      );
    }

    // 1. Desconectar do card
    const disconnect = `
      mutation {
        updateCardField(input: {
          card_id: ${card.id}
          field_id: "fase_liberado_vistoria_registro_de_enxoval"
          new_value: []
        }) { success }
      }
    `;
    await pipefyQuery(disconnect);

    // 2. Deletar o registro da tabela
    const del = `
      mutation {
        deleteTableRecord(input: {
          id: "${recordId}"
        }) { success }
      }
    `;
    const delRes = await pipefyQuery(del);
    if (delRes.errors) {
      throw new Error(delRes.errors.map((e: { message: string }) => e.message).join("; "));
    }

    return NextResponse.json({ success: true, code, recordId, cardId: card.id });
  } catch (error) {
    return errorResponse(error, { status: 500 });
  }
}
