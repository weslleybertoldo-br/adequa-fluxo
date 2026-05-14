import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { errorResponse } from "@/lib/errors";
import { getChamadoMedia } from "@/lib/sults";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { osId, includeArquivos } = (await request.json()) as { osId?: number; includeArquivos?: boolean };
    if (!osId || typeof osId !== "number") return NextResponse.json({ error: "osId obrigatório" }, { status: 400 });

    const result = await getChamadoMedia(osId);
    const media = includeArquivos
      ? result.media
      : result.media.filter((m) => m.isImage || m.isVideo);

    return NextResponse.json({
      os: result.os,
      total: media.length,
      images: media.filter((m) => m.isImage).length,
      videos: media.filter((m) => m.isVideo).length,
      others: media.filter((m) => !m.isImage && !m.isVideo).length,
      media,
    });
  } catch (err) {
    return errorResponse(err, { context: "sults-extract" });
  }
}
