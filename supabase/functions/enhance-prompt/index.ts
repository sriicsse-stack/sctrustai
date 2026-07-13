import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── Prompt Enhancement System ────────────────────────────────────────────────
const ENHANCE_SYSTEM = `You are an expert AI app prompt engineer specializing in transforming rough ideas into vivid, detailed app descriptions that generate stunning dashboards with rich data, charts, and management features.

Given a rough user idea, return a SINGLE enhanced prompt string (no JSON, no explanation, no markdown) that:

1. Identifies the exact domain (healthcare, e-commerce, finance, HR, restaurant, education, logistics, etc.)
2. Names the specific app (e.g. "MediTrack Hospital Management System")
3. Lists 5-8 concrete features with domain-specific terminology
4. Mentions realistic data entities (e.g. "patient records with diagnosis history", "inventory with SKU tracking")
5. Specifies key dashboard elements (stats, charts, tables, quick actions)
6. Keeps the total length under 80 words — punchy and specific

EXAMPLES:

Input: "hospital management"
Output: Build MediTrack Hospital Management System with patient registration & medical records, appointment scheduling with doctor availability calendar, department management (Cardiology, Pediatrics, Emergency), staff shift scheduling, real-time bed availability dashboard, prescription tracking, and billing/insurance processing. Dashboard shows today's admissions, patient queue, department occupancy stats, weekly discharge chart, and critical alert feed.

Input: "online store"  
Output: Build ShopFlow E-Commerce Management Platform with product catalog & inventory tracking by SKU, order management with status pipeline (Pending → Shipped → Delivered), customer profiles with purchase history, revenue analytics with daily sales chart, discount code management, supplier management, and automated low-stock alerts. Dashboard shows today's orders, revenue KPIs, top products, and recent customer activity.

Input: "school management"
Output: Build EduSync School Management System with student enrollment & grade tracking, class scheduling with teacher assignments, attendance monitoring with daily reports, parent-teacher communication portal, exam results with performance analytics, library book management, and fee collection tracking. Dashboard shows enrollment stats, today's attendance rate, upcoming exams, and recent activity feed.

Input: "todo list"
Output: Build TaskMaster Pro — a smart personal productivity dashboard with draggable task boards (To-Do, In Progress, Done), priority labels (Critical/High/Normal), deadline countdown timers, project grouping with progress bars, team member assignment, recurring task templates, and daily focus mode. Dashboard shows tasks due today, weekly completion rate chart, overdue alerts, and productivity streak tracker.

Now enhance the following user input into a detailed app prompt. Return ONLY the enhanced prompt text — no labels, no quotes, no explanation.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model  = Deno.env.get("MODEL") || "openai/gpt-4o-mini";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[enhance-prompt] model=${model} input="${prompt.substring(0, 80)}"`);

    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://medo.dev",
        "X-Title": "Trust Me AI Builder — Prompt Enhancer",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: ENHANCE_SYSTEM },
          { role: "user", content: prompt.trim() },
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: false,
      }),
    });

    const resText = await res.text();
    console.log(`[enhance-prompt] status=${res.status} snippet="${resText.substring(0, 100)}"`);

    if (!res.ok) {
      const errMsg = (() => { try { return JSON.parse(resText).error?.message; } catch { return null; } })()
        || `HTTP ${res.status}`;
      return new Response(JSON.stringify({ error: `Enhancement failed: ${errMsg}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(resText);
    const enhanced = (result.choices?.[0]?.message?.content || "").trim();

    if (!enhanced) {
      return new Response(JSON.stringify({ error: "No enhanced prompt returned." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ enhanced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[enhance-prompt] ERROR: ${err?.message}`);
    return new Response(JSON.stringify({ error: err?.message || "Enhancement failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
