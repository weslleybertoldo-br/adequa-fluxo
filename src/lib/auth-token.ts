import { createHmac } from "crypto";

const TOKEN_SECRET = process.env.TOKEN_SECRET || "";

// Domínio Google permitido para login (override via env, default Seazone)
export const ALLOWED_DOMAIN = process.env.AUTH_ALLOWED_DOMAIN || "seazone.com.br";

// Assina token de sessão (mesmo formato verificado por requireAuth em lib/pipefy.ts)
export function signToken(email: string): string {
  const payload = `${email}:${Date.now()}`;
  const signature = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

export const AUTH_COOKIE = {
  name: "auth_token",
  opts: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24,
    path: "/",
  },
} as const;
