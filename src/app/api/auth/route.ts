import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_SECRET = process.env.TOKEN_SECRET || "";

function verifyToken(token: string): boolean {
  try {
    if (!TOKEN_SECRET) return false;
    const decoded = Buffer.from(token, "base64").toString();
    const parts = decoded.split(":");
    if (parts.length < 3) return false;
    const signature = parts.pop()!;
    const payload = parts.join(":");
    const expected = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
    const sigBuf = Buffer.from(signature, "utf-8");
    const expBuf = Buffer.from(expected, "utf-8");
    if (sigBuf.length !== expBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expBuf)) return false;
    // Verificar expiração (24h)
    const timestamp = parseInt(parts[1]);
    if (isNaN(timestamp) || Date.now() - timestamp > 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  return response;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}
