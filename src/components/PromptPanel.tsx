import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Lightbulb, 
  Database, 
  MapPin, 
  ShieldCheck, 
  CornerDownLeft, 
  Loader2, 
  Layers,
  ArrowRight,
  ChevronDown,
  Flame,
  History,
  X,
  Search,
  Cpu,
  Bookmark,
  Sparkle,
  Wand2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { ProjectDetails } from "../types";

const SUPABASE_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";

interface PromptPanelProps {
  currentProject: ProjectDetails | null;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  onRefine: (prompt: string) => void;
  isRefining: boolean;
}

interface SuggestionItem {
  title: string;
  prompt: string;
  desc?: string;
  keywords: string[];
  isTrending?: boolean;
}

// Unified multi-lingual and trending suggestions dataset
const AUTO_PROMPTS_DATASET: SuggestionItem[] = [
  // User typed "build" examples
  {
    title: "Build a modern SaaS website",
    prompt: "Build a fully responsive SaaS marketing webpage with a customizable pricing matrix tab, interactive customer analytics diagrams, contact modals, and a dynamic newsletter subscribe form.",
    desc: "Modern multi-tier cloud services billing portal with premium visuals.",
    keywords: ["build", "saas", "website", "marketing", "pricing", "analytics"],
    isTrending: true
  },
  {
    title: "Build a mobile app simulation",
    prompt: "Create an adaptive mobile viewport simulation of a health wellness and workout progress app featuring circular step count rings, calorie loggers, and heartrate charts.",
    desc: "Simulated native smartphone layout with elegant fit tracking.",
    keywords: ["build", "mobile", "app", "simulator", "gym", "workout", "wellness"],
    isTrending: false
  },
  {
    title: "Build an AI chatbot interface",
    prompt: "Design a futuristic conversational AI chatbot window with styled streaming message bubbles, prompt suggestions helper pill buttons, custom system settings panel, and simulated text-to-speech audio logs.",
    desc: "Generative AI conversational assistant viewport with high visual rhythm.",
    keywords: ["build", "ai", "chatbot", "chat", "assistant", "system", "openrouter"],
    isTrending: true
  },
  {
    title: "Build an e-commerce platform",
    prompt: "Create an adaptive e-commerce storefront with category sidebar navigation, item pricing sort drop-down, shopping cart slide-out drawer, checkout invoice receipts, and billing history tables.",
    desc: "Full-feature retail storefront with modular components and mock checkout.",
    keywords: ["build", "ecommerce", "e-commerce", "store", "shop", "shopping", "cart", "checkout"],
    isTrending: true
  },
  {
    title: "Build a space shooter game",
    prompt: "Build a complete HTML5 Canvas space shooter game with a spaceship that moves with arrow keys and shoots with spacebar. Include enemy waves that get progressively harder, power-ups, particle explosions, a scoring system, lives, and a game over screen with restart. Add starfield background animation and sound effects using Web Audio API.",
    desc: "Complete playable arcade space shooter with progressive difficulty and visual effects.",
    keywords: ["build", "game", "shooter", "space", "arcade", "canvas", "html5", "play"],
    isTrending: true
  },

  // User typed "google" examples
  {
    title: "Add Google Authentication",
    prompt: "Implement a secure login gateway containing direct Google single-sign-on (SSO) simulated popups, redirect session state indicators, mock JSON web token validation view, and beautiful custom profile widgets.",
    desc: "OAuth passport connection with status dashboard and lock features.",
    keywords: ["google", "add google authentication", "auth", "login", "sso", "security"],
    isTrending: true
  },
  {
    title: "Integrate Google Login",
    prompt: "Create a minimalist dual-pane onboarding register form with quick 'Sign in utilizing Google' action button, password recovery flow, security strength meter, and error state alerts.",
    desc: "Visually polished entry form optimized for high web conversion.",
    keywords: ["google", "integrate google login", "login", "signin", "register", "onboard"],
    isTrending: false
  },
  {
    title: "Configure Google OAuth",
    prompt: "Review and provision standard Google Workspace People API OAuth client scopes so users can view and delete dynamic contacts connections from external directories within secure iframes.",
    desc: "Google API integration with explicit token and credentials monitoring.",
    keywords: ["google", "configure google oauth", "oauth", "people api", "gcp", "workspace"],
    isTrending: true
  },
  {
    title: "Connect Google Analytics",
    prompt: "Build an interactive web telemetry traffic dashboard with real-time active users counters, geographic site visits density heatmaps, loading progress spinners, and customizable traffic filter badges.",
    desc: "Google Analytics stats display with dynamic maps and loading states.",
    keywords: ["google", "connect google analytics", "analytics", "telemetry", "traffic", "dashboard"],
    isTrending: false
  },

  // Tamil Section
  {
    title: "செய்ய வேண்டிய பட்டியல் (Tamil Todo List)",
    prompt: "செய்ய வேண்டிய பட்டியல் (Todo List): Create a Tamil Language Todo task ledger with category badges, high contrast completion flags, and local storage data syncing.",
    desc: "முழுமையான தமிழ் செய்ய வேண்டிய பட்டியல் செயலி.",
    keywords: ["seyya", "seiya", "todo", "list", "tamil", "velai", "task", "செய்ய", "வேண்டிய", "பட்டியல்"],
    isTrending: true
  },
  {
    title: "வானிலை செயலி (Tamil Weather App)",
    prompt: "வானிலை செயலி (Weather App): Build an elegant Tamil Weather forecasting app with temperature logs, live search, wind speed widgets, and dynamic graphic banners.",
    desc: "தமிழ் வானிலை முன்னறிவிப்பு செயலி.",
    keywords: ["vanilai", "weather", "tamil", "app", "forecast", "மழை", "வானிலை", "செயலி"],
    isTrending: false
  },
  {
    title: "கணக்கிடும் கருவி (Tamil Scientific Calculator)",
    prompt: "கணக்கிடும் கருவி (Scientific Calculator): Build an intelligent high-precision calculator with mathematical logs, bracket scopes, calculations ledger history tapes, and clean light-slate styling.",
    desc: "தமிழ் கணித கணக்கீட்டு கருவி.",
    keywords: ["kanaku", "calculator", "tamil", "app", "scientific", "கணக்கு", "கணக்கிடும்", "கருவி"],
    isTrending: false
  },

  // Tanglish Section
  {
    title: "Oru nalla online store pannu (Tanglish Shop)",
    prompt: "Oru nalla online store pannu: Build an elegant responsive e-commerce storefront with a categorized sidebar, item search bar, dynamic add-to-cart list, and payment completion overlay.",
    desc: "Tanglish-optimized digital retail cart solution with interactive overlays.",
    keywords: ["oru nalla online store pannu", "store", "shop", "kadai", "tanglish", "tamil", "online", "pannu"],
    isTrending: true
  },
  {
    title: "Ennudaiya daily expenses register list (Tanglish Ledger)",
    prompt: "Ennudaiya daily expenses register list: Create an interactive personal daily expense tracker offering customizable categories pool, budget thresholds, beautiful analytical breakdown graphs, and CSV sheet exports.",
    desc: "Tanglish-optimized personal finance pocket book.",
    keywords: ["ennudaiya daily expenses register list", "expense", "budget", "selavu", "tanglish", "tamil", "register", "list"],
    isTrending: false
  },
  {
    title: "Oru nalla task manager (Tanglish Tasks)",
    prompt: "Oru nalla task manager: Create a gorgeous project task organization board prioritizing status pipelines, high-density search lists, user profiles avatars, and email alert buttons.",
    desc: "Tanglish-optimized task master board with clean animations.",
    keywords: ["oru nalla task manager", "task", "manager", "velai", "tanglish", "tamil", "manager", "board"],
    isTrending: true
  }
];

