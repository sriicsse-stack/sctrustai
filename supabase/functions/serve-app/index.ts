/**
 * serve-app — Serves deployed HTML files with the correct Content-Type.
 *
 * Supabase Storage serves files as application/octet-stream or text/plain
 * which causes browsers to display raw HTML source instead of rendering.
 * This function proxies the file and forces Content-Type: text/html; charset=UTF-8.
 *
 * Usage: GET /functions/v1/serve-app?path=<slug-deployid/index.html>
 */

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET           = "published-apps";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=UTF-8",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
};

const ERROR_PAGE = (msg: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Error</title>
<style>body{font-family:sans-serif;background:#0a0a0b;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px;}
h1{color:#ef4444;font-size:1.5rem;}p{font-size:.95rem;opacity:.7;}</style></head>
<body><h1>⚠️ Deployment Error</h1><p>${msg}</p></body></html>`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const url  = new URL(req.url);
  const path = url.searchParams.get("path");

  // Validate path — must be non-empty, no directory traversal
  if (!path || path.trim().length === 0) {
    return new Response(
      ERROR_PAGE("Missing <code>path</code> query parameter."),
      { status: 400, headers: HTML_HEADERS }
    );
  }

  const safePath = path.replace(/\.\./g, "").replace(/^\/+/, "");
  if (!safePath) {
    return new Response(
      ERROR_PAGE("Invalid path."),
      { status: 400, headers: HTML_HEADERS }
    );
  }

  try {
    // Build the raw storage URL and fetch directly
    // Pattern: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safePath}`;

    const storageRes = await fetch(storageUrl, {
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (!storageRes.ok) {
      if (storageRes.status === 404) {
        return new Response(
          ERROR_PAGE(`App not found at path: <code>${safePath}</code>`),
          { status: 404, headers: HTML_HEADERS }
        );
      }
      const errText = await storageRes.text().catch(() => "");
      throw new Error(`Storage fetch failed: ${storageRes.status} — ${errText.substring(0, 200)}`);
    }

    const htmlContent = await storageRes.text();

    // Validate we got actual HTML (not an error blob)
    if (htmlContent.trim().length < 10) {
      throw new Error("Fetched file is empty.");
    }

    return new Response(htmlContent, {
      status: 200,
      headers: HTML_HEADERS,
    });

  } catch (err: any) {
    console.error("[serve-app] ERROR:", err?.message);
    return new Response(
      ERROR_PAGE(`Failed to serve app: ${err?.message || "Unknown error"}`),
      { status: 500, headers: HTML_HEADERS }
    );
  }
});
