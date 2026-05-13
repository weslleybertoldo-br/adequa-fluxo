import { NextRequest, NextResponse } from "next/server";
import { requireAuth, pipefyQuery, findCardsByTitleInPipe } from "@/lib/pipefy";
import { trocarCodigoStays, previewTrocaStays } from "@/lib/stays";
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

    const staysId = await getStaysIdFromPipe1(codigoAntigo, codigoNovo);
    if (!staysId) {
      return NextResponse.json({
        success: false,
        error: `Não encontrei o ID Stays no card do Pipe 1 (procurei title=${codigoAntigo} e title=${codigoNovo}). Verifique se o card existe e se o campo "ID da Stays do imóvel" está preenchido.`,
      });
    }

    // Dry-run: preview do que seria enviado, sem PATCH
    if (dryRun) {
      const p = await previewTrocaStays(staysId, codigoAntigo, codigoNovo);
      const titulosCount = Object.keys(p.titulosAtualizados).length;
      let mensagem: string;
      if (p.precisaPatch) {
        const partes: string[] = [];
        if (p.internalNameAntigo !== p.internalNameNovo) {
          partes.push(`internalName ${p.internalNameAntigo} → ${p.internalNameNovo}`);
        }
        if (titulosCount > 0) partes.push(`${titulosCount} título(s) serão atualizado(s)`);
        mensagem = `Preview Stays (listing ${staysId}): ${partes.join(" + ")}.`;
      } else {
        mensagem = `Listing ${staysId}: nada a alterar — internalName "${p.internalNameAntigo}" não bate com "${codigoAntigo}" e nenhum título contém o código antigo (provavelmente já foi trocado).`;
      }
      return NextResponse.json({
        success: true,
        dryRun: true,
        precisaPatch: p.precisaPatch,
        staysId,
        internalNameAntigo: p.internalNameAntigo,
        internalNameNovo: p.internalNameNovo,
        titulosAtualizados: p.titulosAtualizados,
        titulosCount,
        body: p.body,
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
    } else {
      mensagem = `Listing ${staysId}: nada a alterar — internalName "${r.internalNameAntigo}" não bate com "${codigoAntigo}" e nenhum título contém o código antigo (provavelmente já foi trocado).`;
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      patchEnviado: r.patchEnviado,
      staysId,
      internalNameAntigo: r.internalNameAntigo,
      internalNameNovo: r.internalNameNovo,
      titulosAtualizados: r.titulosAtualizados,
      titulosCount,
      mensagem,
    });
  } catch (error: unknown) {
    return errorResponse(error, { context: "stays-trocar", fallback: "Erro ao trocar na Stays" });
  }
}
