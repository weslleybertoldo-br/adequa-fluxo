import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";
import { uploadFromUrl } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { pendenciasFolderId, name, urlDownload, accessToken } = (await request.json()) as {
      pendenciasFolderId?: string;
      name?: string;
      urlDownload?: string;
      accessToken?: string;
    };
    if (!pendenciasFolderId || !name || !urlDownload || !accessToken) {
      return NextResponse.json({ error: "pendenciasFolderId, name, urlDownload e accessToken obrigatórios" }, { status: 400 });
    }
    const f = await uploadFromUrl(accessToken, pendenciasFolderId, name, urlDownload);
    return NextResponse.json({ id: f.id, name: f.name });
  } catch (err) {
    return errorResponse(err, { context: "drive-upload-one" });
  }
}
