import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";
import { searchFolderByName, getFolder, findChildFolderByName, listChildren, type DriveFolder } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { code, accessToken } = (await request.json()) as { code?: string; accessToken?: string };
    if (!code || !accessToken) return NextResponse.json({ error: "code e accessToken obrigatórios" }, { status: 400 });

    const folders = await searchFolderByName(accessToken, code);
    if (folders.length === 0) {
      return NextResponse.json({ candidates: [] });
    }
    const candidates = await Promise.all(
      folders.map(async (f) => {
        let parentName: string | null = null;
        if (f.parents?.[0]) {
          try {
            const p = await getFolder(accessToken, f.parents[0]);
            parentName = p.name;
          } catch { /* ignore */ }
        }
        return { id: f.id, name: f.name, parentName, url: `https://drive.google.com/drive/folders/${f.id}` };
      }),
    );
    return NextResponse.json({ candidates });
  } catch (err) {
    return errorResponse(err, { context: "drive-find-code-folder" });
  }
}
