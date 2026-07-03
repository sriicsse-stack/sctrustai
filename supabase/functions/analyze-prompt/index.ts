import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeParseJSON(raw: string): any {
  if (!raw) return {};
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  try {
    const repaired = text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    return JSON.parse(repaired);
  } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return {};
}

// ── Confidence-scored type detection ───────────────────────────────────────────
interface TypeResult { type: string; confidence: number; signals: string[] }

function detectTypeWithConfidence(p: string): TypeResult {
  const signals: string[] = [];
  const pl = p.toLowerCase();

  // ── GAME MODE: HIGHEST PRIORITY ──────────────────────────────────────────────
  if (/\bsnake\b/.test(pl)) { signals.push("snake_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bflappy\b/.test(pl)) { signals.push("flappy_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\btetris\b/.test(pl)) { signals.push("tetris_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bmario\b/.test(pl)) { signals.push("mario_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\barkanoid\b/.test(pl)) { signals.push("arkanoid_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bspace invaders\b/.test(pl)) { signals.push("space_invaders_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\basteroids\b/.test(pl)) { signals.push("asteroids_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\btower defense\b/.test(pl)) { signals.push("tower_defense_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bendless runner\b/.test(pl)) { signals.push("endless_runner_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bmatch[- ]?3\b/.test(pl)) { signals.push("match3_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bspace shooter\b/.test(pl)) { signals.push("space_shooter_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bbreakout\b/.test(pl)) { signals.push("breakout_keyword"); return { type: "game", confidence: 0.98, signals }; }
  if (/\bplatformer\b/.test(pl)) { signals.push("platformer_keyword"); return { type: "game", confidence: 0.97, signals }; }
  if (/\brpg\b/.test(pl)) { signals.push("rpg_keyword"); return { type: "game", confidence: 0.95, signals }; }
  if (/\bpuzzle\b/.test(pl)) { signals.push("puzzle_keyword"); return { type: "game", confidence: 0.95, signals }; }
  if (/\bracing game\b/.test(pl)) { signals.push("racing_keyword"); return { type: "game", confidence: 0.97, signals }; }
  if (/\bshooter game\b/.test(pl)) { signals.push("shooter_keyword"); return { type: "game", confidence: 0.97, signals }; }
  if (/\bhtml5 game\b|\bcanvas game\b|\bweb game\b|\barcade game\b/.test(pl)) { signals.push("html5_game_keyword"); return { type: "game", confidence: 0.97, signals }; }
  if (/\b2d game\b|\b3d game\b/.test(pl)) { signals.push("2d3d_game_keyword"); return { type: "game", confidence: 0.96, signals }; }
  if (/\bgame\b/.test(pl) && /\bplayable\b|\bscore\b|\blives\b|\blevel\b|\bcontrols\b|\benemy\b|\bcollision\b|\bwave\b|\bboss\b/.test(pl)) { signals.push("game+mechanic_keyword"); return { type: "game", confidence: 0.95, signals }; }
  if (/\bbuild a game\b|\bcreate a game\b|\bmake a game\b|\bgame app\b|\bgame website\b|\bmini game\b/.test(pl)) { signals.push("build_game_keyword"); return { type: "game", confidence: 0.94, signals }; }

  // ── SPECIFIC TOOL/APPLICATION TYPES ─────────────────────────────────────────
  if (/\bcalculator\b|math tool|arithmetic helper/.test(pl)) { signals.push("calculator_keyword"); return { type: "calculator", confidence: 0.98, signals }; }
  if (/\btimer\b|stopwatch|countdown|pomodoro/.test(pl)) { signals.push("timer_keyword"); return { type: "timer", confidence: 0.97, signals }; }
  if (/\bconverter\b|unit conv|currency conv/.test(pl)) { signals.push("converter_keyword"); return { type: "converter", confidence: 0.96, signals }; }
  if (/\bquiz\b|trivia|flashcard|mcq/.test(pl)) { signals.push("quiz_keyword"); return { type: "quiz", confidence: 0.96, signals }; }
  if (/\balarm\b|wake.?up|alarm clock/.test(pl)) { signals.push("alarm_keyword"); return { type: "alarm", confidence: 0.96, signals }; }
  if (/\bnotes?\b|notepad|notebook|journal|memo|diary/.test(pl)) { signals.push("notes_keyword"); return { type: "notes", confidence: 0.96, signals }; }
  if (/\btodo\b|to[- ]do|task manager|checklist/.test(pl)) { signals.push("todo_keyword"); return { type: "todo", confidence: 0.96, signals }; }
  if (/\bchat\b|messaging|whatsapp|telegram|discord|inbox/.test(pl)) { signals.push("chat_keyword"); return { type: "chat", confidence: 0.95, signals }; }
  if (/\bweather\b|forecast|temperature/.test(pl)) { signals.push("weather_keyword"); return { type: "weather", confidence: 0.97, signals }; }

  // ── CONTENT & MEDIA ────────────────────────────────────────────────────────────
  if (/portfolio|personal site|resume site|showcase|dev profile/.test(pl)) { signals.push("portfolio_keyword"); return { type: "portfolio", confidence: 0.95, signals }; }
  if (/\bmusic\b|spotify|playlist|audio player/.test(pl)) { signals.push("music_keyword"); return { type: "music", confidence: 0.95, signals }; }
  if (/\brecipe\b|cooking|meal planner/.test(pl)) { signals.push("recipe_keyword"); return { type: "recipe", confidence: 0.94, signals }; }
  if (/fitness|workout|gym|exercise tracker/.test(pl)) { signals.push("fitness_keyword"); return { type: "fitness", confidence: 0.94, signals }; }
  if (/finance|budget|expense|money tracker/.test(pl)) { signals.push("finance_keyword"); return { type: "finance", confidence: 0.94, signals }; }
  if (/travel|trip planner|hotel|flight/.test(pl)) { signals.push("travel_keyword"); return { type: "travel", confidence: 0.94, signals }; }
  if (/news|blog|article reader/.test(pl)) { signals.push("news_keyword"); return { type: "news", confidence: 0.93, signals }; }
  if (/image gen|ai art|text.?to.?image/.test(pl)) { signals.push("image_gen_keyword"); return { type: "image_generator", confidence: 0.95, signals }; }

  // ── BUSINESS / COMMERCE ──────────────────────────────────────────────────────
  if (/e[- ]?commerce|shopping|online store|product catalog|marketplace/.test(pl)) { signals.push("ecommerce_keyword"); return { type: "ecommerce", confidence: 0.95, signals }; }
  if (/\bform\b|survey|questionnaire|feedback|sign.?up/.test(pl)) { signals.push("form_keyword"); return { type: "form", confidence: 0.94, signals }; }
  if (/\blms\b|learning management|online course|e[- ]learning|udemy|coursera/.test(pl)) { signals.push("lms_keyword"); return { type: "lms", confidence: 0.94, signals }; }
  if (/\bcrm\b|customer relationship|sales pipeline/.test(pl)) { signals.push("crm_keyword"); return { type: "crm", confidence: 0.94, signals }; }

  // ── DASHBOARD / ADMIN (must come AFTER specific types) ───────────────────────
  if (/hospital|clinic|patient management|healthcare|medical system/.test(pl)) { signals.push("healthcare_dashboard"); return { type: "dashboard", confidence: 0.92, signals }; }
  if (/school|student management|course management/.test(pl)) { signals.push("school_dashboard"); return { type: "dashboard", confidence: 0.90, signals }; }
  if (/\bhrms\b|hr system|\berp\b/.test(pl)) { signals.push("hr_erp_keyword"); return { type: "dashboard", confidence: 0.92, signals }; }
  if (/\bdashboard\b|admin panel|management system|control panel|analytics/.test(pl)) { signals.push("dashboard_keyword"); return { type: "dashboard", confidence: 0.95, signals }; }

  // ── LANDING / MARKETING (default for most websites) ──────────────────────────
  if (/landing page|one.?page|hero page|sales page|waitlist|launch page|marketing/.test(pl)) { signals.push("landing_keyword"); return { type: "landing", confidence: 0.94, signals }; }
  if (/website|web page|web app|site/.test(pl)) { signals.push("website_keyword"); return { type: "landing", confidence: 0.80, signals }; }

  // ── DEFAULT: landing page (safer than dashboard for unknown requests) ─────────
  signals.push("default_fallback");
  return { type: "landing", confidence: 0.60, signals };
}

// Backward-compatible wrapper
function detectType(p: string): string { return detectTypeWithConfidence(p).type; }

const TYPE_META: Record<string, { name: string; description: string; features: string[]; pages: string[]; db: string[]; apis: string[]; credits: number }> = {
  calculator: { name: "CalcPro", description: "Scientific calculator with history and unit conversion", features: ["Standard arithmetic", "Scientific functions", "Calculation history", "Unit converter", "Percentage calculator"], pages: ["Calculator Screen", "History", "Unit Converter", "Settings"], db: [], apis: [], credits: 5 },
  timer:   { name: "TimerApp", description: "Multi-timer, stopwatch, and Pomodoro productivity tool", features: ["Countdown timer", "Stopwatch", "Pomodoro sessions", "Lap tracking", "Alarm alerts"], pages: ["Timer", "Stopwatch", "Pomodoro", "History"], db: [], apis: [], credits: 5 },
  alarm:   { name: "AlarmClock", description: "Smart alarm app with scheduling, snooze, and repeat rules", features: ["Set & manage alarms", "Snooze control", "Repeat by weekday", "Sound selection", "Sleep reminder"], pages: ["Alarm List", "Add Alarm", "Time Picker", "Settings"], db: ["alarms"], apis: ["POST /api/alarms", "PUT /api/alarms/:id"], credits: 5 },
  notes:   { name: "NoteFlow", description: "Clean note-taking app with markdown and search", features: ["Rich text editing", "Tags & folders", "Full-text search", "Pin important notes", "Export notes"], pages: ["Notes List", "Editor", "Tags", "Search"], db: ["notes", "tags"], apis: ["GET /api/notes", "POST /api/notes", "DELETE /api/notes/:id"], credits: 10 },
  todo:    { name: "TaskMaster", description: "Smart to-do list with priorities, deadlines, and streaks", features: ["Add/complete tasks", "Priority labels", "Due date reminders", "Project grouping", "Progress tracking"], pages: ["Today", "All Tasks", "Projects", "Completed"], db: ["tasks", "projects"], apis: ["GET /api/tasks", "POST /api/tasks", "PATCH /api/tasks/:id"], credits: 10 },
  chat:    { name: "ChatFlow", description: "Real-time messaging app with threads and file sharing", features: ["Real-time messages", "Chat rooms", "File attachments", "User presence", "Message search"], pages: ["Chat List", "Conversation", "Profile", "Settings"], db: ["messages", "conversations", "users"], apis: ["GET /api/messages", "POST /api/messages", "GET /api/rooms"], credits: 15 },
  ecommerce: { name: "ShopCore", description: "Full e-commerce storefront with cart, checkout, and orders", features: ["Product catalog", "Shopping cart", "Checkout flow", "Order tracking", "Product search & filters"], pages: ["Store", "Product Detail", "Cart", "Checkout", "Orders"], db: ["products", "orders", "cart_items", "customers"], apis: ["GET /api/products", "POST /api/orders", "GET /api/orders/:id"], credits: 15 },
  portfolio: { name: "PortfolioSite", description: "Personal portfolio with projects, skills, and contact", features: ["Hero section", "Project showcase", "Skills grid", "Work timeline", "Contact form"], pages: ["Home", "Projects", "About", "Skills", "Contact"], db: ["projects", "skills"], apis: ["GET /api/projects", "POST /api/contact"], credits: 10 },
  music:   { name: "MusicPlayer", description: "Music streaming UI with playlists and player controls", features: ["Now playing screen", "Playlist management", "Artist/album browse", "Play queue", "Favorites"], pages: ["Home", "Now Playing", "Library", "Playlists", "Search"], db: ["tracks", "playlists", "albums"], apis: ["GET /api/tracks", "GET /api/playlists"], credits: 10 },
  recipe:  { name: "RecipeApp", description: "Recipe discovery and meal planning app", features: ["Recipe browser", "Ingredient list", "Step-by-step instructions", "Meal planner", "Favorites & ratings"], pages: ["Discover", "Recipe Detail", "Meal Planner", "Saved"], db: ["recipes", "ingredients", "meal_plans"], apis: ["GET /api/recipes", "GET /api/recipes/:id"], credits: 10 },
  fitness: { name: "FitTrack", description: "Workout tracking and fitness progress dashboard", features: ["Workout logger", "Exercise library", "Progress charts", "Step counter", "Goal setting"], pages: ["Dashboard", "Workouts", "Exercise Log", "Progress", "Goals"], db: ["workouts", "exercises", "progress"], apis: ["GET /api/workouts", "POST /api/workouts", "GET /api/progress"], credits: 15 },
  finance: { name: "FinanceTracker", description: "Personal finance and expense tracking app", features: ["Expense logging", "Budget categories", "Income tracking", "Spending charts", "Monthly reports"], pages: ["Overview", "Transactions", "Budgets", "Reports", "Settings"], db: ["transactions", "budgets", "categories"], apis: ["GET /api/transactions", "POST /api/transactions", "GET /api/budgets"], credits: 15 },
  travel:  { name: "TravelApp", description: "Trip planning and destination discovery app", features: ["Destination browser", "Trip itinerary", "Hotel & flight search", "Travel checklist", "Maps integration"], pages: ["Explore", "My Trips", "Itinerary", "Bookings", "Wishlist"], db: ["trips", "destinations", "bookings"], apis: ["GET /api/destinations", "POST /api/trips"], credits: 15 },
  news:    { name: "NewsReader", description: "News aggregator with categories and bookmarks", features: ["Top headlines", "Category filters", "Article reader", "Bookmarks", "Breaking news alerts"], pages: ["Headlines", "Categories", "Article", "Bookmarks", "Search"], db: ["articles", "bookmarks", "categories"], apis: ["GET /api/articles", "GET /api/articles/:id"], credits: 10 },
  weather: { name: "WeatherApp", description: "Weather forecast with hourly and 7-day outlook", features: ["Current conditions", "Hourly forecast", "7-day forecast", "Location search", "Severe weather alerts"], pages: ["Today", "Hourly", "7-Day", "Locations"], db: [], apis: ["GET /api/weather/current", "GET /api/weather/forecast"], credits: 5 },
  form:    { name: "FormBuilder", description: "Smart form with validation and submission tracking", features: ["Form fields", "Input validation", "File upload", "Success confirmation", "Submission log"], pages: ["Form", "Thank You", "Admin View"], db: ["submissions"], apis: ["POST /api/submit", "GET /api/submissions"], credits: 5 },
  landing: { name: "LandingPage", description: "High-converting product landing page", features: ["Hero section", "Features showcase", "Pricing table", "Testimonials", "CTA & signup"], pages: ["Hero", "Features", "Pricing", "FAQ", "Contact"], db: ["leads"], apis: ["POST /api/leads"], credits: 5 },
  image_generator: { name: "AIArtStudio", description: "AI image generation interface with style options", features: ["Text-to-image prompt", "Style selector", "Gallery history", "Image download", "Prompt suggestions"], pages: ["Generator", "Gallery", "Styles", "Settings"], db: ["generations"], apis: ["POST /api/generate", "GET /api/gallery"], credits: 15 },
  game: { name: "ArcadeGame", description: "Complete HTML5 Canvas game with scoring, levels, and sound effects", features: ["Canvas rendering", "Game loop", "Scoring system", "Progressive difficulty", "Sound effects", "Particle effects", "Keyboard controls", "Game over / restart"], pages: ["Title Screen", "Gameplay", "Game Over", "High Scores"], db: [], apis: [], credits: 20 },
  dashboard: { name: "AdminDashboard", description: "Data-rich management dashboard with analytics", features: ["KPI cards", "Analytics charts", "Data tables", "User management", "Reports export"], pages: ["Dashboard", "Data Management", "Users", "Reports", "Settings"], db: ["users", "records", "activity_logs", "settings"], apis: ["GET /api/stats", "GET /api/data", "POST /api/action"], credits: 30 },
};

function buildFallback(prompt: string): any {
  const type = detectType(prompt.toLowerCase());
  const meta = TYPE_META[type] || TYPE_META["landing"];
  return {
    prompt,
    name: meta.name,
    description: meta.description,
    analysis: {
      features: meta.features,
      pages: meta.pages,
      apis: meta.apis,
      database: meta.db,
      keyComponents: meta.pages.map(p => p.replace(/\s+/g, "") + "View"),
      cost: { apiCallCost: "$0.002", hostingCost: "$5.00/mo", databaseCost: "Supabase free tier" },
      deploymentStrategy: "Vercel + Supabase",
      requiredCredits: meta.credits
    },
    keyComponents: meta.pages.map(p => p.replace(/\s+/g, "") + "View"),
    cost: { apiCallCost: "$0.002", hostingCost: "$5.00/mo", databaseCost: "Supabase free tier" },
    deploymentStrategy: "Vercel + Supabase",
    requiredCredits: meta.credits
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fallback = buildFallback(prompt);
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("MODEL") || "openai/gpt-4o-mini";

    if (!apiKey || apiKey === "your_openrouter_api_key") {
      return new Response(
        JSON.stringify(fallback),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Intent classification with confidence ───────────────────────────────────
    const detected = detectTypeWithConfidence(prompt);
    const meta = TYPE_META[detected.type] || TYPE_META["landing"];

    // Build type-specific context to guide the AI
    const typeContext = detected.type === "game"
      ? `CRITICAL: The user is asking for a GAME. You MUST generate game-specific analysis:
- Focus on: game mechanics, scoring system, controls, enemy types, power-ups, levels/waves, visual style
- Pages should be: Title Screen, Gameplay, Game Over, High Scores (NOT Dashboard, Analytics, Admin)
- Do NOT generate dashboard metrics, KPIs, or business data
- Use game-friendly colors (neon, dark theme, vibrant accents)`
      : detected.type === "dashboard"
      ? `The user is asking for a DASHBOARD / ADMIN system:
- Focus on: KPIs, data tables, charts, user management, admin controls
- Include realistic mock data and metrics`
      : detected.type === "ecommerce"
      ? `The user is asking for an E-COMMERCE / SHOPPING app:
- Focus on: product catalog, shopping cart, checkout, orders, search/filter
- Include realistic product names, prices, categories`
      : detected.type === "portfolio"
      ? `The user is asking for a PORTFOLIO / PERSONAL WEBSITE:
- Focus on: hero section, project showcase, skills, about, contact
- Generate realistic project names and tech stacks`
      : `The user is asking for a ${meta.name}:
- Focus on the core features and pages relevant to this type`

    const promptInstructions = `You are an expert Product Analyst AI. Your job is to deeply analyze the user's app idea and return a rich, structured JSON object that EXACTLY matches what the user requested.

⚠️ CRITICAL RULES:
1. The user asked for: "${prompt}"
2. Detected intent: ${detected.type.toUpperCase()} (confidence: ${Math.round(detected.confidence * 100)}%)
3. ${typeContext}
4. NEVER generate a dashboard, admin panel, or analytics page unless the user EXPLICITLY asked for one
5. NEVER replace the user's request with a generic template
6. If the user asked for a game, your output MUST be game-focused (mechanics, scoring, controls) — NOT business-focused
7. If the user asked for a portfolio, your output MUST be portfolio-focused (projects, skills, showcase) — NOT admin-focused
8. Always ask: "Is my output EXACTLY what the user requested?" If NO, regenerate.

OUTPUT FORMAT — respond ONLY with a single raw JSON object:
{
  "projectType": "Name of the project (e.g., Snake Game, Portfolio Website, Task Manager)",
  "intent": "${detected.type}",
  "confidence": ${detected.confidence},
  "complexity": "small | medium | large",
  "domain": "relevant domain",
  "colorScheme": { "primary": "#hex", "accent": "#hex", "bg": "#hex" },
  "targetUsers": ["User group 1", "User group 2"],
  "coreFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "pages": [
    { "name": "Page Name", "route": "/route", "priority": "high|medium|low", "components": ["Component1", "Component2"] }
  ],
  "databaseTables": [
    { "table": "table_name", "fields": ["id", "field1", "field2"] }
  ],
  "kpis": [
    { "label": "Metric Name", "value": "1,000", "trend": "+10%" }
  ],
  "mockDataExamples": {
    "entities": ["Example 1", "Example 2"],
    "statuses": ["Status A", "Status B"],
    "categories": ["Category 1", "Category 2"]
  },
  "techStack": { "frontend": "React 18 + TypeScript + Tailwind CSS", "backend": "Supabase" },
  "security": "Security approach",
  "fileTree": ["src/App.tsx", "src/components/..."]
}

SELF-CHECK before responding:
- Did the user ask for a game? If yes, is my output game-focused with mechanics/scoring?
- Did the user ask for a portfolio? If yes, is my output portfolio-focused with projects?
- Did the user ask for a dashboard? If yes, is my output dashboard-focused with KPIs?
- If my output does NOT match the user's request, STOP and regenerate.

Analyze: "${prompt}"
Return ONLY the JSON object.`;

    console.log(`[analyze-prompt] model=${model} prompt="${prompt.substring(0, 80)}"`);

    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://medo.dev",
        "X-Title": "Trust Me AI Builder - Analyze Prompt"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptInstructions }],
        max_tokens: 800,
        stream: false
      })
    });

    const resText = await res.text();
    console.log(`[analyze-prompt] OpenRouter status=${res.status} snippet="${resText.substring(0, 150)}"`);

    if (!res.ok) {
      console.error(`[analyze-prompt] OpenRouter error ${res.status}`);
      return new Response(
        JSON.stringify(fallback),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(resText);
    const raw = result.choices?.[0]?.message?.content || "{}";
    const parsed = safeParseJSON(raw);

    // ── INTENT RECONCILIATION ──────────────────────────────────────────────────
    // The AI may hallucinate a wrong type. Override with our high-confidence detection.
    const aiIntent = parsed.intent || "";
    const finalType = detected.confidence >= 0.90 && detected.type !== aiIntent
      ? detected.type  // Override AI when we have very high confidence
      : (aiIntent || detected.type);
    const finalMeta = TYPE_META[finalType] || TYPE_META["landing"];

    console.log(`[analyze-prompt] detected=${detected.type}(${detected.confidence}) aiIntent=${aiIntent} final=${finalType}`);

    // If AI returned wrong-type data (e.g., dashboard data for a game request),
    // use fallback metadata for the correct type instead
    const reconciled = detected.confidence >= 0.90 && aiIntent && aiIntent !== detected.type;

    const aiName = reconciled ? finalMeta.name : (parsed.projectType || parsed.name || fallback.name);
    const aiDescription = reconciled ? finalMeta.description : (parsed.description || (parsed.domain ? `${parsed.projectType} — ${parsed.domain} platform` : fallback.description));
    const aiFeatures = reconciled ? finalMeta.features : (parsed.coreFeatures || parsed.features || fallback.analysis.features);
    const aiPages = reconciled
      ? finalMeta.pages
      : (Array.isArray(parsed.pages)
        ? parsed.pages.map((p: any) => (typeof p === "string" ? p : p.name || "Page"))
        : fallback.analysis.pages);
    const aiApis = Array.isArray(parsed.databaseTables)
      ? parsed.databaseTables.map((t: any) => `GET /api/${t.table || "data"}`)
      : fallback.analysis.apis;
    const aiDb = Array.isArray(parsed.databaseTables)
      ? parsed.databaseTables.map((t: any) => t.table || "records")
      : fallback.analysis.database;
    const aiComponents = aiPages.map((p: string) => p.replace(/\s+/g, "") + "View");

    return new Response(
      JSON.stringify({
        prompt,
        name: aiName,
        description: aiDescription,
        intent: finalType,
        confidence: Math.max(detected.confidence, parsed.confidence || 0),
        signals: detected.signals,
        analysis: {
          features: aiFeatures,
          pages: aiPages,
          apis: aiApis,
          database: aiDb,
          keyComponents: aiComponents,
          cost: fallback.analysis.cost,
          deploymentStrategy: parsed.techStack?.backend ? `${parsed.techStack.frontend?.split(" ")[0] || "React"} + Supabase` : fallback.analysis.deploymentStrategy,
          requiredCredits: finalMeta.credits || fallback.analysis.requiredCredits
        },
        keyComponents: aiComponents,
        cost: fallback.analysis.cost,
        deploymentStrategy: fallback.analysis.deploymentStrategy,
        requiredCredits: finalMeta.credits || fallback.analysis.requiredCredits
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[analyze-prompt] ERROR: ${err?.message}`);
    // Always return a valid fallback — never fail with an error
    try {
      const { prompt: p } = await req.clone().json().catch(() => ({ prompt: "app" }));
      return new Response(
        JSON.stringify(buildFallback(p || "app")),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(
        JSON.stringify(buildFallback("app")),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
});
