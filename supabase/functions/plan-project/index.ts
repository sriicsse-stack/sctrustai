import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeParseJSON(raw: string): any {
  if (!raw) return {};
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  try {
    const repaired = text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    return JSON.parse(repaired);
  } catch { /* fall through */ }
  const startIdx = text.search(/[\[{]/);
  if (startIdx !== -1) {
    const opener = text[startIdx];
    const closer = opener === "{" ? "}" : "]";
    let depth = 0, inString = false, escape = false;
    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === opener) depth++;
        else if (ch === closer) {
          depth--;
          if (depth === 0) {
            try { return JSON.parse(text.slice(startIdx, i + 1)); } catch { break; }
          }
        }
      }
    }
  }
  return {};
}

const SYSTEM_PROMPT = `You are an elite Software Architect AI. Your job is to take a user prompt and create a detailed project architecture plan.

OUTPUT FORMAT — respond with ONLY a single raw JSON object:
{
  "architecture": "<brief architecture summary>",
  "techStack": {
    "frontend": "React 18 + TypeScript + Tailwind CSS",
    "backend": "Supabase",
    "state": "React Hooks",
    "routing": "React Router"
  },
  "pages": [
    { "name": "Dashboard", "route": "/", "components": ["Sidebar", "Header", "StatCards", "RecentActivity"] },
    ...more pages
  ],
  "components": [
    { "name": "Sidebar", "props": ["items", "activeItem"], "description": "Collapsible left navigation" },
    ...more components
  ],
  "databaseSchema": [
    { "table": "patients", "fields": ["id UUID", "name TEXT", "age INTEGER", "diagnosis TEXT", "admitted_at TIMESTAMPTZ"] },
    ...more tables
  ],
  "apiEndpoints": [
    { "method": "GET", "path": "/api/patients", "description": "List all patients" },
    ...more endpoints
  ],
  "fileTree": [
    "src/App.tsx",
    "src/components/Sidebar.tsx",
    "src/components/Header.tsx",
    "src/pages/Dashboard.tsx",
    "src/lib/supabase.ts",
    "src/lib/mockData.ts",
    ...more files
  ],
  "implementationOrder": [
    "1. Setup project structure and routing",
    "2. Create Sidebar and Header components",
    "3. Build Dashboard with stat cards and data tables",
    ...more steps
  ]
}

RULES:
- Generate 4-8 pages depending on app complexity
- Generate 8-15 components
- Generate 2-6 database tables if the app needs data storage
- All page/component names must be descriptive and domain-specific
- fileTree must include ALL files that will be generated
- implementationOrder must have 5-10 concrete steps
- NEVER respond with chat text — ONLY the JSON object`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, analysis } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("MODEL") || "anthropic/claude-3.5-sonnet";
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisText = analysis
      ? `\n\nPrevious analysis:\n${JSON.stringify(analysis, null, 2)}`
      : "";

    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://medo.dev",
        "X-Title": "Trust Me AI Builder - Plan"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Create a detailed architecture plan for this app: "${prompt}"${analysisText}` }
        ],
        max_tokens: 1200,
        stream: false
      })
    });

    const resText = await res.text();
    if (!res.ok) {
      const errBody = safeParseJSON(resText).error?.message || `HTTP ${res.status}`;
      return new Response(
        JSON.stringify({ error: `Planning failed: ${errBody}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(resText);
    const raw = result.choices?.[0]?.message?.content || "{}";
    const plan = safeParseJSON(raw);

    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[plan-project] ERROR: ${err?.message}`);
    return new Response(
      JSON.stringify({ error: err?.message || "Planning failed." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
