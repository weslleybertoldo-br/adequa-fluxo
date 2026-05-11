import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, requireAuth } from "@/lib/pipefy";

const ANUNCIO_PIPE_ID = "303024130";

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const { codigo, tipoAlteracao, descricao } = await req.json();

    if (!codigo || !descricao) {
      return NextResponse.json({ error: "Campos obrigatórios: código, descrição" }, { status: 400 });
    }

    const validTipos = ["Temporária", "Permanente"];
    if (tipoAlteracao && !validTipos.includes(tipoAlteracao)) {
      return NextResponse.json({ error: "tipoAlteracao inválido — use Temporária ou Permanente" }, { status: 400 });
    }

    const esc = (s: string) => JSON.stringify(s).slice(1, -1);

    const fields = [
      `{ field_id: "motivo_padronizado_1", field_value: "${esc(codigo)}" }`,
      `{ field_id: "nome_do_solicitante_1", field_value: "Weslley Bertoldo da Silva" }`,
      `{ field_id: "e_mail_do_solicitante", field_value: "weslley.bertoldo@seazone.com.br" }`,
      `{ field_id: "copy_of_v_nculo_do_solicitante", field_value: "Time de implantação" }`,
      `{ field_id: "copy_of_teste_completo_n_o_preencher_1", field_value: "Informações do imóvel - Ajuste da descrição/ammenites/locomoção" }`,
      `{ field_id: "altera_o_tempor_ria_ou_permanente", field_value: "${esc(tipoAlteracao || "Permanente")}" }`,
      `{ field_id: "descri_o_da_altera_o_1", field_value: "${esc(descricao)}" }`,
      `{ field_id: "teve_reclama_o_do_h_spede", field_value: "Não" }`,
    ];

    const result = await pipefyQuery(`mutation {
      createCard(input: {
        pipe_id: ${ANUNCIO_PIPE_ID}
        fields_attributes: [${fields.join(", ")}]
      }) {
        card { id title url }
      }
    }`);

    const card = result?.data?.createCard?.card;
    if (!card) throw new Error("Erro ao criar card");

    return NextResponse.json({
      success: true,
      cardId: card.id,
      title: card.title,
      url: card.url,
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
