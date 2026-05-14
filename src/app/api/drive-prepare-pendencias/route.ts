import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";
import { findChildFolderByName, createFolder, listChildren } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

const VISTORIA_FOLDER_NAME = "2. Vistoria / Manutenção";
const PENDENCIAS_FOLDER_NAME = "PENDENCIAS";

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { codeFolderId, accessToken } = (await request.json()) as { codeFolderId?: string; accessToken?: string };
    if (!codeFolderId || !accessToken) return NextResponse.json({ error: "codeFolderId e accessToken obrigatórios" }, { status: 400 });

    const vistoria = await findChildFolderByName(accessToken, codeFolderId, VISTORIA_FOLDER_NAME);
    if (!vistoria) return NextResponse.json({ error: `Pasta '${VISTORIA_FOLDER_NAME}' não encontrada` }, { status: 404 });

    let pendencias = await findChildFolderByName(accessToken, vistoria.id, PENDENCIAS_FOLDER_NAME);
    let created = false;
    if (!pendencias) {
      pendencias = await createFolder(accessToken, PENDENCIAS_FOLDER_NAME, vistoria.id);
      created = true;
    }

    const existing = await listChildren(accessToken, pendencias.id, false);
    return NextResponse.json({
      pendenciasFolderId: pendencias.id,
      pendenciasUrl: `https://drive.google.com/drive/folders/${pendencias.id}`,
      createdPendencias: created,
      existingNames: existing.map((f) => f.name),
    });
  } catch (err) {
    return errorResponse(err, { context: "drive-prepare-pendencias" });
  }
}
