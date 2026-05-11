import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function errorResponse(
  err: unknown,
  opts: { status?: number; context?: string; fallback?: string } = {}
) {
  const { status = 500, context, fallback = "Erro interno" } = opts;
  const detail = errorMessage(err);
  const tag = context ? `[${context}] ` : "";
  console.error(`${tag}${detail}`);
  return NextResponse.json(
    { error: isProd ? fallback : detail },
    { status }
  );
}
