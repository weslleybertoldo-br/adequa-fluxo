import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = (await req.json()) as { refresh_token?: string };
    if (!refresh_token) return NextResponse.json({ error: "refresh_token requerido" }, { status: 400 });

    const client_id = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const client_secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      return NextResponse.json({ error: "Server sem GOOGLE_OAUTH_CLIENT_ID/SECRET configurado" }, { status: 500 });
    }

    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token, client_id, client_secret });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !j.access_token) {
      return NextResponse.json({ error: j.error_description || j.error || `Google ${res.status}` }, { status: 401 });
    }
    return NextResponse.json({ access_token: j.access_token, expires_in: j.expires_in });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
