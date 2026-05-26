import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/pipefy";
import { put, list, del } from "@vercel/blob";
import { errorResponse } from "@/lib/errors";

const TTL_MS = 1000 * 60 * 60 * 24 * 30 * 6; // ~6 meses

// Persistência do tracker de troca (status por card+serviço) no Vercel Blob.
// 1 arquivo JSON por card: status/<cardId>.json → { <campo>: { valor, mensagem }, _updatedAt }

const PREFIX = "status/";
const pathFor = (cardId: string) => `${PREFIX}${cardId}.json`;

type Campo = { valor: string; mensagem?: string };
type StatusDoc = Record<string, Campo | string | undefined> & { _updatedAt?: string };

async function lerStatus(cardId: string): Promise<StatusDoc | null> {
  const { blobs } = await list({ prefix: pathFor(cardId), limit: 1 });
  const blob = blobs.find((b) => b.pathname === pathFor(cardId));
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  const doc = (await res.json()) as StatusDoc;
  // Expira após ~6 meses sem atualização (evita acúmulo de cards antigos)
  if (doc._updatedAt && Date.now() - new Date(doc._updatedAt).getTime() > TTL_MS) {
    await del(blob.url).catch(() => {});
    return null;
  }
  return doc;
}

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cardId = (new URL(request.url).searchParams.get("cardId") || "").trim();
    if (!cardId) return NextResponse.json({ error: "cardId obrigatório" }, { status: 400 });
    const doc = (await lerStatus(cardId)) || {};
    return NextResponse.json({ success: true, status: doc });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao ler status", status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get("auth_token")?.value;
  if (!requireAuth(authToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "").trim();
    const campo = String(body.campo || "").trim();
    const valor = String(body.valor || "").trim();
    const mensagem = body.mensagem != null ? String(body.mensagem) : undefined;
    if (!cardId || !campo || !valor) {
      return NextResponse.json({ error: "cardId, campo e valor obrigatórios" }, { status: 400 });
    }

    const atual = (await lerStatus(cardId)) || {};
    atual[campo] = mensagem != null ? { valor, mensagem } : { valor };
    atual._updatedAt = new Date().toISOString();

    await put(pathFor(cardId), JSON.stringify(atual), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({ success: true, status: atual });
  } catch (error: any) {
    return errorResponse(error, { fallback: "Erro ao salvar status", status: 500 });
  }
}
