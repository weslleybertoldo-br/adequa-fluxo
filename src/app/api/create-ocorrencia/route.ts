import { errorResponse } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { pipefyQuery, requireAuth } from "@/lib/pipefy";

const OCORRENCIA_PIPE_ID = "306877070";
const ORG_ID = "330500";

export async function POST(req: NextRequest) {
  if (!requireAuth(req.cookies.get("auth_token")?.value)) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const rawEnvolve = formData.get("envolveimovel") as string || "Sim";
    const envolveimovel = ["Sim", "Não"].includes(rawEnvolve) ? rawEnvolve : "Sim";
    const codigo = formData.get("codigo") as string;
    const franquia = formData.get("franquia") as string;
    const origem = formData.get("origem") as string;
    const descricao = formData.get("descricao") as string;
    const file = formData.get("evidencia") as File | null;

    if (!email || !descricao || !origem) {
      return NextResponse.json({ error: "Campos obrigatórios: email, origem, descrição" }, { status: 400 });
    }

    const esc = (s: string) => JSON.stringify(s).slice(1, -1);

    // Upload do arquivo se existir (max 10MB)
    let filePath = "";
    if (file && file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande (máximo 10MB)" }, { status: 400 });
    }
    if (file && file.size > 0) {
      // 1. Criar presigned URL
      const presignedResult = await pipefyQuery(`mutation {
        createPresignedUrl(input: {
          organizationId: "${ORG_ID}"
          fileName: "${esc(file.name)}"
        }) { url }
      }`);

      const presignedUrl = presignedResult?.data?.createPresignedUrl?.url;
      if (!presignedUrl) throw new Error("Erro ao gerar URL de upload");

      // 2. Upload do arquivo para S3
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: fileBuffer,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (!uploadRes.ok) throw new Error("Erro no upload do arquivo");

      // Extrair path do S3 a partir da URL
      const urlObj = new URL(presignedUrl);
      filePath = urlObj.pathname.replace(/^\//, "");
    }

    // Montar campos
    const fields = [
      `{ field_id: "e_mail_do_solicitante", field_value: "${esc(email)}" }`,
      `{ field_id: "a_reclama_o_envolve_algum_im_vel_da_seazone", field_value: "${esc(envolveimovel)}" }`,
      `{ field_id: "origem_da_ocorr_ncia_1", field_value: "${esc(origem)}" }`,
      `{ field_id: "descreva_o_ocorrido", field_value: "${esc(descricao)}" }`,
    ];

    if (codigo) fields.push(`{ field_id: "c_digo_do_im_vel_1", field_value: "${esc(codigo)}" }`);
    if (franquia) fields.push(`{ field_id: "franquia", field_value: "${esc(franquia)}" }`);
    if (filePath) fields.push(`{ field_id: "evid_ncia", field_value: ["${esc(filePath)}"] }`);

    const result = await pipefyQuery(`mutation {
      createCard(input: {
        pipe_id: ${OCORRENCIA_PIPE_ID}
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
