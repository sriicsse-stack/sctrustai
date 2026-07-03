import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * deploy-app — Real deployment via Supabase Storage.
 *
 * Flow:
 *  1. Validate inputs
 *  2. Upload previewHtml to storage bucket "published-apps" as index.html
 *  3. Get the real public URL
 *  4. Verify the URL returns HTTP 200 (with retry)
 *  5. Only then respond success with the verified URL
 *
 * Never returns a URL that hasn't been confirmed accessible.
 */

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET            = "published-apps";

/** Retry a fetch until it returns 200 or attempts are exhausted.
 *  On the final successful attempt also checks Content-Type contains "text/html"
 *  so we know browsers will render the file (not download raw bytes).
 */
async function verifyUrl(url: string, maxAttempts = 5, delayMs = 1500): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.ok) {
        const ct = r.headers.get("content-type") || "";
        // Confirm the file is served as HTML so browsers render it correctly
        if (ct.includes("text/html")) return true;
        // Content-Type not yet propagated — storage CDN can lag; keep retrying
      }
    } catch { /* network error — retry */ }
    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const logs: string[] = [];
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    logs.push(line);
    console.log(`[deploy-app] ${msg}`);
  };

  try {
    const { projectId, projectName, previewHtml } = await req.json();

    if (!projectId || !previewHtml) {
      return new Response(
        JSON.stringify({ error: "projectId and previewHtml are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: storage credentials missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build slug for the file path ─────────────────────────────────────────
    const slug = (projectName || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 32) || "app";
    const deployId = Math.random().toString(36).substring(2, 8);
    const filePath = `${slug}-${deployId}/index.html`;

    log(`Building project "${projectName}" (${projectId})…`);
    log(`Packaging HTML bundle (${(previewHtml.length / 1024).toFixed(1)} KB)…`);

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    log(`Uploading to storage: ${BUCKET}/${filePath}…`);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── Validate input is non-empty HTML ─────────────────────────────────────
    if (typeof previewHtml !== "string" || previewHtml.trim().length < 10) {
      throw new Error("Build artifact is empty or invalid. Aborting upload.");
    }

    const htmlBytes = new TextEncoder().encode(previewHtml);

    // IMPORTANT: Use bare "text/html" (no charset suffix).
    // Supabase Storage does exact MIME matching — "text/html; charset=utf-8"
    // does NOT match the bucket's allowed "text/html" entry and causes:
    // "mime type text/html; charset=utf-8 is not supported"
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, htmlBytes, {
        contentType: "text/html",
        upsert: true,
        cacheControl: "no-cache",
      });

    if (uploadError) {
      log(`Upload failed: ${uploadError.message}`);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    log(`Upload successful.`);

    // ── Get the real public URL ───────────────────────────────────────────────
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    const liveUrl = urlData.publicUrl;

    if (!liveUrl) {
      throw new Error("Could not generate public URL from storage.");
    }

    log(`Public URL generated: ${liveUrl}`);

    // ── Verify URL returns HTTP 200 AND serves the correct Content-Type ───────
    log(`Verifying deployment accessibility and content-type…`);
    const verified = await verifyUrl(liveUrl);

    if (!verified) {
      // Clean up the uploaded file since we can't verify it
      await supabase.storage.from(BUCKET).remove([filePath]);
      log(`Verification failed — file removed.`);
      throw new Error(
        "Deployment uploaded but URL verification failed. The file may not be publicly accessible yet. Please try again."
      );
    }

    log(`✅ Deployment verified — app is publicly accessible at: ${liveUrl}`);

    // ── Return the real public storage URL as the live URL ───────────────────
    // Supabase Storage honors the contentType set at upload time ("text/html").
    // The public storage URL is a genuine public web URL — no auth headers,
    // no API keys, no edge function proxying required. This is a real browser-
    // renderable URL that any user can open directly without signing in.
    return new Response(
      JSON.stringify({
        success: true,
        liveUrl,          // ← direct public storage URL, no auth required
        storageUrl: liveUrl,
        verified: true,
        deployment: {
          id: `dep_${deployId}`,
          projectId,
          platform: "supabase-storage",
          url: liveUrl,
          status: "live",
          logs,
          createdAt: new Date().toISOString(),
        },
        message: "Deployment successful and verified.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    logs.push(`[${new Date().toISOString()}] ❌ ERROR: ${err?.message}`);
    console.error(`[deploy-app] ERROR: ${err?.message}`);
    return new Response(
      JSON.stringify({
        error: err?.message || "Deployment failed.",
        success: false,
        verified: false,
        logs,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
