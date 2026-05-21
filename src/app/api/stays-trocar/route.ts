import { NextRequest, NextResponse } from "next/server";
import { requireAuth, pipefyQuery, findCardsByTitleInPipe } from "@/lib/pipefy";
import {
  trocarCodigoStays,
  previewTrocaStays,
  findStaysListingsByInternalName,
  findStaysListingByCode,
} from "@/lib/stays";
import { errorResponse } from "@/lib/errors";

const PIPE_1_ID = "303781436";
const FIELD_STAYS_ID = "id_da_stays_do_im_vel";

// Busca card no Pipe 1 com title=needle e devolve `id_da_stays_do_im_vel`.
// Tenta antigo e novo: a search da Pipefy as vezes acha pelo titulo historico
// (busca QBA0601 retorna o card mesmo apos rename pra SLI0601), entao aceita
// qualquer match cujo titulo atual seja codigoAntigo OU codigoNovo.
async function getStaysIdFromPipe1(
  codigoAntigo: string,
  codigoNovo: string
): Promise<string | null> {
  const seenCardIds = new Set<string>();
  const titulosValidos = new Set(
    [codigoAntigo, codigoNovo].filter(Boolean).map((c) => c.toUpperCase().trim())
  );
  for (const codigo of [codigoAntigo, codigoNovo].filter(Boolean)) {
    try {
      const matches = await findCardsByTitleInPipe(PIPE_1_ID, codigo);
      const exato = matches.find(
        (m) => titulosValidos.has(m.title.toUpperCase().trim())
      );
      if (!exato || seenCardIds.has(exato.cardId)) continue;
      seenCardIds.add(exato.cardId);
      const r = await pipefyQuery(`{
        card(id: ${exato.cardId}) {
          fields { field { id } value }
        }
      }`);
      const fs = (r?.data?.card?.fields || []) as any[];
      const sf = fs.find((f) => f?.field?.id === FIELD_STAYS_ID);
      const v = sf?.value;
      if (typeof v === "string" && v.trim()) return v.trim();
    } catch {
      // ignora e tenta próximo
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const codigoAntigo = String(body.codigoAntigo || "").trim();
    const codigoNovo = String(body.codigoNovo || "").trim();
    const dryRun = Boolean(body.dryRun);
    if (!codigoAntigo || !codigoNovo) {
      return NextResponse.json(
        { error: "codigoAntigo e codigoNovo são obrigatórios" },
        { status: 400 }
      );
    }
    if (codigoAntigo.toUpperCase() === codigoNovo.toUpperCase()) {
      return NextResponse.json(
        { error: "Códigos iguais" },
        { status: 400 }
      );
    }
    if (!/^[A-Za-z0-9._-]+$/.test(codigoNovo)) {
      return NextResponse.json(
        { error: "codigoNovo tem caracteres inválidos" },
        { status: 400 }
      );
    }

    let staysId = await getStaysIdFromPipe1(codigoAntigo, codigoNovo);
    let staysIdFonte: "pipe1" | "stays_search" = "pipe1";
    if (!staysId) {
      // Fallback: Pipe 1 sem ID. Procura direto na Stays por internalName
      // contendo o codigoAntigo (token). Cobre o caso comum
      // internalName="ZU01H - PDAA0611" e cards Pipe 1 sem o campo preenchido.
      const hitAntigo = await findStaysListingByCode(codigoAntigo);
      const hitNovo = hitAntigo ? null : await findStaysListingByCode(codigoNovo);
      const hit = hitAntigo || hitNovo;
      if (hit) {
        staysId = hit._id;
        staysIdFonte = "stays_search";
      }
    }
    if (!staysId) {
      return NextResponse.json({
        success: false,
        error: `Não encontrei o listing na Stays. Tentei (1) card Pipe 1 com title=${codigoAntigo}/${codigoNovo} e campo "ID da Stays do imóvel" e (2) busca direta por internalName contendo ${codigoAntigo}/${codigoNovo}.`,
      });
    }

    // Pre-flight: existe OUTRO listing na Stays com internalName=codigoNovo?
    // Se sim, e nao for o mesmo staysId, ha conflito de duplicidade.
    const conflitos = await findStaysListingsByInternalName(codigoNovo, staysId);
    if (conflitos.length > 0) {
      const lista = conflitos.map((c) => c._id).join(", ");
      return NextResponse.json({
        success: false,
        codigoNovoJaExiste: true,
        error: `Código "${codigoNovo}" já existe na Stays em outro listing (${lista}). Escolha outro código novo.`,
      });
    }

    // Dry-run: preview do que seria enviado, sem PATCH
    if (dryRun) {
      const p = await previewTrocaStays(staysId, codigoAntigo, codigoNovo);
      const titulosCount = Object.keys(p.titulosAtualizados).length;
      let mensagem: string;
      let status: "precisa_trocar" | "ja_trocado" | "codigo_ausente";
      if (p.precisaPatch) {
        status = "precisa_trocar";
        const partes: string[] = [];
        if (p.internalNameAntigo !== p.internalNameNovo) {
          partes.push(`internalName ${p.internalNameAntigo} → ${p.internalNameNovo}`);
        }
        if (titulosCount > 0) partes.push(`${titulosCount} título(s) serão atualizado(s)`);
        mensagem = `Preview Stays (listing ${staysId}): ${partes.join(" + ")}.`;
      } else if (p.jaTrocado) {
        status = "ja_trocado";
        mensagem = `Listing ${staysId}: já foi trocado — internalName atual "${p.internalNameAntigo}" bate com "${codigoNovo}".`;
      } else {
        status = "codigo_ausente";
        mensagem = `Listing ${staysId}: código "${codigoAntigo}" não está na Stays — internalName atual "${p.internalNameAntigo}" não bate nem com "${codigoAntigo}" nem com "${codigoNovo}", e nenhum título contém esses códigos. Confirme se o ID Stays está correto.`;
      }
      return NextResponse.json({
        success: true,
        dryRun: true,
        precisaPatch: p.precisaPatch,
        jaTrocado: p.jaTrocado,
        codigoAusente: p.codigoAusente,
        status,
        staysId,
        internalNameAntigo: p.internalNameAntigo,
        internalNameNovo: p.internalNameNovo,
        titulosAtualizados: p.titulosAtualizados,
        titulosCount,
        body: p.body,
        staysIdFonte,
        mensagem,
      });
    }

    const r = await trocarCodigoStays(staysId, codigoAntigo, codigoNovo);
    const titulosCount = Object.keys(r.titulosAtualizados).length;

    let mensagem: string;
    if (r.patchEnviado) {
      const partes: string[] = [];
      if (r.internalNameAntigo !== r.internalNameNovo) {
        partes.push(`internalName ${r.internalNameAntigo} → ${r.internalNameNovo}`);
      }
      if (titulosCount > 0) partes.push(`${titulosCount} título(s) atualizado(s)`);
      mensagem = `Stays atualizada (listing ${staysId}): ${partes.join(" + ")}.`;
    } else if (r.status === "ja_trocado") {
      mensagem = `Listing ${staysId}: já foi trocado — internalName atual "${r.internalNameAntigo}" bate com "${codigoNovo}".`;
    } else {
      mensagem = `Listing ${staysId}: código "${codigoAntigo}" não está na Stays — internalName atual "${r.internalNameAntigo}" não bate nem com "${codigoAntigo}" nem com "${codigoNovo}". Confirme se o ID Stays está correto.`;
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      patchEnviado: r.patchEnviado,
      status: r.status,
      staysId,
      internalNameAntigo: r.internalNameAntigo,
      internalNameNovo: r.internalNameNovo,
      titulosAtualizados: r.titulosAtualizados,
      titulosCount,
      staysIdFonte,
      mensagem,
    });
  } catch (error: unknown) {
    return errorResponse(error, { context: "stays-trocar", fallback: "Erro ao trocar na Stays" });
  }
}