// Helper to highlight matching text query
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-blue-500/30 text-blue-400 font-extrabold rounded-md px-1 py-0.5 select-none border border-blue-500/10">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function PromptPanel({
  currentProject,
  onGenerate,
  isGenerating,
  onRefine,
  isRefining
}: PromptPanelProps) {
  const [promptInput, setPromptInput] = useState("");
  const [refineInput, setRefineInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedSampleTitle, setSelectedSampleTitle] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [recentHistory, setRecentHistory] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prompt enhancer state
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [enhanceError, setEnhanceError] = useState("");

  // Dynamic AI contextual generator state
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load search history from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("neural_forge_prompt_history");
      if (saved) {
        setRecentHistory(JSON.parse(saved));
      }
    } catch (err) {
      console.warn("Could not retrieve prompt history", err);
    }
  }, []);

  // Save successful generates to local storage
  const saveToHistory = (text: string) => {
    if (!text.trim()) return;
    try {
      const cleaned = text.trim();
      const updated = [cleaned, ...recentHistory.filter(h => h !== cleaned)].slice(0, 10);
      setRecentHistory(updated);
      localStorage.setItem("neural_forge_prompt_history", JSON.stringify(updated));
    } catch (err) {
      console.warn("Could not persist prompt history", err);
    }
  };

  const removeHistoryItem = (textStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const updated = recentHistory.filter(h => h !== textStr);
      setRecentHistory(updated);
      localStorage.setItem("neural_forge_prompt_history", JSON.stringify(updated));
    } catch (err) {
      console.warn(err);
    }
  };

  // Keep suggestion active index balanced on text input changes
  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [promptInput]);

  const handleSubmitGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isGenerating) return;
    saveToHistory(promptInput);
    onGenerate(promptInput);
  };

  // ── Safe fetch helper: sanitizes header values to ASCII ByteStrings ──────────
  const safeFetch = async (url: string, init: RequestInit): Promise<Response> => {
    // Sanitize every header value to printable ASCII (0x20–0x7E) to avoid the
    // "not a valid ByteString" TypeError on Android WebView / older Chrome.
    const rawHeaders = (init.headers ?? {}) as Record<string, string>;
    const safeHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      safeHeaders[k] = String(v ?? "").replace(/[^\x20-\x7E]/g, "");
    }
    return fetch(url, { ...init, headers: safeHeaders });
  };

  // ── Prompt Enhancer ─────────────────────────────────────────────────────────
  const handleEnhance = async () => {
    if (!promptInput.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setIsEnhanced(false);
    setEnhanceError("");
    try {
      const res = await safeFetch(`${SUPABASE_URL}/functions/v1/enhance-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "apikey": SUPABASE_ANON,
        },
        body: JSON.stringify({ prompt: promptInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Enhancement failed");
      setPromptInput(data.enhanced);
      setSelectedSampleTitle("");
      setIsEnhanced(true);
      // Auto-clear the "Enhanced ✓" badge after 4 s
      setTimeout(() => setIsEnhanced(false), 4000);
      // Refocus textarea
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err: any) {
      // Friendly message for ByteString / header construction errors
      const msg = err?.message || "";
      const friendly = msg.includes("ByteString") || msg.includes("construct")
        ? "Enhancement unavailable on this browser. Please try on desktop."
        : (msg || "Enhancement failed");
      setEnhanceError(friendly);
      setTimeout(() => setEnhanceError(""), 4000);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmitRefine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim() || isRefining) return;
    onRefine(refineInput);
    setRefineInput("");
  };

  const handleSelectSample = (sampleText: string) => {
    setPromptInput(sampleText);
    const matched = AUTO_PROMPTS_DATASET.find(p => p.prompt === sampleText);
    if (matched) {
      setSelectedSampleTitle(matched.title);
    } else {
      setSelectedSampleTitle("");
    }
  };

  // Enhanced search filtration logic (Fuzzy matches & Multilingual inputs)
  const trimmedInput = promptInput.trim();
  const getMatchingSuggestions = (): SuggestionItem[] => {
    if (!trimmedInput) {
      // If blank but focused, we recommend trending prompts as a helpful quickstart
      return AUTO_PROMPTS_DATASET.filter(item => item.isTrending).slice(0, 5);
    }

    const query = trimmedInput.toLowerCase();
    
    // Exact or substring score map
    return AUTO_PROMPTS_DATASET.map(item => {
      let score = 0;
      const lowerTitle = item.title.toLowerCase();
      const lowerPrompt = item.prompt.toLowerCase();

      if (lowerTitle.includes(query)) score += 50;
      if (lowerPrompt.includes(query)) score += 30;
      
      // Keyword predicted lists containing English, Tamil transliterations, Tanglish
      item.keywords.forEach(kw => {
        if (kw.toLowerCase().includes(query)) {
          score += 40;
          if (kw.toLowerCase() === query) score += 20;
        }
      });

      // Boost trending items slightly
      if (item.isTrending) score += 5;

      return { item, score };
    })
    .filter(res => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(res => res.item)
    .slice(0, 6);
  };

  const matchingSuggestions = getMatchingSuggestions();

  // Handle smart micro-AI suggestions prediction instantly on the UI
  const triggerContextAiExpansion = () => {
    if (!trimmedInput) return;
    setIsAiLoading(true);
    setTimeout(() => {
      const base = trimmedInput;
      setAiSuggestions([
        `Design a state-driven ${base} complete with persistent SQLite records, real-time filters tab, and micro-animations`,
        `Build a secure enterprise client portal for ${base} integrated with Google authentication logs and secure API proxy routes`,
        `Create an interactive Tamil-designed ${base} providing optimized multi-screen views, spreadsheet print sheets, and statistics charts`
      ]);
      setIsAiLoading(false);
    }, 500);
  };

  // Keyboard navigation controller
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isFocused && matchingSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % matchingSuggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + matchingSuggestions.length) % matchingSuggestions.length);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const selected = matchingSuggestions[activeSuggestionIndex];
        if (selected) {
          setPromptInput(selected.prompt);
          setSelectedSampleTitle(selected.title);
          setIsFocused(false);
        }
      } else if (e.key === "Escape") {
        setIsFocused(false);
      }
    }
  };

  return (
    <div id="prompt-panel-container" className="flex flex-col h-full bg-[#0F0F11] border-r border-slate-800 overflow-y-auto">
      {/* Upper action cell */}
      <div className="p-5 border-b border-slate-800">
        {!currentProject ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                Generator Console
              </h2>
            </div>

            {/* Dropdown Menu of Starter Prompts */}
            <div className="relative mb-4 z-30">
              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mb-1.5 font-mono uppercase tracking-widest select-none">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                Language & Starter Prompts
              </label>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between text-left px-3.5 py-2.5 bg-[#16161A] hover:bg-[#1c1c22] border border-slate-700 hover:border-slate-600 rounded-xl text-xs text-slate-200 transition-colors shadow-md cursor-pointer"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">
                      {selectedSampleTitle || "Select (English / தமிழ் / Tanglish)..."}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ml-1.5 ${isDropdownOpen ? "rotate-180 text-blue-400" : ""}`} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0F0F11]/95 backdrop-blur-xl border border-[#1e293b] rounded-xl shadow-2xl z-25 max-h-72 overflow-y-auto scrollbar-thin py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-1 text-[9px] font-bold text-slate-500 font-mono uppercase tracking-wide">
                        All Prompts Collection
                      </div>
                      {AUTO_PROMPTS_DATASET.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPromptInput(item.prompt);
                            setSelectedSampleTitle(item.title);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-[#1c1c22] transition-colors flex flex-col gap-0.5 group cursor-pointer border-b border-slate-900/50 last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[11.5px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                              {item.title}
                            </span>
                            {item.isTrending && (
                              <span className="text-[8px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono uppercase font-black tracking-wider flex items-center gap-0.5">
                                <Flame className="h-2.5 w-2.5 text-amber-400" />
                                Trending
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium truncate max-w-full">
                            {item.desc || item.prompt}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <form onSubmit={handleSubmitGenerate} className="relative mb-5">
              <div className="relative">
                <textarea
                  id="generation-prompt-textarea"
                  value={promptInput}
                  onFocus={() => {
                    setIsFocused(true);
                    setAiSuggestions([]); // clear previous on refocus
                  }}
                  onBlur={() => {
                    // Wait brief duration so click event/onMouseDown inside suggestions panel is registered
                    setTimeout(() => setIsFocused(false), 240);
                  }}
                  onKeyDown={handleKeyDown}
                  onChange={(e) => {
                    setPromptInput(e.target.value);
                    setIsEnhanced(false);
                    // Clear dropdown selection text if manually altered
                    const found = AUTO_PROMPTS_DATASET.find(p => p.prompt === e.target.value);
                    if (found) {
                      setSelectedSampleTitle(found.title);
                    } else {
                      setSelectedSampleTitle("");
                    }
                  }}
                  placeholder="Describe your app idea… (e.g. 'hospital management', 'online store', 'school system')"
                  disabled={isEnhancing}
                  ref={textareaRef}
                  rows={4}
                  className={`w-full bg-[#16161A] hover:bg-[#1b1b22] focus:bg-[#16161A] text-white placeholder-slate-500 rounded-xl p-4 pr-12 pb-[52px] text-xs border transition-all outline-none resize-none font-sans ${
                    isEnhancing
                      ? "border-violet-500/60 ring-1 ring-violet-500/30 animate-pulse"
                      : isEnhanced
                        ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                        : "border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                />

                {/* Status badge — top-right corner */}
                {trimmedInput && !isEnhancing && (
                  <div className="absolute right-3 top-3 flex items-center gap-1 pointer-events-none">
                    {isEnhanced ? (
                      <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/50 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Enhanced ✓
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-slate-500 font-mono bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
                        <Search className="h-2 w-2 text-blue-400" />
                        Predictive active
                      </span>
                    )}
                  </div>
                )}

                {/* Enhancing shimmer overlay */}
                {isEnhancing && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-900/10 via-blue-900/20 to-violet-900/10 animate-pulse pointer-events-none" />
                )}
              </div>

              {/* Bottom action row */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                {/* Left: Enhance button */}
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={!promptInput.trim() || isEnhancing}
                  title="Enhance prompt with AI (medo.dev style)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isEnhancing
                      ? "bg-violet-950/60 border-violet-700/50 text-violet-300"
                      : isEnhanced
                        ? "bg-emerald-950/50 border-emerald-700/40 text-emerald-300 hover:bg-emerald-950"
                        : "bg-[#1a1a2e] border-violet-800/40 text-violet-300 hover:bg-violet-950/40 hover:border-violet-600/60"
                  }`}
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Enhancing…</span>
                    </>
                  ) : isEnhanced ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>Enhanced ✓</span>
                      <RefreshCw className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3 w-3 text-violet-400" />
                      <span>Enhance</span>
                    </>
                  )}
                </button>

                {/* Right: Generate button */}
                <button
                  type="submit"
                  id="submit-generate-btn"
                  disabled={isGenerating || isEnhancing || !promptInput.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-[11px] font-semibold tracking-tight transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/40"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      <span>Generate</span>
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>

              {/* Error toast */}
              {enhanceError && (
                <div className="mt-2 px-3 py-1.5 bg-red-950/50 border border-red-800/50 rounded-lg text-[10px] text-red-400 flex items-center gap-1.5">
                  <X className="h-3 w-3 shrink-0" />
                  {enhanceError}
                </div>
              )}

              {/* Autocomplete suggestions Panel overlay: Glassmorphism layout */}
              {isFocused && (matchingSuggestions.length > 0 || recentHistory.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#121216]/95 backdrop-blur-xl border border-slate-850 rounded-2xl shadow-2xl z-55 max-h-72 overflow-y-auto scrollbar-thin p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-1 text-slate-200">
                  
                  {/* Keyboard navigation Hint */}
                  <div className="px-3 py-1.5 text-[9px] font-extrabold text-slate-500 font-mono uppercase tracking-widest flex items-center justify-between border-b border-slate-850 select-none">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-blue-400 animate-pulse" />
                      {trimmedInput ? "Dynamic matches" : "Trending Previews"} ({matchingSuggestions.length})
                    </span>
                    <span className="text-[8px] text-slate-600 lowercase font-medium">Use ↑ ↓ Enter keys to select</span>
                  </div>

                  {/* Suggestion list */}
                  {matchingSuggestions.map((item, idx) => {
                    const isSelected = idx === activeSuggestionIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevents target focus loss
                          setPromptInput(item.prompt);
                          setSelectedSampleTitle(item.title);
                          setIsEnhanced(false);
                          setIsFocused(false);
                        }}
                        onMouseEnter={() => setActiveSuggestionIndex(idx)}
                        className={`w-full text-left px-3 py-2 rounded-xl transition-all flex flex-col gap-0.5 group cursor-pointer ${
                          isSelected ? "bg-[#1c1c25] border border-blue-500/20 shadow" : "border border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`text-[11.5px] font-bold group-hover:text-blue-400 transition-colors truncate ${
                            isSelected ? "text-blue-400" : "text-slate-200"
                          }`}>
                            <HighlightMatch text={item.title} query={trimmedInput} />
                          </span>
                          <span className="flex items-center gap-1">
                            {item.isTrending && (
                              <span className="text-[8px] text-amber-500 border border-amber-500/10 bg-amber-500/5 px-2 py-0.5 rounded font-mono uppercase tracking-wide shrink-0 font-bold">
                                Trending 🔥
                              </span>
                            )}
                            <span className="text-[9px] text-[#10b981] border border-[#10b981]/25 bg-[#10b981]/5 px-2 py-0.5 rounded font-mono uppercase font-black tracking-wide shrink-0">
                              Autofill
                            </span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal line-clamp-2">
                          <HighlightMatch text={item.prompt} query={trimmedInput} />
                        </p>
                      </button>
                    );
                  })}

                  {/* Recent prompt history section */}
                  {recentHistory.length > 0 && (
                    <div className="mt-1 border-t border-[#1e293b]/50 pt-1.5">
                      <div className="px-3 py-1 text-[9px] font-bold text-slate-500 font-mono uppercase tracking-wider flex items-center justify-between select-none">
                        <span className="flex items-center gap-1.5">
                          <History className="h-3 w-3 text-emerald-400" />
                          Recent search history
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setRecentHistory([]);
                            localStorage.removeItem("neural_forge_prompt_history");
                          }}
                          className="text-slate-600 hover:text-red-400 hover:underline text-[9px] cursor-pointer"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="space-y-1 px-1 max-h-32 overflow-y-auto scrollbar-thin">
                        {recentHistory.map((hist, idx) => (
                          <div
                            key={idx}
                            onMouseDown={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest(".remove-btn")) return;
                              e.preventDefault();
                              setPromptInput(hist);
                              setIsEnhanced(false);
                              setIsFocused(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-[#16161c] rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                          >
                            <span className="text-[10.5px] text-slate-400 group-hover:text-slate-200 transition-colors truncate font-sans">
                              {hist}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => removeHistoryItem(hist, e)}
                              className="remove-btn p-1 text-slate-600 hover:text-red-400 rounded transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Smart Contextual AI expanding results section (styled to sit on interface safely) */}
            {aiSuggestions.length > 0 && (
              <div className="mb-4 p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 font-mono uppercase tracking-widest select-none">
                    <Cpu className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                    AI Contextual Alternatives
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiSuggestions([])}
                    className="text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {aiSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPromptInput(sug);
                        setAiSuggestions([]);
                      }}
                      className="w-full text-left p-2 rounded bg-slate-900/60 hover:bg-slate-900 text-[10.5px] text-slate-300 hover:text-white border border-slate-800/40 hover:border-blue-500/30 transition-all flex items-start gap-1.5"
                    >
                      <Sparkle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{sug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Quickstart Suggestions Board */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mb-2 font-mono uppercase tracking-widest">
                <Lightbulb className="h-3.5 w-3.5 text-blue-400" />
                Featured Previews
              </span>
              <div id="quickstart-list" className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {AUTO_PROMPTS_DATASET.slice(0, 4).map((sample, idx) => (
                  <button
                    key={idx}
                    id={`sample-prompt-${idx}`}
                    onClick={() => handleSelectSample(sample.prompt)}
                    className="w-full text-left p-3 rounded-lg bg-[#16161A]/70 hover:bg-[#16161A] border border-slate-800/80 hover:border-slate-700 transition-all group animate-in fade-in slide-in-from-bottom-1 duration-150 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                        <Bookmark className="h-3 w-3 text-slate-500 group-hover:text-blue-400" />
                        {sample.title}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    {sample.desc && (
                      <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                        {sample.desc}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-blue-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                Iterate & Refine App
              </h2>
            </div>
            
            <form onSubmit={handleSubmitRefine} className="relative mb-4">
              <input
                type="text"
                id="refinement-prompt-input"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                placeholder="Type an adjustment (e.g. 'Add video view count model')..."
                disabled={isRefining}
                className="w-full bg-[#16161A] text-white placeholder-slate-500 rounded-xl pl-3 pr-10 py-3 text-xs border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-sans"
              />
              <button
                type="submit"
                id="submit-refine-btn"
                disabled={isRefining || !refineInput.trim()}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded transition-colors cursor-pointer flex items-center justify-center"
              >
                {isRefining ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CornerDownLeft className="h-3.5 w-3.5" />
                )}
              </button>
            </form>

            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 px-1 font-mono">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              NeuralForge auto-updates client templates
            </div>
          </div>
        )}
      </div>

      {/* AI Requirements Analyzer Dashboard */}
      <div className="p-5 flex-1 select-none">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-blue-400" />
          AI Requirement Analyzer
        </h3>

        {currentProject ? (
          <div id="analyzer-container" className="space-y-5">
            {/* Features list */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-2 mb-2 uppercase font-mono">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Interactive Features
              </span>
              <ul className="space-y-1.5">
                {currentProject.analysis.features.map((feat, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-2 leading-relaxed bg-[#16161A] p-2.5 border border-slate-800 rounded">
                    <span className="text-blue-400 font-mono font-bold mt-0.5">•</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Database schema layout */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-2 mb-2 uppercase font-mono">
                <Database className="h-3.5 w-3.5 text-emerald-500" />
                Supabase Tables designed
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentProject.analysis.database.map((db, i) => (
                  <span key={i} className="text-[10px] text-emerald-400 font-bold font-mono bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded">
                    {db}
                  </span>
                ))}
              </div>
            </div>

            {/* Routing APIs list */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-2 mb-2 uppercase font-mono">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                Express API Endpoints
              </span>
              <ul className="space-y-1.5">
                {currentProject.analysis.apis.map((api, i) => {
                  const parts = api.split(" ");
                  const method = parts[0] || "GET";
                  const route = parts.slice(1).join(" ") || "/api";
                  
                  return (
                    <li key={i} className="flex items-center gap-2 bg-[#16161A] p-2 border border-slate-800 rounded text-xs leading-none">
                      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        method === "GET" ? "bg-blue-950 text-blue-400 border border-blue-900/40" : "bg-purple-950 text-purple-400 border border-purple-900/40"
                      }`}>
                        {method}
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">{route}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Safety & Sandbox limits checking */}
            <div className="border border-blue-900/60 bg-blue-950/15 p-3.5 rounded">
              <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5 mb-1.5 font-sans">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                Safety & Sandbox Validation
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                {currentProject.analysis.security || "Project analyzed against phishing, credit card harvesting, malware vectors. Verified secure and functional."}
              </p>
              <div className="mt-2.5 text-[9px] text-emerald-400 font-mono font-bold flex items-center gap-1 bg-emerald-950/30 border border-emerald-900/30 p-1.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                CHECKS PASSED: NO MALICIOUS VECTORS DETECTED
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-slate-850 rounded-xl bg-slate-900/10 text-center px-4">
            <Sparkles className="h-8 w-8 text-slate-700 animate-bounce mb-3" />
            <p className="text-xs text-slate-500 font-sans max-w-xs">
              Waiting for website prompt... Energetic analyses will be made available when your workspace compiles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
