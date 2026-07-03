import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeParseJSON(raw: string): any {
  // Strip markdown code fences if model wraps response
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Attempt 1: clean parse
  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  // Attempt 2: fix common model mistakes — invalid escape sequences like "\ n" or "\ t"
  try {
    const repaired = cleaned
      .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")  // escape lone backslashes
      .replace(/\n/g, "\\n")                    // literal newlines inside strings
      .replace(/\r/g, "\\r");
    return JSON.parse(repaired);
  } catch { /* fall through */ }

  // Attempt 3: extract first JSON object from messy output
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
    // Attempt 4: repair extracted object too
    try {
      const repaired = match[0].replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      return JSON.parse(repaired);
    } catch { /* fall through */ }
  }

  // Final fallback: treat the whole string as plain text reply
  return { reply: cleaned, fixAvailable: false, suggestedFixPrompt: "" };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, projectId, projectName: pName, projectCodeSnippet: pSnippet, attachmentType, attachmentContent, logDump, history, userName: uName } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    // Use a specific, reliable model — openrouter/auto can fail on some accounts
    const model = Deno.env.get("MODEL") || "openai/gpt-4o-mini";
    console.log(`[sri-ai] apiKey present: ${!!apiKey}, model: ${model}`);
    const userName = uName || "Developer";
    const projectName = pName || "General System Help";
    const projectCodeSnippet = pSnippet || "No active project context selected.";

    // Detect language for static fallbacks
    const queryLower = message.toLowerCase();
    const isTamil = queryLower.includes("எனக்கு") || queryLower.includes("பண்ணு") || queryLower.includes("செய்") || queryLower.includes("tamil");
    const isHindi = queryLower.includes("बनाओ") || queryLower.includes("कैसे") || queryLower.includes("hindi");

    let fixAvailable = false;
    let fallbackReply = "";

    if (queryLower.includes("deploy") || queryLower.includes("fail") || queryLower.includes("error") || logDump) {
      fixAvailable = true;
      fallbackReply = isTamil
        ? `🔍 **Sri AI பில்ட் பிழை கண்டறிதல்**\n\nமாடுல் ரிசால்வ் பிரச்சினை கண்டறியப்பட்டது. தானியங்கி திருத்தம் செய்ய விரும்புகிறீர்களா?`
        : `🔍 **Sri AI Build Diagnostics for ${projectName}**\n\nDetected a module resolution failure. Would you like me to trigger an Auto-Fix?`;
    } else if (isTamil) {
      fallbackReply = `👋 வணக்கம்! நான் **Sri AI**, உங்கள் தொழில்நுட்பத் துணைவர்! எப்படி உதவட்டுமா?`;
    } else if (isHindi) {
      fallbackReply = `👋 नमस्ते! मैं **Sri AI** हूँ। आपकी क्या मदद कर सकता हूँ?`;
    } else {
      fallbackReply = `👋 Hello ${userName}! I am **Sri AI**, your dedicated technical co-founder for Trust Me AI Builder. How can I help you today?`;
    }

    // If no API key configured, return smart static fallback
    if (!apiKey || apiKey === "your_openrouter_api_key") {
      return new Response(
        JSON.stringify({ reply: fallbackReply, fixAvailable, suggestedFixPrompt: "Update existing project to add defensive module guards and hotfix dependencies" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build system prompt
    const systemPrompt = `You are "Sri AI", an elite AI coding assistant inside 'Trust Me AI Builder' (Turn Ideas into Live Apps in Minutes).
Your personality: highly technical, professional, friendly, supportive, practical. Act as a technical co-founder.
The active user is named "${userName}". Address them naturally.
Keep casual replies short and engaging. Provide deep technical detail when asked technical questions.

MULTILINGUAL SUPPORT:
- Automatically detect language used by the user (Tamil, English, Hindi, Telugu, Malayalam, Kannada, Tanglish/Hinglish).
- Always respond in the EXACT same language the user used.

CAPABILITIES:
- Text Chat, Voice Input, Voice Output, File Upload, Image Analysis, Code Analysis.
- If user shares code/logs/schema, review and give detailed advice.
- Refer to conversation history when asked "continue", "explain more", etc.
- If user asks to create/build an app, confirm you will initiate the Speech-to-App Construction Pipeline.
- Suggest automated fix when they share compile errors or deployment logs.

Active project: "${projectName}"
Files preview:
${projectCodeSnippet}
Log dump: ${logDump || "None provided"}

RESPONSE FORMAT — MANDATORY:
Respond ONLY with a valid JSON object. No markdown outside the JSON.
{
  "reply": "<full response — use \\n for newlines, markdown inside the string>",
  "fixAvailable": <true if suggesting a code fix>,
  "suggestedFixPrompt": "<one-sentence prompt to trigger auto-fix, or empty string>"
}`;

    // Build messages array
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (history && Array.isArray(history)) {
      for (const item of history) {
        if (item.text) {
          messages.push({ role: item.role === "user" ? "user" : "assistant", content: item.text });
        }
      }
    }

    const attachmentSection = attachmentContent && attachmentType !== "image"
      ? `\n\n[Attachment (${attachmentType})]:\n${attachmentContent}` : "";
    const logSection = logDump ? `\n\n[Compilation Logs]:\n${logDump}` : "";
    const fullUserMessage = `User query: "${message}"${attachmentSection}${logSection}`;

    if (attachmentType === "image" && attachmentContent?.includes("base64,")) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: attachmentContent } },
          { type: "text", text: fullUserMessage }
        ]
      });
    } else {
      messages.push({ role: "user", content: fullUserMessage });
    }

    console.log(`[sri-ai] model=${model} messages=${messages.length} user=${userName}`);

    // Call OpenRouter — Deno handles request timeouts via the platform (max 150s)
    console.log(`[sri-ai] Calling OpenRouter model=${model} messages=${messages.length}`);
    const openRouterRes = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://medo.dev",
        "X-Title": "Trust Me AI Builder - Sri AI"
      },
      body: JSON.stringify({ model, messages, max_tokens: 1200, stream: false })
    });

    const responseText = await openRouterRes.text();
    console.log(`[sri-ai] OpenRouter status: ${openRouterRes.status}, body snippet: ${responseText.substring(0, 300)}`);

    if (!openRouterRes.ok) {
      console.error(`[sri-ai] OpenRouter error ${openRouterRes.status}: ${responseText.substring(0, 400)}`);
      return new Response(
        JSON.stringify({ reply: fallbackReply, fixAvailable, suggestedFixPrompt: "Retry your request", _warning: `OpenRouter ${openRouterRes.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(`[sri-ai] Failed to parse OpenRouter response: ${responseText.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ reply: fallbackReply, fixAvailable, suggestedFixPrompt: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawContent = result.choices?.[0]?.message?.content || "{}";
    console.log(`[sri-ai] OK — model: ${result.model || model}, tokens: ${JSON.stringify(result.usage || {})}`);
    console.log(`[sri-ai] Raw content snippet: ${rawContent.substring(0, 200)}`);

    const parsed = safeParseJSON(rawContent);
    return new Response(
      JSON.stringify({
        reply: parsed.reply || fallbackReply || "I'm here! How can I help you?",
        fixAvailable: parsed.fixAvailable ?? fixAvailable,
        suggestedFixPrompt: parsed.suggestedFixPrompt || "Update existing project to resolve any dependencies"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("timed out");
    console.error(`[sri-ai] ${isTimeout ? "TIMEOUT" : "ERROR"}: ${err?.name} — ${err?.message}`);
    return new Response(
      JSON.stringify({
        reply: isTimeout
          ? "Sri AI took a bit too long to respond. Please try again — I'm ready!"
          : `I'm Sri AI! There was an issue: ${err?.message || "unknown error"}. Please try again.`,
        fixAvailable: false,
        suggestedFixPrompt: ""
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
