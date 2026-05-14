import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function htmlPage(tokens: Record<string, unknown> | { error: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Drive conectado</title></head>
<body style="font-family:sans-serif;padding:24px">
<p>${"error" in tokens ? `❌ Erro: ${tokens.error}` : "✓ Drive conectado. Voltando ao app…"}</p>
<script>
  (function() {
    const payload = ${JSON.stringify(tokens)};
    try { if (window.opener) { window.opener.postMessage({ type: "gdrive-oauth", payload }, "*"); } } catch (e) {}
    setTimeout(function() { window.close(); }, ${"error" in tokens ? 4000 : 500});
  })();
</script>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam || !code) {
    return new NextResponse(htmlPage({ error: errorParam || "code ausente" }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const client_id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const client_secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    return new NextResponse(htmlPage({ error: "GOOGLE_OAUTH_CLIENT_* não configurado" }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const body = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: `${origin}/api/google-oauth-callback`,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !j.access_token) {
    return new NextResponse(
      htmlPage({ error: j.error_description || j.error || `Google ${tokenRes.status}` }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(
    htmlPage({
      access_token: j.access_token,
      refresh_token: j.refresh_token || null,
      expires_in: j.expires_in,
      scope: j.scope,
    }),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
