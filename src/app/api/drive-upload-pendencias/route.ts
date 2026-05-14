import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";
import { findChildFolderByName, createFolder, listChildren, uploadFromUrl } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 300;

const VISTORIA_FOLDER_NAME = "2. Vistoria / Manutenção";
const PENDENCIAS_FOLDER_NAME = "PENDENCIAS";

type MediaItem = { id: number | string; nome: string; urlDownload: string };

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { codeFolderId, media, accessToken, forceWithSuffix } = (await request.json()) as {
      codeFolderId?: string;
      media?: MediaItem[];
      accessToken?: string;
      forceWithSuffix?: boolean;
    };
    if (!codeFolderId || !Array.isArray(media) || !accessToken) {
      return NextResponse.json({ error: "codeFolderId, media[] e accessToken obrigatórios" }, { status: 400 });
    }
    if (media.length === 0) return NextResponse.json({ uploaded: [], skipped: [], errors: [] });

    let vistoria = await findChildFolderByName(accessToken, codeFolderId, VISTORIA_FOLDER_NAME);
    if (!vistoria) {
      return NextResponse.json(
        { error: `Pasta '${VISTORIA_FOLDER_NAME}' não encontrada dentro da pasta do código` },
        { status: 404 },
      );
    }
    let pendencias = await findChildFolderByName(accessToken, vistoria.id, PENDENCIAS_FOLDER_NAME);
    let createdPendencias = false;
    if (!pendencias) {
      pendencias = await createFolder(accessToken, PENDENCIAS_FOLDER_NAME, vistoria.id);
      createdPendencias = true;
    }

    const existing = await listChildren(accessToken, pendencias.id, false);
    const existingNames = new Set(existing.map((f) => f.name));

    const uploaded: { name: string; id: string }[] = [];
    const skipped: string[] = [];
    const errors: { name: string; error: string }[] = [];

    const randomSuffix = () => Math.random().toString(36).slice(2, 7);
    const addSuffix = (name: string): string => {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      return `${base}-${randomSuffix()}${ext}`;
    };

    for (const m of media) {
      const original = m.nome || `arquivo-${m.id}`;
      const isDup = existingNames.has(original);
      if (isDup && !forceWithSuffix) {
        skipped.push(original);
        continue;
      }
      const name = isDup ? addSuffix(original) : original;
      try {
        const f = await uploadFromUrl(accessToken, pendencias.id, name, m.urlDownload);
        uploaded.push({ name: f.name, id: f.id });
        existingNames.add(f.name);
      } catch (e) {
        errors.push({ name, error: (e as Error).message });
      }
    }

    return NextResponse.json({
      pendenciasFolderId: pendencias.id,
      pendenciasUrl: `https://drive.google.com/drive/folders/${pendencias.id}`,
      createdPendencias,
      uploaded,
      skipped,
      errors,
    });
  } catch (err) {
    return errorResponse(err, { context: "drive-upload-pendencias" });
  }
}
