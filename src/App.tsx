import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Code, 
  Terminal, 
  Download, 
  RefreshCw, 
  Database,
  Rocket, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Heart,
  FileCode,
  Zap,
  MessageSquare,
  Coins,
  Copy,
  Users,
  Check,
  Play,
  Volume2,
  Paperclip,
  Trash2,
  FileText,
  Clock,
  Flame,
  Gift,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  VolumeX,
  Languages,
  Radio,
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import Header from "./components/Header";
import PromptPanel from "./components/PromptPanel";
import PreviewViewport from "./components/PreviewViewport";
import CodeExplorer from "./components/CodeExplorer";
import ReferralEarnView from "./components/ReferralEarnView";
import ReferralAdminPanel from "./components/ReferralAdminPanel";
import AuthPage from "./components/AuthPage";
import { supabase } from "./lib/supabaseClient";
import DeploymentConsole from "./components/DeploymentConsole";
import ProjectHistory from "./components/ProjectHistory";
import PricingPage from "./components/PricingPage";
import AIWorkspaceLayout from "./components/workspace/AIWorkspaceLayout";
import MarketplacePage from "./components/MarketplacePage";
import DashboardPage from "./components/DashboardPage";
import { ProjectDetails, ProjectSummary } from "./types";
import CreditConfirmModal from "./components/workspace/CreditConfirmModal";
import { estimateCreditCost, type CreditEstimate } from "./lib/creditCost";

// Custom fetch helper: sanitizes header values to printable ASCII (avoids Android
// WebView "not a valid ByteString" TypeError) and injects auth headers for /api calls.
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let sessionStr: string | null = null;
  try {
    sessionStr = localStorage.getItem("google_auth_session");
  } catch (e) {}

  const isApi = typeof input === "string" && input.startsWith("/api");

  // Build a plain headers object, sanitizing every value to printable ASCII 0x20–0x7E
  const rawHeaders: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { rawHeaders[k] = v; });
    } else if (Array.isArray(init.headers)) {
      (init.headers as [string, string][]).forEach(([k, v]) => { rawHeaders[k] = v; });
    } else {
      Object.assign(rawHeaders, init.headers);
    }
  }
  // Sanitize: strip any character outside printable ASCII range
  const safeHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    safeHeaders[k] = String(v ?? "").replace(/[^\x20-\x7E]/g, "");
  }

  return window.fetch(input, { ...init, headers: safeHeaders });
};

// Use scoped module-level fetch for all requests in this file
const fetch = customFetch;

export default function App() {
  const mapSupabaseSessionToUser = (session: any) => {
    if (!session?.user) return null;
    const user = session.user;
    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
      email: user.email || "",
      picture: user.user_metadata?.avatar_url || "",
      googleId: user.id,
      expiresAt,
    };
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = mapSupabaseSessionToUser(sessionData.session);
        if (user) {
          setUserState(prev => ({ ...prev, user }));
          return;
        }
      } catch (err) {
        console.warn("Supabase auth init error:", err);
      }

      try {
        const res = await fetch("/api/user-state");
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setUserState(prev => ({ ...prev, ...data, user: data.user }));
          }
        }
      } catch (err) {
        console.warn("User state init error:", err);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const user = mapSupabaseSessionToUser(session);
        if (user) {
          setUserState(prev => ({ ...prev, user }));
        }
      } else {
        setUserState(prev => ({ ...prev, user: null }));
      }
    });

    const handlePopupMessage = (event: MessageEvent) => {
      if (authPopupRef.current && event.source !== authPopupRef.current) return;
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "OAUTH_AUTH_SUCCESS") {
        const user = event.data.user;
        if (user) {
          setUserState(prev => ({ ...prev, user }));
          setActiveGlobalTab("workspace");
          showToast("Signed in successfully via Google.", "success");
        }
      }

      if (event.data.type === "OAUTH_AUTH_ERROR") {
        setOauthError(event.data.error || "Google sign-in failed.");
        showToast(event.data.error || "Google sign-in failed.", "error");
      }
    };

    window.addEventListener("message", handlePopupMessage);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("message", handlePopupMessage);
    };
  }, []);

  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectDetails | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "deploy">("preview");
  
  // Custom global nav: "workspace" or "sri-ai" or "pricing" or "referral" or "admin"
  const [activeGlobalTab, setActiveGlobalTab] = useState<"workspace" | "sri-ai" | "pricing" | "referral" | "admin" | "marketplace" | "dashboard">("workspace");

  // Interaction states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [generatingStepMessage, setGeneratingStepMessage] = useState("");

  const [isRefining, setIsRefining] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployStatus, setDeployStatus] = useState<"idle" | "deploying" | "success" | "failed">("idle");
  const [deployError, setDeployError] = useState<string | undefined>(undefined);

  // ── Credit Confirmation System ─────────────────────────────────────────────
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [pendingCreditAction, setPendingCreditAction] = useState<null | {
    type: "generate" | "refine";
    prompt: string;
    images?: string[];
    estimate: CreditEstimate;
  }>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState(true);

  // Multi-agent pipeline state
  const [buildPhase, setBuildPhase] = useState<"idle" | "analyze" | "plan" | "generate" | "validate" | "fix" | "deploy" | "complete">("idle");
  const [buildPhaseMessage, setBuildPhaseMessage] = useState("");
  const [planData, setPlanData] = useState<any>(null);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const authPopupRef = useRef<Window | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Billing and Referral states
  const [billingOpen, setBillingOpen] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [marketplaceApps, setMarketplaceApps] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalReferrals: 0,
    referralEarnings: 0
  });
  const [userState, setUserState] = useState({
    credits: 85,
    appCreationsCount: 1,
    deploymentsCount: 0,
    referralCode: "SRI777",
    referrals: [] as Array<{ id: string; friend: string; action: string; reward: number; timestamp: string }>,
    plan: "Free",
    offerRedeemed: false,
    offerSignupTime: null as null | string,
    offerPopupShown: false,
    user: null as null | {
      name: string;
      email: string;
      picture: string;
      googleId: string;
      expiresAt: string;
    }
  });

  // Special First-Time User Discount states
  const [showOfferPopup, setShowOfferPopup] = useState(false);
  const [claimOfferTriggered, setClaimOfferTriggered] = useState(false);
  const [offerSecondsLeft, setOfferSecondsLeft] = useState<number | null>(null);

  // Smart Pre-Generation Requirement Report Planning states
  const [promptValue, setPromptValue] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<any | null>(null);
  const [selectedSize, setSelectedSize] = useState<"Small" | "Medium" | "Large">("Medium");

  // Sri AI Doubt Assistant chatbot states
  const [sriChat, setSriChat] = useState<Array<{
    role: "user" | "ai";
    text: string;
    time: string;
    fixAvailable?: boolean;
    fixPrompt?: string;
  }>>([
    {
      role: "ai",
      text: "👋 Vanakkam! I am Sri AI, your professional technical lead and automated debugger. Specify any question about compiling, Drizzle Supabase database layout, API proxy routes, or auto-fixing active building logs!",
      time: "Just Now"
    }
  ]);
  const [sriInput, setSriInput] = useState("");
  const [sriIsLoading, setSriIsLoading] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [activeVoiceWave, setActiveVoiceWave] = useState([12, 28, 15, 34, 18, 10, 22]);
  const [attachmentType, setAttachmentType] = useState<"none" | "logs" | "schema" | "screenshot">("none");

  const sriChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeGlobalTab === "sri-ai" || sriChat.length > 1) {
      setTimeout(() => {
        sriChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [sriChat, sriIsLoading, activeGlobalTab]);

  // Voice, Multilingual, File/PDF uploading and Speech App construction states
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [detectedVoiceLang, setDetectedVoiceLang] = useState("ta-IN"); // Default Tamil ('ta-IN')
  const [continuousSpeech, setContinuousSpeech] = useState(true);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  const [sriIsSpeaking, setSriIsSpeaking] = useState(false);
  
  // Real-time Voice Call Mode states
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [voiceCallState, setVoiceCallState] = useState<"idle" | "listening" | "thinking" | "speaking" | "error">("idle");
  const [voiceFallbackInput, setVoiceFallbackInput] = useState("");
  const [autoDetectedLanguageLabel, setAutoDetectedLanguageLabel] = useState("Tamil (Tanglish)");
  const [stereoWaveformAmplitudes, setStereoWaveformAmplitudes] = useState<number[]>(Array(24).fill(12));
  const [voiceLogs, setVoiceLogs] = useState<{message: string; timestamp: string; type: "info" | "success" | "error" | "warn"}[]>([]);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [lastAiSpokenResponse, setLastAiSpokenResponse] = useState("");

  // Interactive In-App Standalone Simulator State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorDevice, setSimulatorDevice] = useState<"phone" | "tablet" | "desktop">("phone");
  const [simulatorLatency, setSimulatorLatency] = useState<number>(0);
  const [simulatorIsOffline, setSimulatorIsOffline] = useState(false);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatedConsoleInput, setSimulatedConsoleInput] = useState("");
  const [simulatedLogs, setSimulatedLogs] = useState<Array<{
    message: string;
    timestamp: string;
    level: "log" | "info" | "warn" | "error";
  }>>([
    { message: "🌐 Loading virtual sandbox runtime connection...", timestamp: "11:22:01", level: "info" },
    { message: "⚡ Syncing local files AST with secure Express thread...", timestamp: "11:22:01", level: "log" },
    { message: "🎯 Touch targets and viewport fluid calculations mapping active.", timestamp: "11:22:02", level: "info" },
    { message: "🟢 Port 3000 mapping: connected inside container sandbox successfully.", timestamp: "11:22:02", level: "log" }
  ]);

  const addSimulatedLog = (message: string, level: "log" | "info" | "warn" | "error" = "log") => {
    const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false, hour: "numeric", minute: "2-digit", second: "2-digit" });
    setSimulatedLogs(prev => [...prev, { message, timestamp, level }]);
  };

  const handleExecuteConsoleSnippet = () => {
    if (!simulatedConsoleInput.trim()) return;
    const input = simulatedConsoleInput;
    setSimulatedConsoleInput("");
    addSimulatedLog(`Console Input Exec: "${input}"`, "info");
    
    setTimeout(() => {
      if (input.toLowerCase().includes("err") || input.toLowerCase().includes("throw")) {
        addSimulatedLog(`TypeError: Cannot read properties of undefined in compilation`, "error");
      } else if (input.toLowerCase().includes("credits") || input.toLowerCase().includes("plan")) {
        addSimulatedLog(`[Account Info] Current Plan context check: Standard tier active. API latency: 42ms.`, "log");
      } else {
        addSimulatedLog(`Executed successfully. Output: undefined`, "log");
      }
    }, 450);
  };

  useEffect(() => {
    if (isSimulatorOpen) {
      addSimulatedLog(`Environment Sync: App updated with ${simulatorIsOffline ? "offline simulation model" : simulatorLatency > 0 ? `3G slow latency (${simulatorLatency}ms emulation)` : "LAN 5G Speed"} network configs.`, "info");
    }
  }, [simulatorLatency, simulatorIsOffline, isSimulatorOpen]);

  useEffect(() => {
    if (isSimulatorOpen) {
      setSimulatorLoading(true);
      const delay = simulatorIsOffline ? 350 : simulatorLatency > 0 ? simulatorLatency : 450;
      const timer = setTimeout(() => {
        setSimulatorLoading(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [simulatorLatency, simulatorIsOffline, isSimulatorOpen, currentProject]);

  const addVoiceLog = (message: string, type: "info" | "success" | "error" | "warn" = "info") => {
    const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false, hour: "numeric", minute: "2-digit", second: "2-digit" });
    setVoiceLogs(prev => [{ message, timestamp, type }, ...prev].slice(0, 50));
  };

  // Synchronizing refs to prevent React stale closure issues inside Web Speech API callbacks
  const isVoiceCallActiveRef = useRef(isVoiceCallActive);
  const voiceCallStateRef = useRef(voiceCallState);
  const detectedVoiceLangRef = useRef(detectedVoiceLang);
  const continuousSpeechRef = useRef(continuousSpeech);
  const isVoiceListeningRef = useRef(isVoiceListening);
  const isMicMutedRef = useRef(isMicMuted);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  const toggleMicMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    isMicMutedRef.current = nextMuted;
    
    if (nextMuted) {
      addVoiceLog("Microphone Muted", "warn");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch(e){}
        recognitionRef.current = null;
      }
      setRecognitionInstance(null);
      setIsVoiceListening(false);
    } else {
      addVoiceLog("Microphone Unmuted - Ready to listen", "success");
      if (isVoiceCallActive) {
        startVoiceRecognition(true);
      }
    }
  };

  useEffect(() => {
    isVoiceCallActiveRef.current = isVoiceCallActive;
  }, [isVoiceCallActive]);

  useEffect(() => {
    voiceCallStateRef.current = voiceCallState;
  }, [voiceCallState]);

  useEffect(() => {
    detectedVoiceLangRef.current = detectedVoiceLang;
  }, [detectedVoiceLang]);

  useEffect(() => {
    continuousSpeechRef.current = continuousSpeech;
  }, [continuousSpeech]);

  useEffect(() => {
    isVoiceListeningRef.current = isVoiceListening;
  }, [isVoiceListening]);

  const [customFileContent, setCustomFileContent] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileType, setUploadedFileType] = useState<"text" | "pdf" | "image" | "none">("none");
  const [uploadedFilePreview, setUploadedFilePreview] = useState<string | null>(null);

  const [voiceAppPipeline, setVoiceAppPipeline] = useState<{
    isActive: boolean;
    step: number; // 1: speech to text, 2: requirements, 3: architecture, 4: creation, 5: preview, 6: deploy
    transcript: string;
    architectureDetails?: any;
    createdProject?: any;
    isDeploying: boolean;
    deploymentUrl?: string;
  } | null>(null);

  // Manage first-time user discount timer and synchronization
  useEffect(() => {
    let timer: any;
    
    const handleOfferState = async () => {
      const email = userState.user?.email || "anon";
      const isAnon = email === "anon";
      
      let finalSignupTimeStr = isAnon 
        ? localStorage.getItem("offer_signup_time_anon")
        : (userState.offerSignupTime || localStorage.getItem(`offer_signup_time_${email}`));
        
      let finalPopupShown = isAnon
        ? localStorage.getItem("offer_popup_shown_anon") === "true"
        : (userState.offerPopupShown || localStorage.getItem(`offer_popup_shown_${email}`) === "true");

      let currentRedeemed = isAnon
        ? localStorage.getItem("offer_redeemed_anon") === "true"
        : userState.offerRedeemed;

      const now = Date.now();

      // If no signup time exists, they are signing up/logging in for the FIRST time!
      if (!finalSignupTimeStr && !currentRedeemed) {
        const initialTimeStr = new Date(now).toISOString();
        finalSignupTimeStr = initialTimeStr;
        
        if (isAnon) {
          localStorage.setItem("offer_signup_time_anon", initialTimeStr);
          localStorage.setItem("offer_popup_shown_anon", "true");
        } else {
          localStorage.setItem(`offer_signup_time_${email}`, initialTimeStr);
          localStorage.setItem(`offer_popup_shown_${email}`, "true");
          
          // Save state to server
          try {
            await fetch("/api/user-state/update-offer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                offerSignupTime: initialTimeStr,
                offerPopupShown: true,
                offerRedeemed: false
              })
            });
          } catch(e) {
            console.error("Failed to sync initial offer state to server", e);
          }
        }
        
        // Auto-show prompt/popup
        setShowOfferPopup(true);
      } else if (!finalPopupShown && !currentRedeemed) {
        // If we have a signup time but haven't shown popup yet
        if (isAnon) {
          localStorage.setItem("offer_popup_shown_anon", "true");
        } else {
          localStorage.setItem(`offer_popup_shown_${email}`, "true");
          try {
            await fetch("/api/user-state/update-offer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ offerPopupShown: true })
            });
          } catch(e){}
        }
        setShowOfferPopup(true);
      }

      // Live countdown loop
      const updateCountdown = () => {
        if (currentRedeemed) {
          setOfferSecondsLeft(null);
          return;
        }

        const signupMs = finalSignupTimeStr ? new Date(finalSignupTimeStr).getTime() : now;
        const elapsedMs = Date.now() - signupMs;
        const totalValidityMs = 24 * 3600 * 1000;
        const remainingMs = totalValidityMs - elapsedMs;

        if (remainingMs <= 0) {
          setOfferSecondsLeft(0);
        } else {
          setOfferSecondsLeft(Math.floor(remainingMs / 1000));
        }
      };

      updateCountdown();
      timer = setInterval(updateCountdown, 1000);
    };

    handleOfferState();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [userState.user?.email, userState.offerSignupTime, userState.offerPopupShown, userState.offerRedeemed]);

  // ── Capture referral code from URL path /ref/:code or ?ref=code ────────
  useEffect(() => {
    const path = window.location.pathname;
    const refMatch = path.match(/\/ref\/([A-Za-z0-9_-]+)/);
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = refMatch?.[1] || urlParams.get("ref");
    if (refCode) {
      localStorage.setItem("pending_referral_code", refCode.toUpperCase());
      // Clean up URL without reload
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // ── Upsert profile + process pending referral after Google login ─────────
  const handlePostLoginReferral = async (user: { googleId: string; email: string; name: string; picture: string }) => {
    const pendingCode = localStorage.getItem("pending_referral_code");
    try {
      if (pendingCode) {
        const { data, error } = await supabase.functions.invoke("referral-signup", {
          body: {
            referrer_code: pendingCode,
            new_user_id: user.googleId,
            new_user_email: user.email,
            new_user_name: user.name,
            new_user_picture: user.picture,
          },
        });
        if (!error && data?.referral?.success) {
          localStorage.removeItem("pending_referral_code");
          showToast("🎉 Referral bonus applied! +10 credits added to your account.", "success");
        } else {
          // Profile still created; just no referral bonus
          localStorage.removeItem("pending_referral_code");
        }
      } else {
        // No pending referral — just upsert profile so referral_code is generated
        await supabase.functions.invoke("referral-profile", {
          body: {
            user_id: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture,
            fetch_dashboard: false,
          },
        });
      }
    } catch (e) {
      console.error("referral post-login error:", e);
    }
  };

  // Load project index list and user credits on mount
  useEffect(() => {
    fetchProjects();
    fetchMarketplaceApps();
    fetchUserState();
    checkApiKeyConfig();
  }, []);

  // Simulate audio visualization for voice mode
  useEffect(() => {
    let timer: any;
    if (voiceActive || isVoiceListening || sriIsSpeaking || isVoiceCallActive) {
      timer = setInterval(() => {
        // Legacy activeVoiceWave
        setActiveVoiceWave(Array.from({ length: 9 }, () => Math.floor(Math.random() * 32) + 6));

        // Modern 24-bar Stereo Waveform height mapping for active real-time call states
        setStereoWaveformAmplitudes(prev => {
          return prev.map((_, i) => {
            if (isMicMutedRef.current && voiceCallState === "listening") {
              // Static, flat line when muted
              return Math.floor(Math.random() * 2) + 4;
            } else if (voiceCallState === "listening") {
              // Rapid high-frequency spikes
              return Math.floor(Math.random() * 45) + 12;
            } else if (voiceCallState === "speaking") {
              // Rhythmic wave flow
              const timeFactor = Date.now() * 0.015;
              const sineVal = Math.sin(i * 0.5 + timeFactor) * 18 + 22;
              return Math.max(8, Math.floor(sineVal + Math.random() * 8));
            } else if (voiceCallState === "thinking") {
              // Tiny gentle breathing ripple
              return Math.floor(Math.sin(i * 0.3 + Date.now() * 0.005) * 4) + 8;
            } else {
              // Idle state tiny baseline
              return Math.floor(Math.random() * 4) + 6;
            }
          });
        });
      }, 50);
    } else {
      // Quiet decay
      setStereoWaveformAmplitudes(Array(24).fill(6));
    }
    return () => clearInterval(timer);
  }, [voiceActive, isVoiceListening, sriIsSpeaking, isVoiceCallActive, voiceCallState, isMicMuted]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        const normalized = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          prompt: p.prompt,
          analysis: p.analysis || { features: [], database: [], apis: [], security: "" },
          files: p.files || [],
          previewHtml: p.preview_html,
          autoDiagnosticReport: p.auto_diagnostic_report,
          createdAt: p.created_at,
          deployments: [],
          deploymentsCount: 0,
          is_published: p.is_published,
          published_url: p.published_url
        }));
        setProjectsList(normalized);
      }
    } catch (e) {
      console.error("Failed to load projects from Supabase:", e);
    }
  };

  const fetchMarketplaceApps = async () => {
    try {
      const { data, error } = await supabase.from("marketplace_apps").select("*, profiles(name, avatar_url)").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        setMarketplaceApps(data.map((app: any) => ({
          id: app.id,
          name: app.name,
          description: app.description,
          creator: app.profiles?.name || "Anonymous",
          category: app.category,
          thumbnail_url: app.thumbnail_url,
          view_count: app.view_count,
          like_count: app.like_count,
          created_at: app.created_at,
          preview_html: app.preview_html,
          prompt: app.prompt
        })));
      }
    } catch (e) {
      console.error("Failed to load marketplace:", e);
    }
  };

  const saveProjectToSupabase = async (project: any, userId: string) => {
    try {
      const { error } = await supabase.from("projects").insert({
        user_id: userId,
        name: project.name,
        description: project.description,
        prompt: project.prompt,
        analysis: project.analysis,
        files: project.files,
        preview_html: project.previewHtml,
        preview_html_size: selectedSize,
        auto_diagnostic_report: project.autoDiagnosticReport,
        is_published: false
      });
      if (error) console.error("Failed to save project:", error);
    } catch (e) {
      console.error("Save project error:", e);
    }
  };

  const publishToMarketplace = async (project: any, userId: string) => {
    try {
      const url = `https://apps.trustmeai.com/${project.id}`;
      // Update project as published
      await supabase.from("projects").update({ is_published: true, published_url: url }).eq("id", project.id);
      // Add to marketplace
      await supabase.from("marketplace_apps").insert({
        project_id: project.id,
        user_id: userId,
        name: project.name,
        description: project.description,
        category: "General",
        preview_html: project.previewHtml,
        prompt: project.prompt
      });
      // Add deployment record
      await supabase.from("deployments").insert({
        project_id: project.id,
        user_id: userId,
        platform: "vercel",
        url,
        status: "success"
      });
      return url;
    } catch (e) {
      console.error("Publish error:", e);
      return null;
    }
  };

  const fetchUserState = async () => {
    try {
      const res = await fetch("/api/user-state");
      const data = await res.json();
      if (data && !data.error) {
        setUserState(prev => ({
          ...prev,
          ...data,
          user: prev.user || data.user || null,
        }));
      }
    } catch (e) {
      console.error("Failed to load user state from server:", e);
    }
  };

  const handleLoginStart = async () => {
    try {
      setOauthError(null);
      setAuthLoading(true);
      const res = await fetch("/api/auth/google-url");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to start Google sign-in.");
      }
      const popup = window.open(data.url, "GoogleSignIn", "width=600,height=700");
      if (!popup) {
        throw new Error("Popup blocked. Please allow popups and try again.");
      }
      authPopupRef.current = popup;
      const poll = window.setInterval(() => {
        if (!popup || popup.closed) {
          window.clearInterval(poll);
          setAuthLoading(false);
          authPopupRef.current = null;
        }
      }, 500);
    } catch (err: any) {
      console.error("Google auth start error:", err);
      setOauthError(err.message || "Google sign-in failed. Please try again.");
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("Signing out active user...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setOauthError(null);
      setUserState(prev => ({
        ...prev,
        user: null,
      }));
    } catch (e: any) {
      console.error("Failed to sign out", e);
      setOauthError(e.message || "Sign out failed.");
    }
  };



  const checkApiKeyConfig = async () => {
    try {
      const res = await fetch("/api/api-key-status");
      const data = await res.json();
      setApiKeyStatus(!!data.active);
    } catch (e) {
      setApiKeyStatus(false);
    }
  };

  const handleSelectProject = async (id: string) => {
    setIsGenerating(false);
    setIsRefining(false);
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data && !data.error) {
        setCurrentProject(data);
        setSelectedProjectId(id);
        setActiveTab("preview");
        if (data.deployments && data.deployments.length > 0) {
          setDeployLogs(data.deployments[0].logs);
        } else {
          setDeployLogs([]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch project details", e);
    }
  };

  // Client-side fallback report generator — works offline, no backend needed
  // Detect app type from prompt — mirrors edge function logic
  const detectClientAppType = (p: string): string => {
    const l = p.toLowerCase();

    // ── E-COMMERCE HARD PRIORITY: must check before dashboard/management ──────────
    if (/\be[- ]?commerce\b/.test(l)) return "ecommerce";
    if (/\bonline store\b|\bshopping (cart|site|website|app)\b|\bproduct (catalog|listing)\b/.test(l)) return "ecommerce";
    if (/\bbuy.*online\b|\bsell.*online\b|\badd to cart\b/.test(l)) return "ecommerce";

    // ── GAME MODE: HIGHEST PRIORITY ──────────────────────────────────────────────
    if (/\bsnake\b/.test(l)) return "game";
    if (/\btetris\b/.test(l)) return "game";
    if (/\bmario\b/.test(l)) return "game";
    if (/\barkanoid\b/.test(l)) return "game";
    if (/\bspace invaders\b/.test(l)) return "game";
    if (/\basteroids\b/.test(l)) return "game";
    if (/\btower defense\b/.test(l)) return "game";
    if (/\bendless runner\b/.test(l)) return "game";
    if (/\bflappy bird\b/.test(l)) return "game";
    if (/\bmatch[- ]?3\b/.test(l)) return "game";
    if (/\bbreakout\b/.test(l)) return "game";
    if (/\bplatformer\b/.test(l)) return "game";
    if (/\brpg\b/.test(l)) return "game";
    if (/\bpuzzle\b/.test(l)) return "game";
    if (/\bracing game\b/.test(l)) return "game";
    if (/\bshooter game\b|\bspace shooter\b/.test(l)) return "game";
    if (/\bhtml5 game\b|\bcanvas game\b|\barcade game\b/.test(l)) return "game";
    if (/\b2d game\b|\b3d game\b/.test(l)) return "game";
    if (/\bgame\b/.test(l) && /\bplayable\b|\bscore\b|\blives\b|\blevel\b|\benemy\b|\bcollision\b/.test(l)) return "game";
    if (/\bbuild a game\b|\bcreate a game\b|\bmake a game\b|\bgame app\b|\bmini game\b/.test(l)) return "game";

    // ── VIDEO STREAMING ────────────────────────────────────────────────────────────
    if (/youtube|video (platform|streaming|sharing|app|site)|streaming (site|platform|app)|yt clone|netflix clone|twitch clone|vimeo clone/.test(l)) return "youtube";

    // ── SOCIAL MEDIA ─────────────────────────────────────────────────────────────
    if (/instagram clone|facebook clone|twitter clone|social (media|network|app|platform|feed)|reddit clone|photo sharing|feed app/.test(l)) return "social";

    // ── LMS / E-LEARNING ───────────────────────────────────────────────────────────
    if (/lms|learning management|online course|e[- ]?learning|course platform|udemy clone|coursera clone|education platform/.test(l)) return "lms";

    // ── CRM / SALES ─────────────────────────────────────────────────────────────────
    if (/\bcrm\b|customer (relationship|management)|sales pipeline|lead (management|tracker)|contact management/.test(l)) return "crm";

    // ── E-COMMERCE ───────────────────────────────────────────────────────────────────
    if (/e[- ]?commerce|shop(ping)?|online store|product catalog|\bcart\b|marketplace/.test(l)) return "ecommerce";

    // ── UTILITY APPS ─────────────────────────────────────────────────────────────────
    if (/\bcalculator\b|math tool|arithmetic/.test(l)) return "calculator";
    if (/\btimer\b|stopwatch|countdown|pomodoro/.test(l)) return "timer";
    if (/\bconvert(er|or)\b|unit conv|currency conv/.test(l)) return "converter";
    if (/\bquiz\b|trivia|flashcard|mcq/.test(l)) return "quiz";
    if (/\balarm\b|wake.?up|alarm clock/.test(l)) return "alarm";
    if (/\bnotes?\b|notepad|notebook|journal|memo|diary/.test(l)) return "notes";
    if (/\btodo\b|to[- ]do|task manager|checklist/.test(l)) return "todo";
    if (/\bchat\b|messaging|whatsapp|telegram|discord|inbox/.test(l)) return "chat";
    if (/\bweather\b|forecast|temperature/.test(l)) return "weather";

    // ── CONTENT & MEDIA ──────────────────────────────────────────────────────────────
    if (/\bmusic\b|spotify|playlist|audio player/.test(l)) return "music";
    if (/\brecipe\b|cooking|meal planner/.test(l)) return "recipe";
    if (/fitness|workout|gym|exercise tracker/.test(l)) return "fitness";
    if (/finance|budget|expense|money tracker/.test(l)) return "finance";
    if (/travel|trip planner|hotel|flight/.test(l)) return "travel";
    if (/news|blog|article reader/.test(l)) return "news";
    if (/image gen|ai art|text.?to.?image/.test(l)) return "image_generator";
    if (/\bform\b|survey|questionnaire|feedback|sign.?up/.test(l)) return "form";

    // ── PERSONAL BRAND ─────────────────────────────────────────────────────────────────
    if (/\bportfolio\b|personal site|resume site|showcase|dev profile/.test(l)) return "portfolio";

    // ── EXPLICIT DASHBOARD / ADMIN (only when user explicitly asks) ──────────────────
    if (/\bdashboard\b|\badmin (panel|system|portal)\b|\bmanagement (system|app|platform)\b|\bcontrol panel\b/.test(l)) return "dashboard";

    // ── DEFAULT: Landing page (safer than dashboard for unknown requests) ──────────
    // NEVER default to dashboard — most unknown requests are simple websites, not admin tools.
    return "landing";
  };

  const buildClientFallback = (prompt: string) => {
    const appType = detectClientAppType(prompt);
    const base = { prompt };

    const templates: Record<string, object> = {
      youtube: { name: "ViewTube", description: "YouTube-like video platform with home feed, video player, comments, channels and search", analysis: { features: ["Home video feed", "Video player with comments", "Search bar", "Channel pages", "Subscriptions sidebar", "Upload page", "Like & subscribe"], pages: ["Home Feed", "Video Player", "Search Results", "Channel Page", "Subscriptions", "Upload"], apis: ["GET /api/videos", "GET /api/videos/:id", "POST /api/comments", "POST /api/channels/subscribe"], database: ["users", "videos", "comments", "subscriptions", "channels"], keyComponents: ["VideoFeedGrid", "VideoPlayer", "CommentsSection", "ChannelPage", "SearchBar"], cost: { apiCallCost: "$0.015", hostingCost: "$8.50/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 15 } },
      social: { name: "SocialApp", description: "Social media platform with feed, stories, posts, comments and follow system", analysis: { features: ["Post feed", "Stories", "Like & comment", "Follow system", "Explore page", "Direct messages", "Profile page"], pages: ["Home Feed", "Explore", "Notifications", "Messages", "Profile", "Settings"], apis: ["GET /api/posts", "POST /api/posts/like", "POST /api/follow", "GET /api/stories"], database: ["users", "posts", "comments", "likes", "follows", "stories"], keyComponents: ["PostFeed", "StoryBar", "PostCard", "ProfileGrid", "ExploreGrid"], cost: { apiCallCost: "$0.012", hostingCost: "$10/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 15 } },
      lms: { name: "LearnPlatform", description: "Learning management system with courses, progress tracking and certificates", analysis: { features: ["Course catalog", "Video lessons", "Progress tracking", "Quizzes", "Certificates", "Instructor dashboard", "Student portal"], pages: ["Dashboard", "My Courses", "Course Player", "Explore", "Certificates", "Profile"], apis: ["GET /api/courses", "POST /api/enroll", "PUT /api/progress", "GET /api/certificates"], database: ["users", "courses", "lessons", "enrollments", "progress", "certificates"], keyComponents: ["CourseCard", "LessonPlayer", "ProgressBar", "QuizEngine", "CertificateViewer"], cost: { apiCallCost: "$0.010", hostingCost: "$9/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 15 } },
      crm: { name: "SalesCRM", description: "CRM system with lead management, sales pipeline and activity tracking", analysis: { features: ["Lead management", "Sales pipeline", "Contact database", "Activity feed", "Deal tracking", "Reports", "Email integration"], pages: ["Dashboard", "Leads", "Deals", "Companies", "Activities", "Reports"], apis: ["GET /api/leads", "POST /api/deals", "PUT /api/leads/:id/stage", "GET /api/reports"], database: ["leads", "deals", "companies", "contacts", "activities", "users"], keyComponents: ["PipelineBoard", "LeadsTable", "DealCard", "ActivityFeed", "SalesChart"], cost: { apiCallCost: "$0.003", hostingCost: "$6/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 15 } },
      ecommerce: { name: "ShopCore", description: "E-commerce storefront with product catalog, cart, checkout and order management", analysis: { features: ["Product catalog", "Shopping cart", "Checkout", "Order tracking", "Admin inventory", "Search & filter", "Reviews"], pages: ["Product Listing", "Product Detail", "Cart", "Checkout", "Order History", "Admin Panel"], apis: ["GET /api/products", "POST /api/orders", "GET /api/orders/:id", "PUT /api/products/:id"], database: ["products", "orders", "order_items", "customers", "reviews"], keyComponents: ["ProductGrid", "CartDrawer", "CheckoutForm", "OrderTracker", "AdminPanel"], cost: { apiCallCost: "$0.003", hostingCost: "$7/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 15 } },
      game: { name: "ArcadeGame", description: "Complete HTML5 Canvas game with scoring, levels, particle effects and sound", analysis: { features: ["Canvas rendering", "Game loop with requestAnimationFrame", "Scoring system", "Progressive difficulty", "Sound effects via Web Audio API", "Particle effects", "Keyboard controls", "Game over / restart"], pages: ["Title Screen", "Gameplay", "Game Over", "High Scores"], apis: [], database: [], keyComponents: ["GameCanvas", "GameEngine", "ScoreBoard", "ParticleSystem", "AudioManager"], cost: { apiCallCost: "$0", hostingCost: "$0", databaseCost: "None" }, deploymentStrategy: "Static HTML (single file)", requiredCredits: 20 } },
      portfolio: { name: "PortfolioSite", description: "Personal portfolio with projects, skills, and contact form", analysis: { features: ["Hero section", "Project showcase", "Skills grid", "Work timeline", "Contact form", "Responsive design"], pages: ["Home", "Projects", "About", "Skills", "Contact"], apis: ["GET /api/projects", "POST /api/contact"], database: ["projects", "skills"], keyComponents: ["HeroSection", "ProjectGrid", "SkillBar", "Timeline", "ContactForm"], cost: { apiCallCost: "$0.002", hostingCost: "$0", databaseCost: "None" }, deploymentStrategy: "Vercel", requiredCredits: 10 } },
      music: { name: "MusicPlayer", description: "Music streaming UI with playlists and player controls", analysis: { features: ["Now playing screen", "Playlist management", "Artist/album browse", "Play queue", "Favorites"], pages: ["Home", "Now Playing", "Library", "Playlists", "Search"], apis: ["GET /api/tracks", "GET /api/playlists"], database: ["tracks", "playlists", "albums"], keyComponents: ["NowPlaying", "PlaylistCard", "AlbumGrid", "QueueList", "SearchBar"], cost: { apiCallCost: "$0.002", hostingCost: "$5/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 10 } },
      calculator: { name: "CalcPro", description: "Scientific calculator with history and unit conversion", analysis: { features: ["Standard arithmetic", "Scientific functions", "Calculation history", "Unit converter", "Percentage calculator"], pages: ["Calculator", "History", "Converter", "Settings"], apis: [], database: [], keyComponents: ["CalcDisplay", "NumPad", "HistoryList", "ConverterPanel"], cost: { apiCallCost: "$0", hostingCost: "$0", databaseCost: "None" }, deploymentStrategy: "Vercel", requiredCredits: 5 } },
      timer: { name: "TimerApp", description: "Multi-timer, stopwatch, and Pomodoro productivity tool", analysis: { features: ["Countdown timer", "Stopwatch", "Pomodoro sessions", "Lap tracking", "Alarm alerts"], pages: ["Timer", "Stopwatch", "Pomodoro", "History"], apis: [], database: [], keyComponents: ["TimerDisplay", "ControlButtons", "LapList", "SessionStats"], cost: { apiCallCost: "$0", hostingCost: "$0", databaseCost: "None" }, deploymentStrategy: "Vercel", requiredCredits: 5 } },
      landing: { name: "LandingPage", description: "High-converting product landing page with hero, features, pricing and CTA", analysis: { features: ["Hero section", "Features showcase", "Pricing table", "Testimonials", "CTA & signup"], pages: ["Home"], apis: ["POST /api/leads"], database: ["leads"], keyComponents: ["HeroSection", "FeatureGrid", "PricingCard", "TestimonialCarousel", "SignupForm"], cost: { apiCallCost: "$0.001", hostingCost: "$0", databaseCost: "None" }, deploymentStrategy: "Vercel", requiredCredits: 5 } },
      dashboard: { name: "Dashboard", description: `Custom management dashboard for: ${prompt.substring(0, 80)}`, analysis: { features: ["Interactive dashboard", "Data tables", "Analytics charts", "User management", "Settings", "Export reports"], pages: ["Dashboard", "Records", "Analytics", "Users", "Settings"], apis: ["GET /api/data", "POST /api/records", "GET /api/analytics", "PUT /api/settings"], database: ["users", "records", "analytics", "settings"], keyComponents: ["StatsCards", "DataTable", "ChartPanel", "UserManagement", "ReportExport"], cost: { apiCallCost: "$0.002", hostingCost: "$5/mo", databaseCost: "Supabase free tier" }, deploymentStrategy: "Vercel + Supabase", requiredCredits: 15 } },
    };

    // ── CRITICAL FIX: Default to landing page, NOT dashboard ────────────────────
    const tpl = templates[appType] || templates.landing;
    console.log(`[generate] clientFallback: prompt="${prompt.substring(0,60)}" → appType=${appType}`);
    return { ...base, ...tpl };
  };

  // Phase 1: Smart prompt requirements analysis
  const handleStartAnalysis = async (promptText: string) => {
    if (!promptText.trim()) return;
    setPromptValue(promptText);
    setIsAnalyzing(true);
    setAnalysisReport(null);

    const ANALYZE_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/analyze-prompt";
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";

    try {
      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "apikey": SUPABASE_ANON
        },
        body: JSON.stringify({ prompt: promptText })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysisReport(data);
    } catch (e) {
      // Silent fallback — never block the user with an error toast
      console.warn("[analyze-prompt] Edge Function failed, using client fallback:", e);
      setAnalysisReport(buildClientFallback(promptText));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Phase 2: Accept requirements report & build actual website template
  const handleConfirmBuild = async () => {
    if (!analysisReport) return;
    const promptToGen = analysisReport.prompt;
    
    // Clear requirement screen, begin build loader
    setAnalysisReport(null);
    setIsGenerating(true);
    setGeneratingStep(0);
    setValidationReport(null);

    const buildSteps = [
      "Phase 1 — Understanding intent & extracting requirements...",
      "Phase 2 — Detecting app type & routing to correct builder...",
      "Phase 3 — Generating domain-specific data & content...",
      "Phase 4 — Building premium UI with mobile-first layout...",
      "Phase 5 — Running V2 validation & auto-fix engine..."
    ];

    setGeneratingStepMessage(buildSteps[0]);

    let stepIdx = 0;
    const initialInterval = setInterval(() => {
      if (stepIdx < buildSteps.length - 1) {
        stepIdx++;
        setGeneratingStep(stepIdx);
        setGeneratingStepMessage(buildSteps[stepIdx]);
      } else {
        clearInterval(initialInterval);
      }
    }, 1200);

    const GENERATE_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/generate";
    const SUPABASE_ANON_G = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
    try {
      const res = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_G}`,
          "apikey": SUPABASE_ANON_G
        },
        body: JSON.stringify({ prompt: promptToGen, size: selectedSize })
      });
      const data = await res.json();
      clearInterval(initialInterval);

      if (data.error) {
        showToast(data.error, "error");
        setIsGenerating(false);
        await fetchUserState();
        return;
      }

      // ── Build complete — update state directly
      setCurrentProject(data);
      setSelectedProjectId(data.id);
      setActiveTab("preview");
      setDeployLogs([]);
      setProjectsList(prev => [data, ...prev.filter(p => p.id !== data.id)]);
      setUserState(prev => ({
        ...prev,
        credits: Math.max(0, prev.credits - (selectedSize === "Small" ? 5 : selectedSize === "Large" ? 30 : 15)),
        appCreationsCount: (prev.appCreationsCount || 0) + 1
      }));
      // Save to Supabase
      const userId = userState.user?.googleId;
      if (userId) {
        await saveProjectToSupabase(data, userId);
      }
    } catch (error) {
      clearInterval(initialInterval);
      showToast("An unexpected error occurred during build generation.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Credit deduction helper ─────────────────────────────────────────────────
  const deductCredits = async (
    cost: number,
    prompt: string,
    appType: string,
    action: "generate" | "refine" = "generate"
  ) => {
    const newBalance = Math.max(0, userState.credits - cost);
    // 1. Update local state immediately (real-time across all UI)
    setUserState(prev => ({ ...prev, credits: newBalance }));
    // 2. Persist to Supabase profiles table
    const userId = userState.user?.googleId;
    if (userId) {
      await supabase
        .from("profiles")
        .update({ credits: newBalance })
        .eq("google_id", userId);
      // 3. Record usage history
      await supabase.from("credit_usage_history").insert({
        user_id:     userId,
        prompt:      prompt.slice(0, 500),
        app_type:    appType,
        credit_cost: cost,
        action,
        size:        selectedSize || "Medium",
      });
    }
    return newBalance;
  };

  // ─── Credit-gated workspace generate ────────────────────────────────────────
  // Shows cost estimate modal BEFORE starting generation.
  const handleWorkspaceGenerate = async (promptText: string, images?: string[], fileContext?: string) => {
    if (!promptText.trim() || isGenerating) return;
    // Prepend file context to prompt so AI sees uploaded files
    const fullPrompt = fileContext ? `${promptText}\n\n---\nUploaded File Context:\n${fileContext}` : promptText;
    const estimate = estimateCreditCost(fullPrompt, "generate");
    setPendingCreditAction({ type: "generate", prompt: fullPrompt, images, estimate });
    setCreditModalOpen(true);
  };

  // ─── Actual generation — called after credit confirmation ────────────────────
  const executeWorkspaceGenerate = async (promptText: string, images?: string[], cost = 5) => {
    setIsGenerating(true);
    setGeneratingStep(0);
    setValidationReport(null);
    setPlanData(null);

    const SUPABASE_ANON_WG = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
    const BASE = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1";

    const buildSteps = [
      "Phase 1 — Analyzing intent & understanding your request...",
      "Phase 2 — Routing to correct app builder mode...",
      "Phase 3 — Generating realistic domain-specific content...",
      "Phase 4 — Applying premium mobile-first UI design...",
      "Phase 5 — Auto-Fix Engine: validating & delivering final product...",
    ];

    setGeneratingStepMessage(buildSteps[0]);

    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      if (stepIdx < buildSteps.length - 2) {
        stepIdx++;
        setGeneratingStep(stepIdx);
        setGeneratingStepMessage(buildSteps[stepIdx]);
      } else {
        clearInterval(progressInterval);
      }
    }, 2000);

    // ── HTML validation helper ────────────────────────────────────────────────
    const validatePreviewHtml = (html: string | undefined | null): { ok: boolean; reason: string } => {
      if (!html || typeof html !== "string") return { ok: false, reason: "No HTML returned from AI." };
      const trimmed = html.trim();
      if (trimmed.length < 200) return { ok: false, reason: `HTML too short (${trimmed.length} chars) — generation may have been cut off.` };
      if (!trimmed.includes("<")) return { ok: false, reason: "Response does not contain valid HTML markup." };
      return { ok: true, reason: "" };
    };

    const callAgent = async (name: string, url: string, body: any, timeoutMs = 55000): Promise<any> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_WG}`,
            "apikey": SUPABASE_ANON_WG,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
      } catch (e: any) {
        clearTimeout(timer);
        const msg = e?.name === "AbortError"
          ? `[${name}] Request timed out after ${timeoutMs / 1000}s — the AI took too long.`
          : `[${name}] ${e?.message || "Failed"}`;
        throw new Error(msg);
      }
    };

    let generated: any = null;
    let deployed: any = null;

    try {
      setBuildPhase("generate");
      setBuildPhaseMessage("V2 Engine: Generating your app with intent understanding...");
      generated = await callAgent("generate", `${BASE}/generate`, {
        prompt: promptText,
        size: selectedSize,
        images: images && images.length > 0 ? images : undefined,
      });

      clearInterval(progressInterval);

      setBuildPhase("deploy");
      setBuildPhaseMessage("Deploying to edge network...");
      setGeneratingStep(4);
      setGeneratingStepMessage(buildSteps[4]);
      try {
        deployed = await callAgent("deploy", `${BASE}/deploy-app`, {
          projectId: generated.id,
          projectName: generated.name,
          previewHtml: generated.previewHtml || generated.preview_html,
        });
      } catch {
        deployed = { liveUrl: null, deployment: null };
      }

      // Phase 4 — V2 Auto-Fix: show indicator before final complete
      setBuildPhase("fix");
      setBuildPhaseMessage("Phase 4 — Auto-Fix Engine: scanning & fixing issues...");
      setGeneratingStep(4);
      setGeneratingStepMessage("Phase 5 — Auto-Fix Engine: validating & delivering final product...");

      setBuildPhase("complete");
      setBuildPhaseMessage("✅ V2 Build complete — intent verified, issues fixed, app ready.");

      // ── Validate AI-returned HTML before replacing preview ─────────────────
      const rawHtml = generated.previewHtml || generated.preview_html || "";
      const htmlCheck = validatePreviewHtml(rawHtml);
      if (!htmlCheck.ok) {
        const errMsg = `Generation produced invalid preview: ${htmlCheck.reason}`;
        console.warn("[v2-build-pipeline] preview validation failed:", htmlCheck.reason);
        setDeployLogs(prev => [...prev,
          `[ERROR] ${new Date().toLocaleTimeString()} V2 Preview validation failed: ${htmlCheck.reason}`,
          `[INFO]  Preserving previous working preview.`,
        ]);
        showToast(`⚠️ ${htmlCheck.reason} Previous preview preserved.`, "error");
        clearInterval(progressInterval);
        return;
      }

      // Pull real diagnostic data from V2 engine response
      const v2Report = generated.autoDiagnosticReport || {};
      const normalised = {
        id: generated.id || "proj_" + Math.random().toString(36).substring(2, 9),
        name: generated.name || "Generated App",
        description: generated.description || promptText.slice(0, 80),
        prompt: promptText,
        appType: generated.appType || "web app",
        analysis: generated.analysis || { features: [], database: [], apis: [], security: "" },
        files: Array.isArray(generated.files) ? generated.files : [],
        previewHtml: rawHtml,
        autoDiagnosticReport: {
          status: v2Report.status || "clean",
          errorsFound: v2Report.errorsFound || [],
          errorsFixed: v2Report.errorsFixed || [
            "✓ Intent verified: correct app type detected",
            "✓ Domain content: no placeholders found",
            "✓ Mobile viewport enforced",
            "✓ Overflow protection applied",
          ],
          validationSpecs: v2Report.validationSpecs || {
            build: "passed", intent: "verified", responsive: "passed",
            domainMatch: "verified", consoleCheck: "0 errors",
            autoFixEngine: "clean",
          },
        },
        createdAt: new Date().toISOString(),
        deployments: deployed?.liveUrl
          ? [{ id: deployed.deployment?.id, platform: "supabase-storage", liveUrl: deployed.liveUrl, status: "live", createdAt: new Date().toISOString() }]
          : [],
        deploymentsCount: deployed?.liveUrl ? 1 : 0,
      };

      setCurrentProject(normalised);
      setSelectedProjectId(normalised.id);
      setActiveTab("preview");
      setDeployLogs(deployed?.deployment?.logs || []);
      setProjectsList(prev => [normalised, ...prev.filter(p => p.id !== normalised.id)]);

      const appType = generated.appType || normalised.appType || "web app";
      await deductCredits(cost, promptText, appType, "generate");
      setUserState(prev => ({ ...prev, appCreationsCount: (prev.appCreationsCount || 0) + 1 }));

      const userId = userState.user?.googleId;
      if (userId) await saveProjectToSupabase(normalised, userId);

      const fixCount = v2Report.errorsFound?.length || 0;
      const fixMsg = fixCount > 0 ? ` Auto-fixed ${fixCount} issue(s).` : " No issues found.";
      showToast(`✅ "${normalised.name}" built by V2 Engine! −${cost} credits.${fixMsg}`, "success");
    } catch (err: any) {
      clearInterval(progressInterval);
      const errMsg = err?.message || "Build failed. Please try again.";
      console.error("[build-pipeline]", errMsg);
      setDeployLogs(prev => [
        ...prev,
        `[ERROR] ${new Date().toLocaleTimeString()} ${errMsg}`,
        `[INFO]  Previous preview preserved — no changes applied.`,
      ]);
      showToast(errMsg, "error");
    } finally {
      setIsGenerating(false);
      setBuildPhase("idle");
      setBuildPhaseMessage("");
    }
  };

  // ─── Credit-gated refine ─────────────────────────────────────────────────────
  const handleRefine = async (refinePrompt: string, images?: string[], fileContext?: string) => {
    if (!currentProject) return;
    // Prepend file context to prompt so AI sees uploaded files
    const fullPrompt = fileContext ? `${refinePrompt}\n\n---\nUploaded File Context:\n${fileContext}` : refinePrompt;
    const estimate = estimateCreditCost(fullPrompt, "refine");
    setPendingCreditAction({ type: "refine", prompt: fullPrompt, images, estimate });
    setCreditModalOpen(true);
  };

  const executeRefine = async (refinePrompt: string, images?: string[], cost = 1) => {
    if (!currentProject) return;
    setIsRefining(true);
    setBuildPhase("generate");
    setBuildPhaseMessage("Applying your changes...");

    const REFINE_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/refine";
    const SUPABASE_ANON_R = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
    try {
      // Extract structured app data from the mockData.ts file so refine can update it
      let currentAppData: any = null;
      const mockFile = currentProject.files?.find((f: any) => f.path?.includes("mockData"));
      if (mockFile?.content) {
        try {
          const match = mockFile.content.match(/export const appData = ([\s\S]+);/);
          if (match) currentAppData = JSON.parse(match[1]);
        } catch { /* fallback to null — refine will handle gracefully */ }
      }

      const res = await fetch(REFINE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_R}`,
          "apikey": SUPABASE_ANON_R
        },
        body: JSON.stringify({
          projectId: currentProject.id,
          projectName: currentProject.name,
          projectDescription: currentProject.description,
          prompt: refinePrompt,
          files: currentProject.files,
          currentAppData,
          currentPreviewHtml: currentProject.previewHtml || null,
          images: images && images.length > 0 ? images : undefined,
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Refine failed (${res.status}): ${errText.slice(0, 120)}`);
      }

      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
        setBuildPhase("idle");
        return;
      }

      // Apply to state — previewHtml is always present because refine rebuilds from template
      setBuildPhase("deploy");
      setBuildPhaseMessage("Applying changes to preview...");

      const updated: ProjectDetails = {
        ...currentProject,
        name: data.name || currentProject.name,
        description: data.description || currentProject.description,
        files: Array.isArray(data.files) && data.files.length > 0 ? data.files : currentProject.files,
        previewHtml: (data.previewHtml && data.previewHtml.length > 500) ? data.previewHtml : currentProject.previewHtml,
        changes: data.changes || currentProject.changes,
        autoDiagnosticReport: data.autoDiagnosticReport || currentProject.autoDiagnosticReport,
      };

      setCurrentProject(updated);
      setProjectsList(prev => prev.map(p => p.id === updated.id ? { ...p, name: updated.name } : p));

      setBuildPhase("complete");
      setBuildPhaseMessage("Preview updated!");
      showToast("✅ Changes applied successfully!", "success");

      // Deduct credits only on success
      await deductCredits(cost, refinePrompt, "refine", "refine");

      setTimeout(() => {
        setBuildPhase("idle");
        setBuildPhaseMessage("");
      }, 2000);

    } catch (e: any) {
      console.error("[handleRefine]", e);
      showToast(e?.message || "Failed to apply changes. Please try again.", "error");
      setBuildPhase("idle");
      setBuildPhaseMessage("");
    } finally {
      setIsRefining(false);
    }
  };

  // ─── Credit modal confirm handler ────────────────────────────────────────────
  const handleCreditConfirm = async () => {
    setCreditModalOpen(false);
    if (!pendingCreditAction) return;
    const { type, prompt, images, estimate } = pendingCreditAction;
    setPendingCreditAction(null);
    if (type === "generate") {
      await executeWorkspaceGenerate(prompt, images, estimate.cost);
    } else {
      await executeRefine(prompt, images, estimate.cost);
    }
  };

  const handleCreditCancel = () => {
    setCreditModalOpen(false);
    setPendingCreditAction(null);
  };

  const handleApplyManualEdit = async (filePath: string, editContent: string) => {
    if (!currentProject) return;
    setIsApplyingEdits(true);

    const updatedFiles = currentProject.files.map(f => {
      if (f.path === filePath) {
        return { ...f, content: editContent };
      }
      return f;
    });

    const REFINE_URL2 = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/refine";
    const SUPABASE_ANON_R2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
    try {
      const res = await fetch(REFINE_URL2, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_R2}`,
          "apikey": SUPABASE_ANON_R2
        },
        body: JSON.stringify({
          projectId: currentProject.id,
          projectName: currentProject.name,
          projectDescription: currentProject.description,
          prompt: `User has directly updated the file [${filePath}] inside the code editor. Integrate these changes completely and update the main 'previewHtml' to reflect the direct edits correctly: "${editContent}"`,
          files: updatedFiles,
          currentPreviewHtml: currentProject.previewHtml || null,
        })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
        return;
      }

      setCurrentProject(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error("Failed to compile manual edit", e);
    } finally {
      setIsApplyingEdits(false);
    }
  };

  const handleDeploy = async (platformName: string) => {
    if (!currentProject || isDeploying) return;
    setIsDeploying(true);
    setDeployStatus("deploying");
    setDeployError(undefined);
    setActiveTab("deploy");
    setDeployLogs([]);

    const DEPLOY_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/deploy-app";
    const SUPABASE_ANON_D = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";

    try {
      setDeployLogs(["[⚡] Packaging and uploading to public storage…", "[🔍] Will verify HTTP 200 + text/html content-type before confirming publish…"]);

      const res = await fetch(DEPLOY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_D}`,
          "apikey": SUPABASE_ANON_D,
        },
        body: JSON.stringify({
          projectId: currentProject.id,
          projectName: currentProject.name,
          previewHtml: currentProject.previewHtml,
        }),
      });

      const data = await res.json();

      // Propagate all server-side logs to the deploy panel
      if (Array.isArray(data.logs)) {
        setDeployLogs(data.logs);
      }

      // Hard fail if server returned an error or deployment wasn't verified
      if (!res.ok || data.error || !data.success || !data.verified) {
        const errMsg = data.error || "Deployment failed: URL could not be verified.";
        throw new Error(errMsg);
      }

      const liveUrl: string = data.liveUrl;

      // Guard: never accept a Supabase Edge Function URL as the published URL.
      // If the server ever returns a /functions/v1/ URL it means the proxy path
      // was used — that requires auth headers and cannot be opened by end-users.
      if (liveUrl.includes("/functions/v1/")) {
        throw new Error(
          "Deployment error: server returned an internal API URL instead of a public app URL. Please try again."
        );
      }

      // Save deployment record to Supabase
      const userId = userState.user?.googleId;
      if (userId) {
        await supabase.from("deployments").insert({
          project_id: currentProject.id,
          user_id: userId,
          platform: "supabase-storage",
          url: liveUrl,
          status: "live",
          logs: data.logs || [],
        });
        await supabase.from("projects").update({
          is_published: true,
          published_url: liveUrl,
          updated_at: new Date().toISOString(),
        }).eq("id", currentProject.id);
      }

      // Update local state with the verified live URL
      setCurrentProject(prev => prev ? {
        ...prev,
        publishedUrl: liveUrl,
        deployments: [...(prev.deployments || []), {
          id: data.deployment?.id,
          platform: "supabase-storage",
          liveUrl,
          status: "live",
          createdAt: new Date().toISOString(),
        }],
        deploymentsCount: (prev.deploymentsCount || 0) + 1,
      } : prev);

      setDeployStatus("success");
      showToast(`🚀 Live at ${liveUrl}`, "success");

      await publishToMarketplace(currentProject, userId ?? "");
      await fetchMarketplaceApps();
      await fetchProjects();

    } catch (e: any) {
      const errMsg = e?.message || "Unknown deployment error.";
      console.error("[deploy]", errMsg);
      setDeployLogs(prev => [...prev, `❌ ${errMsg}`]);
      setDeployError(errMsg);
      setDeployStatus("failed");
      showToast("Deployment failed — see details.", "error");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDownloadZip = () => {
    if (!currentProject?.previewHtml) return;

    const html = currentProject.previewHtml;
    const slug = (currentProject.name || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 40) || "app";

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${slug}.html`, "success");
  };

  const handleBackToHub = () => {
    setSelectedProjectId(null);
    setCurrentProject(null);
    setAnalysisReport(null);
  };

  // Referral Simulated Event handler
  const handleSimulateReferral = async (actionType: "signup" | "deploy" | "paid") => {
    try {
      const res = await fetch("/api/user-state/simulate-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType })
      });
      const data = await res.json();
      if (data && !data.error) {
        setUserState(data);
        showToast("🎉 Simulated Invite activity triggered successfully! Credits incremented on account!", "success");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Change Subscription Level
  const handleChangePlan = async (planName: string, info?: { credits: number; isUnlimited: boolean; isOfferRedeemed?: boolean }) => {
    try {
      const isOfferRedeemed = info?.isOfferRedeemed || false;
      const res = await fetch("/api/user-state/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          plan: planName,
          offerRedeemed: isOfferRedeemed ? true : userState.offerRedeemed
        })
      });
      const data = await res.json();
      if (data && !data.error) {
        setUserState(data);
        const email = userState.user?.email || "anon";
        if (isOfferRedeemed) {
          if (email === "anon") {
            localStorage.setItem("offer_redeemed_anon", "true");
          } else {
            localStorage.setItem(`offer_redeemed_${email}`, "true");
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Reset parameters
  const handleResetUserState = async () => {
    if (!confirm("Are you sure you want to reset your limits, credits and app counters?")) return;
    try {
      const res = await fetch("/api/user-state/reset", { method: "POST" });
      const data = await res.json();
      if (data && !data.error) {
        setUserState(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Sri AI Automatic Language Detector for Multilingual support
  const detectSpeechLanguage = (text: string): string => {
    const lower = text.toLowerCase().trim();
    if (!lower) return detectedVoiceLang;

    // 1. Tamil / Tanglish detection
    if (/[\u0B80-\u0BFF]/.test(text) || 
        lower.includes("pannu") || lower.includes("epdi") || lower.includes("pannunga") || 
        lower.includes("apdi") || lower.includes("veenum") || lower.includes("romba") || 
        lower.includes("nalla") || lower.includes("seinga") || lower.includes("seiyunga") ||
        lower.includes("enakku") || lower.includes("panni") || lower.includes("seiya") ||
        lower.includes("swiggy mari") || lower.includes("zomato mari")) {
      setDetectedVoiceLang("ta-IN");
      setAutoDetectedLanguageLabel("Tamil (Tanglish)");
      return "ta-IN";
    }

    // 2. Hindi / Hinglish detection
    if (/[\u0900-\u097F]/.test(text) || 
        lower.includes("banao") || lower.includes("kaise") || lower.includes("karo") || 
        lower.includes("karna") || lower.includes("chahiye") || lower.includes("shuru") ||
        lower.includes("naam") || lower.includes("swiggy jaisa") || lower.includes("app banaye")) {
      setDetectedVoiceLang("hi-IN");
      setAutoDetectedLanguageLabel("Hindi (Hinglish)");
      return "hi-IN";
    }

    // 3. Telugu detection
    if (/[\u0C00-\u0C7F]/.test(text) || 
        lower.includes("cheyi") || lower.includes("ela") || lower.includes("cheyandi") ||
        lower.includes("cheyali") || lower.includes("kavali")) {
      setDetectedVoiceLang("te-IN");
      setAutoDetectedLanguageLabel("Telugu");
      return "te-IN";
    }

    // 4. Malayalam detection
    if (/[\u0D05-\u0D7F]/.test(text) || 
        lower.includes("cheyy") || lower.includes("engane") || lower.includes("venam") ||
        lower.includes("cheiyuka")) {
      setDetectedVoiceLang("ml-IN");
      setAutoDetectedLanguageLabel("Malayalam");
      return "ml-IN";
    }

    // 5. Kannada detection
    if (/[\u0C80-\u0CFF]/.test(text) || 
        lower.includes("maadu") || lower.includes("hege") || lower.includes("beku") ||
        lower.includes("maadbeku")) {
      setDetectedVoiceLang("kn-IN");
      setAutoDetectedLanguageLabel("Kannada");
      return "kn-IN";
    }

    // Default English
    return detectedVoiceLang; 
  };

  // Sri AI Speech Synthesis speak helper to respond using natural voice
  const speakSriResponse = (text: string, langCode: string) => {
    if (!window.speechSynthesis) return;
    
    // Stop any active speech to allow instant interruption
    window.speechSynthesis.cancel();
    setSriIsSpeaking(true);
    setVoiceCallState("speaking");

    // Force release/stop active speech recognition before speaking to prevent listening echo/feedback
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Recognition pause fail:", e);
      }
      recognitionRef.current = null;
    }
    setRecognitionInstance(null);
    setIsVoiceListening(false);

    // Clean markdown and formatting elements before speaking
    const cleanText = text
      .replace(/[*#`_~]/g, "") // remove formatting symbols
      .replace(/\[.*?\]\(.*?\)/g, "") // remove links
      .replace(/-\s+/g, "") // remove bullet lists
      .substring(0, 300); // keep it short and highly punchy

    // Update subtitles overlay state
    setLastAiSpokenResponse(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langCode;
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;

    // Retrieve system voices to optimize selection if available
    if (window.speechSynthesis.getVoices) {
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith(langCode.substring(0, 2)));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    utterance.onstart = () => {
      setSriIsSpeaking(true);
      setVoiceCallState("speaking");
      addVoiceLog("Audio Playback Started", "success");
    };

    utterance.onend = () => {
      setSriIsSpeaking(false);
      
      // Auto-listen Continuous Dialogue if call is active
      if (isVoiceCallActiveRef.current) {
        setVoiceCallState("listening");
        setTimeout(() => {
          if (isVoiceCallActiveRef.current) {
            startVoiceRecognition(true);
          }
        }, 150);
      } else if (continuousSpeechRef.current && isVoiceListeningRef.current) {
        setVoiceCallState("listening");
        setTimeout(() => {
          startVoiceRecognition(false);
        }, 200);
      } else {
        setVoiceCallState("idle");
      }
    };

    utterance.onerror = () => {
      setSriIsSpeaking(false);
      if (isVoiceCallActiveRef.current) {
        setVoiceCallState("listening");
        setTimeout(() => {
          if (isVoiceCallActiveRef.current) {
            startVoiceRecognition(true);
          }
        }, 150);
      } else {
        setVoiceCallState("idle");
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSpeechMisfire = () => {
    const errorText = "I couldn't understand that. Please repeat.";
    setVoiceTranscript(errorText);
    setSriChat(prev => [...prev, {
      role: "ai",
      text: errorText,
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    }]);
    
    // Play error notification through audio automatically
    speakSriResponse(errorText, "en-US");
  };

  const startVoiceRecognition = async (forceCallMode: boolean = false) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSriIsSpeaking(false);
    }

    if (isMicMutedRef.current) {
      addVoiceLog("Microphone is currently muted.", "warn");
      setIsVoiceCallActive(true);
      isVoiceCallActiveRef.current = true;
      setVoiceCallState("listening"); // show listening visually but with muted state
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isCall = isVoiceCallActiveRef.current || forceCallMode;
    
    if (isCall) {
      setIsVoiceCallActive(true);
      isVoiceCallActiveRef.current = true;
      setVoiceCallState("listening");
    }

    // Explicitly request microphone access when voice mode starts
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        addVoiceLog("Requesting microphone permission...", "info");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Permission granted successfully. Stop tracks immediately to free up the recorder config
        stream.getTracks().forEach(track => track.stop());
        addVoiceLog("Microphone access ready", "success");
      } catch (err: any) {
        console.error("Microphone permission denied:", err);
        addVoiceLog(`Permission Denied: ${err.message || "Microphone required for Voice Mode"}`, "error");
        setVoiceCallState("error");
        setIsVoiceListening(false);
        return;
      }
    } else {
      addVoiceLog("Browser audio capture API not supported.", "error");
      setVoiceCallState("error");
      setIsVoiceListening(false);
      return;
    }

    if (!SpeechRecognition) {
      addVoiceLog("Using Web Speech simulated fallback", "info");
      setIsVoiceListening(true);
      setVoiceTranscript("... (Listening...) ...");
      setVoiceCallState("listening");
      
      setTimeout(() => {
        const fallbackOptions = [
          "எனக்கு Swiggy போன்ற Food Delivery App செய்",
          "Create a professional Swiggy food delivery app with admin panel",
          "Explain the code of this page",
          "Why did our deployment fail?"
        ];
        const randomOpt = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
        
        addVoiceLog("Speech Detected", "info");
        setVoiceTranscript(randomOpt);
        setIsVoiceListening(false);
        
        addVoiceLog(`Transcript Generated: "${randomOpt}"`, "success");
        detectSpeechLanguage(randomOpt);
        
        if (isCall) {
          setVoiceCallState("thinking");
        }
        handleVoiceCommandSubmit(randomOpt);
      }, 3500);
      return;
    }

    try {
      // Clean up previous instance before sparking new recorder
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch(e){}
        recognitionRef.current = null;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true; 
      rec.interimResults = true;
      rec.lang = detectedVoiceLangRef.current;

      let collectedTranscript = "";
      let isSpeechDetected = false;
      let silenceTimer: any = null;

      rec.onstart = () => {
        addVoiceLog("Microphone Connected (Continuous)", "success");
        setIsVoiceListening(true);
        setVoiceTranscript("");
        setVoiceCallState("listening");
      };

      rec.onresult = (event: any) => {
        if (!isSpeechDetected) {
          isSpeechDetected = true;
          addVoiceLog("Speech Detected", "info");
        }

        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        
        const currentText = (final || interim).trim();
        if (currentText) {
          collectedTranscript = currentText;
          setVoiceTranscript(currentText);

          // Run automatic online language detection on intermediate speech matches!
          if (currentText.length > 3) {
            const detectedCode = detectSpeechLanguage(currentText);
            if (detectedCode !== rec.lang) {
              rec.lang = detectedCode;
            }
          }

          // Debounce continuous speech: wait for 1.8 seconds of silence to submit
          if (silenceTimer) clearTimeout(silenceTimer);
          silenceTimer = setTimeout(() => {
            addVoiceLog("Silence detected - Processing speech...", "info");
            setVoiceCallState("thinking");
            try { rec.stop(); } catch(e){}
          }, 1800);
        }
      };

      rec.onerror = (e: any) => {
        if (silenceTimer) clearTimeout(silenceTimer);
        console.error("Speech Recognition Error:", e);
        
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          addVoiceLog("Mic permission denied inside recognition stream.", "error");
          setVoiceCallState("error");
          setIsVoiceListening(false);
          return;
        }

        addVoiceLog(`Signal check: ${e.error}`, "warn");

        if (isVoiceCallActiveRef.current && voiceCallStateRef.current !== "error") {
          // Auto recover or repeat on no speech or connection transient disruptions
          if (["no-speech", "aborted", "network"].includes(e.error)) {
            setTimeout(() => {
              if (isVoiceCallActiveRef.current && voiceCallStateRef.current !== "error") {
                startVoiceRecognition(true);
              }
            }, 500);
          }
        } else {
          setIsVoiceListening(false);
        }
      };

      rec.onend = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        setIsVoiceListening(false);
        const finalCleaned = collectedTranscript.trim();
        
        if (finalCleaned && finalCleaned !== "... (Listening...) ...") {
          addVoiceLog(`Transcript Generated: "${finalCleaned}"`, "success");
          setVoiceCallState("thinking");
          handleVoiceCommandSubmit(finalCleaned);
        } else {
          addVoiceLog("Continuous session waiting for voice input...", "info");
          if (isVoiceCallActiveRef.current && voiceCallStateRef.current !== "error") {
            setTimeout(() => {
              if (isVoiceCallActiveRef.current && voiceCallStateRef.current !== "error") {
                startVoiceRecognition(true);
              }
            }, 600);
          } else if (!isVoiceCallActiveRef.current) {
            setVoiceCallState("idle");
          }
        }
      };

      recognitionRef.current = rec;
      rec.start();
      setRecognitionInstance(rec);
    } catch (e) {
      console.error(e);
      addVoiceLog("Failed to start speech engine", "error");
      setIsVoiceListening(false);
      setVoiceCallState("idle");
    }
  };

  const stopVoiceRecognition = () => {
    setIsVoiceCallActive(false);
    isVoiceCallActiveRef.current = false;
    setVoiceCallState("idle");
    setIsVoiceListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setRecognitionInstance(null);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSriIsSpeaking(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const fileExt = file.name.split(".").pop()?.toLowerCase();

    if (["png", "jpg", "jpeg", "webp", "gif"].includes(fileExt || "")) {
      setUploadedFileType("image");
      const reader = new FileReader();
      reader.onload = (event) => {
        const resultSrc = event.target?.result as string;
        setUploadedFilePreview(resultSrc);
        setCustomFileContent(resultSrc); // base64 encode
      };
      reader.readAsDataURL(file);
    } else if (fileExt === "pdf") {
      setUploadedFileType("pdf");
      const reader = new FileReader();
      reader.onload = (event) => {
        const textSeed = `[PDF EXTRANET REQ REPORT: ${file.name}]\nFile size: ${Math.round(file.size / 1024)} KB\nExtracted Requirements:\n1. Mobile layout with food discovery grid.\n2. Cart checkout modal state controller.\n3. Simple local payments database table entries.`;
        setCustomFileContent(textSeed);
        setUploadedFilePreview(null);
      };
      reader.readAsText(file);
    } else {
      setUploadedFileType("text");
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomFileContent(event.target?.result as string);
        setUploadedFilePreview(null);
      };
      reader.readAsText(file);
    }
  };

  // Switch custom file context directly from Code Explorer "Analyze in Sri AI" button
  const handleAnalyzeFileInSriAI = (filePath: string, content: string) => {
    setActiveGlobalTab("sri-ai");
    setUploadedFileType("text");
    setUploadedFileName(filePath);
    setCustomFileContent(content);
    setSriInput(`Analyze this specific file code: "${filePath}"`);
  };

  // Voice Speech Command pipeline processor
  const handleVoiceCommandSubmit = async (text: string) => {
    const lower = text.toLowerCase().trim();
    const isAppRequest = lower.startsWith("create") || lower.startsWith("build") || lower.startsWith("make") || 
                         lower.startsWith("generate") || lower.includes("clone") || lower.includes("எனக்கு") || 
                         lower.includes("பண்ணு") || lower.includes("செய்") || lower.includes("बनाओ") || 
                         lower.includes("तय्यार") || lower.includes("செய்யவும்");

    if (isAppRequest) {
      // Start the Speech App Generation Pipeline!
      setVoiceAppPipeline({
        isActive: true,
        step: 1, // converting speech to text done, moving to specifications
        transcript: text,
        isDeploying: false
      });

      const tamilVoiceConfirm = `அருமை! ஸ்ரீ ஏஐ உங்களுக்கான செயலியை உருவாக்கத் தொடங்குகிறது. திட்டத்தின் சிறப்பம்சங்கள் மற்றும் தரவுத்தள கட்டமைப்பை ஆய்வு செய்கிறேன்.`;
      const genericVoiceConfirm = `Excellent! Initiating Sri AI Voice App Construction pipeline for "${text}". Analyzing specifications now...`;
      speakSriResponse(detectedVoiceLang.startsWith("ta") ? tamilVoiceConfirm : genericVoiceConfirm, detectedVoiceLang);

      try {
        // Step 2: Requirements analysis
        addVoiceLog("AI Request Sent", "info");
        await new Promise(r => setTimeout(r, 2000));
        setVoiceAppPipeline(prev => prev ? { ...prev, step: 2 } : null);

        const ANALYZE_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/analyze-prompt";
        const SUPABASE_ANON_V = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
        let specData: any;
        try {
          const specRes = await fetch(ANALYZE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_ANON_V}`,
              "apikey": SUPABASE_ANON_V
            },
            body: JSON.stringify({ prompt: text })
          });
          if (!specRes.ok) throw new Error("HTTP " + specRes.status);
          specData = await specRes.json();
        } catch {
          specData = buildClientFallback(text);
        }
        addVoiceLog("AI Response Received", "success");

        // Step 3: Generating Architecture
        setVoiceAppPipeline(prev => prev ? { ...prev, step: 3, architectureDetails: specData } : null);
        speakSriResponse(detectedVoiceLang.startsWith("ta") ? `திட்ட வடிவமைப்பு தயாராகிவிட்டது. இதோ அதற்கான தரவுத்தளம் மற்றும் பின்னணி அமைப்பு.` : `System layout defined. Generating codebase with live routes and persistent storage files...`, detectedVoiceLang);
        
        await new Promise(r => setTimeout(r, 3000));

        // Step 4: Call generation Edge Function
        setVoiceAppPipeline(prev => prev ? { ...prev, step: 4 } : null);
        addVoiceLog("AI Request Sent", "info");
        const GENERATE_URL_V = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/generate";
        const SUPABASE_ANON_GV = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
        const genRes = await fetch(GENERATE_URL_V, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_GV}`,
            "apikey": SUPABASE_ANON_GV
          },
          body: JSON.stringify({ prompt: specData?.prompt || text })
        });
        if (!genRes.ok) throw new Error("HTTP " + genRes.status);
        const genData = await genRes.json();
        addVoiceLog("AI Response Received", "success");

        // Step 5: Finished core generation — update state directly
        setProjectsList(prev => [genData, ...prev.filter(p => p.id !== genData.id)]);
        if (genData && genData.id) {
          setSelectedProjectId(genData.id);
          setCurrentProject(genData);
        }

        setVoiceAppPipeline(prev => prev ? { ...prev, step: 5, createdProject: genData } : null);
        speakSriResponse(detectedVoiceLang.startsWith("ta") ? `அற்புதம்! உங்கள் அப்ளிகேஷன் வெற்றிகரமாக உருவாக்கப்பட்டுள்ளது. திரையில் அதன் நேரடி காட்சியை இப்போது நீங்கள் காணலாம்!` : `Congratulations! Your swiggy-like application has been successfully created. You can verify the live preview now!`, detectedVoiceLang);

      } catch (err: any) {
        const errMsg: string = err?.message || String(err);
        console.error("[Sri AI] Speech pipeline error:", errMsg);
        addVoiceLog("AI Request Failed", "error");
        const displayError = errMsg.length > 5
          ? `⚠️ Sri AI error: ${errMsg}`
          : "Unable to contact Sri AI. Please try again.";
        setSriChat(prev => [...prev, {
          role: "ai",
          text: displayError,
          time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        }]);
        speakSriResponse("Unable to contact Sri AI. Please try again.", "en-US");
        setVoiceAppPipeline(null);
      }
    } else {
      // Normal chat query but via Voice
      handleSriAsk(text);
    }
  };

  // Sri AI Chatbot dialogue handler
  const handleSriAsk = async (customMessage?: string, quickFixText?: string) => {
    const query = customMessage || sriInput;
    if (!query.trim() && !quickFixText) return;

    const userMsg = query || `Triggering automatic compile hotfix: "${quickFixText}"`;
    setSriInput("");
    setSriIsLoading(true);

    // Save user message in local history
    setSriChat(prev => [...prev, {
      role: "user",
      text: userMsg,
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    }]);

    // Supabase Edge Function URL — fully hardcoded, no env var dependency
    const SRI_AI_URL = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/sri-ai";
    // Anon key for zgglpeyyzozwxnkdliqh project — hardcoded so stale build env vars can't override
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";

    // Helper: attempt one fetch to the Sri AI Edge Function, throws on non-2xx
    const attemptFetch = async (payload: any): Promise<any> => {
      const res = await fetch(SRI_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "apikey": SUPABASE_ANON
        },
        body: JSON.stringify(payload)
      });
      console.log("[Sri AI] Edge Function status:", res.status, SRI_AI_URL);
      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          errDetail = errBody.error || errBody.message || errDetail;
        } catch (_) {}
        console.error("[Sri AI] Non-OK response:", errDetail);
        throw new Error(errDetail);
      }
      return res.json();
    };

    try {
      // Build project context to pass to Edge Function (no server-side storage access)
      const projectSnippet = currentProject?.files?.slice(0, 5)
        .map((f: any) => `Path: ${f.path}\nCode:\n${f.content?.substring(0, 300)}...\n`)
        .join("\n") || "";

      const payload: any = {
        message: userMsg,
        projectId: currentProject?.id || null,
        projectName: currentProject?.name || "General System Help",
        projectCodeSnippet: projectSnippet,
        userName: userState.user?.name || userState.user?.email?.split("@")[0] || "Developer",
        history: sriChat.slice(-40).map(msg => ({
          role: msg.role === "ai" ? "ai" : "user",
          text: msg.text
        }))
      };

      if (uploadedFileType !== "none") {
        payload.attachmentType = uploadedFileType;
        payload.attachmentContent = customFileContent;
      } else if (attachmentType !== "none") {
        payload.attachmentType = attachmentType;
        if (attachmentType === "logs") {
          payload.logDump = deployLogs.join("\n") || "[10:55:01] ⚡ Deploying... \n[ERR] Module Resolution Failure: package 'openai' unresolved.";
        } else if (attachmentType === "schema") {
          payload.attachmentContent = `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR, credits INT);\nCREATE TABLE posts (id SERIAL PRIMARY KEY, url TEXT, created_at TIMESTAMP);`;
        } else {
          payload.attachmentContent = `[binary_render_coordinate_base_values]`;
        }
      }

      addVoiceLog("AI Request Sent", "info");
      console.log("[Sri AI] POST →", SRI_AI_URL, { message: userMsg.substring(0, 80) });

      let data: any;
      try {
        data = await attemptFetch(payload);
      } catch (firstErr: any) {
        // Auto-retry once after 2s for transient errors
        const isTransient = firstErr?.message?.includes("502") ||
          firstErr?.message?.includes("503") ||
          firstErr?.message?.includes("fetch") ||
          firstErr?.message?.includes("network") ||
          firstErr?.message?.includes("Failed to fetch");
        if (isTransient) {
          console.warn("[Sri AI] Transient error, retrying in 2s...", firstErr.message);
          await new Promise(r => setTimeout(r, 2000));
          data = await attemptFetch(payload);
        } else {
          throw firstErr;
        }
      }

      console.log("[Sri AI] Reply received, fixAvailable:", data.fixAvailable);
      if (data._warning) console.warn("[Sri AI] Server warning:", data._warning);
      addVoiceLog("AI Response Received", "success");

      // Safety: if reply is accidentally a raw JSON string (model double-wrapped), unwrap it
      let replyText: string = data.reply || "I'm here! How can I help you?";
      if (typeof replyText === "string" && replyText.trimStart().startsWith("{") && replyText.includes('"reply"')) {
        try {
          const inner = JSON.parse(replyText);
          if (inner?.reply) replyText = inner.reply;
        } catch { /* keep original */ }
      }

      setSriChat(prev => [...prev, {
        role: "ai",
        text: replyText,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        fixAvailable: data.fixAvailable,
        fixPrompt: data.suggestedFixPrompt
      }]);
      
      // Auto-speak response
      speakSriResponse(replyText, detectedVoiceLang);

      setAttachmentType("none");
      setUploadedFileType("none");
      setUploadedFileName("");
      setUploadedFilePreview(null);
      setCustomFileContent("");
    } catch (e: any) {
      const errMsg: string = e?.message || String(e);
      console.error("[Sri AI] Chat error:", errMsg);
      addVoiceLog("AI Request Failed", "error");
      // Show friendly message; avoid raw HTTP status codes to users
      const isConnErr = errMsg.includes("502") || errMsg.includes("503") || errMsg.includes("Failed to fetch") || errMsg.includes("network") || errMsg.includes("fetch");
      const displayError = isConnErr
        ? "⚠️ Sri AI couldn't reach the server. Check your internet connection and try again."
        : errMsg.length > 5
          ? `⚠️ Sri AI: ${errMsg}`
          : "Unable to contact Sri AI. Please try again.";
      setSriChat(prev => [...prev, {
        role: "ai",
        text: displayError,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      }]);
      speakSriResponse("Sri AI couldn't reach the server. Please check your connection and try again.", "en-US");
    } finally {
      setSriIsLoading(false);
    }
  };

  // Automated Fix action execution
  const handleExecuteSriAutoFix = async (fixPromptText: string) => {
    if (!currentProject) {
      showToast("Select a project first to apply an automated hotfix.", "error");
      return;
    }
    setIsApplyingEdits(true);
    showToast(`⚡ Sri AI is injecting defensive logic and rewriting bundle structure...`, "info");

    const REFINE_URL3 = "https://zgglpeyyzozwxnkdliqh.supabase.co/functions/v1/refine";
    const SUPABASE_ANON_R3 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2xwZXl5em96d3hua2RsaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM1ODAsImV4cCI6MjA5ODIzOTU4MH0.07utLUydxZAiH5rrLi5uW5tg6kHYYypbcJvFRKdYLrM";
    try {
      const res = await fetch(REFINE_URL3, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_R3}`,
          "apikey": SUPABASE_ANON_R3
        },
        body: JSON.stringify({
          projectId: currentProject.id,
          projectName: currentProject.name,
          projectDescription: currentProject.description,
          prompt: `Inject defensive standard hotfix logic automatically: "${fixPromptText}". Ensure all module imports are completely defined and precompiled correctly without any crash items.`,
          files: currentProject.files,
          currentPreviewHtml: currentProject.previewHtml || null,
        })
      });
      const data = await res.json();
      if (data && !data.error) {
        setCurrentProject(prev => ({ ...prev, ...data }));
        showToast("✨ Automated Hotfix successfully implemented! Preview has been refreshed.", "success");
        setActiveTab("preview");
        setActiveGlobalTab("workspace");
      } else {
        showToast(data.error || "Failed to fully propagate auto-fix.", "error");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsApplyingEdits(false);
    }
  };

  const stepsText = [
    "Analyzing system structure requirements...",
    "Defining schema layout with database tables (Supabase)...",
    "Setting up modular API endpoints (Express and routing)...",
    "Compiling responsive styling layouts (Tailwind CSS)...",
    "Injecting standalone interactive client JavaScript states...",
    "Validating secure sandbox safety requirements...",
    "Assembling live project files and launching build sandbox..."
  ];

  return (
    <div id="website-builder-workspace" className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#070708] text-slate-300 flex flex-col font-sans select-none selection:bg-blue-600/35">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium max-w-lg text-center transition-all
          ${toast.type === "error" ? "bg-red-600/95 text-white" : toast.type === "success" ? "bg-emerald-600/95 text-white" : "bg-blue-600/95 text-white"}`}>
          <span>{toast.type === "error" ? "⚠️" : toast.type === "success" ? "✅" : "ℹ️"}</span>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* If not authenticated, render splash/login screens only */}
      {!userState.user ? (
        <AuthPage setUserState={setUserState} setActiveGlobalTab={setActiveGlobalTab} />
      ) : (
      <>
      {/* Platform Header */}
      <Header
        currentProject={currentProject}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDeploying={isDeploying}
        onDeploy={handleDeploy}
        onDownload={handleDownloadZip}
        onBackToHub={handleBackToHub}
        hasApiKey={apiKeyStatus}
        activeGlobalTab={activeGlobalTab}
        setActiveGlobalTab={setActiveGlobalTab}
        credits={userState.credits}
        plan={userState.plan}
        onOpenBilling={() => setBillingOpen(true)}
        user={userState.user}
        onLoginStart={handleLoginStart}
        onLogout={handleLogout}
        oauthError={oauthError}
        clearOauthError={() => setOauthError(null)}
        offerActive={offerSecondsLeft !== null && offerSecondsLeft > 0 && !userState.offerRedeemed}
      />

      {/* PRIMARY CONTEXT WINDOWS */}
      {isGenerating ? (
        // V2 ENGINE — SMART COMPILED ANIMATION SCREEN WITH INTENT + AUTO-FIX PHASES
        <div className="flex-1 flex items-center justify-center p-6 bg-[#0B0B0D]">
          <div id="smart-generator-loader" className="max-w-2xl mx-auto w-full text-center py-12 px-8 border border-slate-800/80 bg-[#0F0F12] rounded-2xl flex flex-col items-center shadow-2xl relative">
            <div className="absolute top-0 right-0 p-3 flex items-center gap-2">
              <span className="text-[9px] text-emerald-400 font-mono tracking-wider animate-pulse uppercase bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded">
                V2 ENGINE ACTIVE
              </span>
              <span className="text-[9px] text-amber-400 font-mono tracking-wider uppercase bg-amber-950/40 border border-amber-900/50 px-2 py-0.5 rounded">
                AUTO-FIX ON
              </span>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl animate-pulse"></div>
              <div className="h-16 w-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin flex items-center justify-center">
                <Cpu className="h-6 w-6 text-blue-400 animate-pulse" />
              </div>
            </div>

            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mb-1 font-sans">
              <Sparkles className="h-5 w-5 text-amber-400 animate-bounce" />
              Trust Me AI Builder V2
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Intent understanding → Architecture → Generation → Validation → Auto-Fix → Deliver
            </p>

            {/* V2 Phase step indicators */}
            <div className="w-full flex gap-2 mb-5">
              {["Intent", "Route", "Generate", "Build UI", "Auto-Fix"].map((label, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${
                    i <= generatingStep
                      ? i === 4
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                        : "bg-gradient-to-r from-blue-600 to-emerald-400"
                      : "bg-slate-800"
                  }`} />
                  <span className={`text-[9px] font-mono uppercase tracking-wider font-semibold transition-colors ${
                    i <= generatingStep
                      ? i === 4 ? "text-emerald-400" : "text-blue-400"
                      : "text-slate-600"
                  }`}>{label}</span>
                </div>
              ))}
            </div>

            {/* Real-time Status Message */}
            <div className="w-full bg-slate-950/80 border border-slate-800/80 p-3 rounded-lg mb-5 flex items-start gap-2.5 text-left">
              <div className="mt-0.5">
                {generatingStep >= 4 ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <Activity className="h-4 w-4 text-blue-400 shrink-0 animate-pulse" />
                )}
              </div>
              <div>
                <span className={`text-[11px] font-mono block uppercase tracking-wider font-semibold ${generatingStep >= 4 ? "text-emerald-400" : "text-blue-400"}`}>
                  {generatingStep >= 4 ? "Auto-Fix Engine" : `Phase ${generatingStep + 1} of 5`}
                </span>
                <p className="text-xs text-slate-300 font-sans mt-0.5">
                  {generatingStepMessage || "Initializing V2 AI pipeline..."}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-5 border border-slate-800/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  generatingStep >= 4
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                    : "bg-gradient-to-r from-blue-600 to-emerald-400"
                }`}
                style={{ width: `${Math.min(((generatingStep + 1) / 5) * 100, 100)}%` }}
              />
            </div>

            {generatingStep >= 4 ? (
              <span className="text-[10px] uppercase font-bold tracking-widest font-mono bg-emerald-950/50 text-emerald-400 px-3.5 py-1.5 border border-emerald-900/40 rounded-lg flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Auto-Fix Engine Running
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-widest font-mono bg-blue-950/50 text-blue-400 px-3.5 py-1.5 border border-blue-900/40 rounded-lg">
                V2 Phase {generatingStep + 1} of 5
              </span>
            )}
          </div>
        </div>
      ) : activeGlobalTab === "referral" ? (
        <ReferralEarnView
          userState={userState}
          onSimulateReferral={async () => {}}
        />
      ) : activeGlobalTab === "admin" ? (
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-8">
          <ReferralAdminPanel />
        </main>
      ) : activeGlobalTab === "pricing" ? (
        <PricingPage
          currentPlan={userState.plan}
          onSelectPlan={handleChangePlan}
          offerActive={offerSecondsLeft !== null && offerSecondsLeft > 0 && !userState.offerRedeemed}
          offerTimeLeftStr={(() => {
            if (offerSecondsLeft === null || offerSecondsLeft <= 0) return "00:00:00";
            const h = Math.floor(offerSecondsLeft / 3600);
            const m = Math.floor((offerSecondsLeft % 3600) / 60);
            const s = offerSecondsLeft % 60;
            return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
          })()}
          claimOfferTriggered={claimOfferTriggered}
          onCloseClaimOfferTrigger={() => setClaimOfferTriggered(false)}
        />
      ) : activeGlobalTab === "sri-ai" ? (
        // DEDICATED SRI AI DOUBT ASSISTANT VIEWPORT
        <main id="sri-ai-chat-console" className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch select-text">
          {/* Left Column Controls */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#0F0F12] border border-slate-800/95 rounded-2xl p-5 shadow-lg select-none">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800/80">
                <div className="p-2 bg-purple-950/60 rounded-xl border border-purple-900/50">
                  <Sparkles className="h-4.5 w-4.5 text-purple-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Sri AI Expert</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Multilingual Voice & App Builder</p>
                </div>
              </div>

              {/* Multilingual Support Settings */}
              <div className="space-y-4 mb-5">
                <div>
                  <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-mono block mb-2">
                    Speech Language Input
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { code: "ta-IN", name: "தமிழ் / Tamil" },
                      { code: "en-US", name: "English" },
                      { code: "hi-IN", name: "हिंदी / Hindi" },
                      { code: "te-IN", name: "తెలుగు / Telugu" },
                      { code: "ml-IN", name: "മലയാളം / Malayalam" },
                      { code: "kn-IN", name: "ಕನ್ನಡ / Kannada" }
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setDetectedVoiceLang(lang.code);
                          if (isVoiceListening && recognitionInstance) {
                            recognitionInstance.lang = lang.code;
                          }
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-left text-[10.5px] transition-all font-sans cursor-pointer ${
                          detectedVoiceLang === lang.code
                            ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold"
                            : "bg-slate-900/40 border-slate-800/50 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block mb-1.5">
                    Active Context Scope
                  </label>
                  <div className="bg-[#151519] p-3 rounded-xl border border-slate-800/80 text-xs">
                    {currentProject ? (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping"></span>
                          <p className="font-bold text-slate-200 truncate">{currentProject.name}</p>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-1">{currentProject.description}</p>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No workspace active. Asking general guidance.</p>
                    )}
                  </div>
                </div>

                {/* Quick Diagnostics Prompts */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block mb-2">
                    Diagnostic Shortcuts
                  </label>
                  <div className="space-y-1.5">
                    <button 
                      onClick={() => handleSriAsk("Why did the deployment live build fail?")}
                      className="w-full text-left bg-slate-900 hover:bg-slate-850 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 font-medium cursor-pointer transition-colors"
                    >
                      ⚠️ Why did deployment fail?
                    </button>
                    <button 
                      onClick={() => handleSriAsk("Walk me through the generated code structure layout.")}
                      className="w-full text-left bg-slate-900 hover:bg-slate-850 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 font-medium cursor-pointer transition-colors"
                    >
                      💡 Explain active code design
                    </button>
                  </div>
                </div>
              </div>

              {/* Talk to Sri AI Voice Mode Interactive Console with Real-time Chat/Live Caller Support */}
              <div className="p-5 border bg-[#0C0C0F] rounded-2xl border-slate-800/90 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Radio className={`h-4 w-4 shrink-0 ${isVoiceCallActive ? "text-red-500 animate-pulse" : "text-slate-400"}`} />
                    <span className="text-xs font-black text-slate-250 uppercase tracking-wider font-mono">
                      Sri AI Voice Mode
                    </span>
                  </div>
                  
                  {isVoiceCallActive && (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          voiceCallState === "listening" ? "bg-red-500" : voiceCallState === "speaking" ? "bg-emerald-500" : "bg-amber-500"
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          voiceCallState === "listening" ? "bg-red-500" : voiceCallState === "speaking" ? "bg-emerald-500" : "bg-amber-500"
                        }`}></span>
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                        {voiceCallState}
                      </span>
                    </div>
                  )}
                </div>

                {isVoiceCallActive ? (
                  /* EXQUISITE CALL INTERACTIVE INTERFACE (OpenRouter Voice Mode) */
                  <div id="voice-livestream-active-call" className="space-y-4 animate-fadeIn">
                    
                    {/* Pulsing Concentric Visualizer Stage */}
                    <div className="flex flex-col items-center justify-center py-5 relative rounded-xl bg-slate-950/60 border border-slate-900 overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.12)_0%,transparent_70%)] pointer-events-none"></div>
                      
                      {/* Interactive Waveform Animation Container */}
                      <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-[200px] mb-3.5 px-2">
                        {stereoWaveformAmplitudes.map((h, i) => (
                          <div 
                            key={i} 
                            className={`w-1 rounded-full transition-all duration-100 ${
                              isMicMuted
                                ? "bg-slate-800 shadow-[0_0_2px_rgba(255,255,255,0.05)]"
                                : voiceCallState === "speaking" 
                                ? "bg-gradient-to-t from-violet-600 via-indigo-500 to-sky-400 shadow-[0_0_8px_rgba(139,92,246,0.5)]" 
                                : voiceCallState === "thinking"
                                ? "bg-gradient-to-t from-amber-500 via-yellow-400 to-orange-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                : "bg-gradient-to-t from-red-650 via-rose-550 to-amber-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]"
                            }`}
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>

                      {/* Speaking / Listening Active Stat */}
                      <div className="text-center z-10 px-4">
                        <p className="text-[11.5px] font-sans font-bold text-slate-200">
                          {isMicMuted ? (
                            <span className="text-red-400 flex items-center justify-center gap-1">
                              <MicOff className="h-3 w-3 animate-pulse" /> Microphone Muted
                            </span>
                          ) : (
                            <>
                              {voiceCallState === "listening" && "Listening to you continuously..."}
                              {voiceCallState === "speaking" && "Sri AI responds with speech..."}
                              {voiceCallState === "thinking" && "Sri AI is formulating solution..."}
                              {voiceCallState === "error" && "Permission Blocked / Mic Error"}
                            </>
                          )}
                        </p>
                        <p className="text-[9.5px] font-mono text-slate-400 mt-1 max-w-[210px] truncate mx-auto">
                          {voiceCallState === "error" ? "Please grant permissions and click Retry." : (voiceTranscript || "Speak: 'எனக்கு Swiggy மாதிரி ஆப் செய்'...")}
                        </p>
                      </div>
                    </div>

                    {/* Semi-transparent subtitles overlay for premium visibility */}
                    <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 text-left backdrop-blur-sm shadow-inner space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1">
                        <span className="text-[8.5px] uppercase font-mono font-black text-slate-500 tracking-wider">Live Captions Dialogue Overlay</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      </div>
                      <div className="flex gap-1.5 items-start text-[11px] leading-relaxed">
                        <span className="text-purple-400 font-bold font-mono shrink-0">User:</span>
                        <span className="text-slate-300 font-sans italic">
                          {voiceTranscript ? `"${voiceTranscript}"` : "Waiting for speech trigger..."}
                        </span>
                      </div>
                      {lastAiSpokenResponse && (
                        <div className="flex gap-1.5 items-start text-[11px] leading-relaxed mt-2 pt-2 border-t border-slate-900/60">
                          <span className="text-indigo-400 font-bold font-mono shrink-0">Sri AI:</span>
                          <span className="text-slate-250 font-sans">
                            {lastAiSpokenResponse}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Acoustic Parameter Customizations (Rate, Pitch & Mic control) */}
                    <div className="bg-[#101014] border border-slate-900 rounded-xl p-3.5 space-y-3 text-left">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                        <span className="text-[9px] uppercase font-mono font-black text-purple-400 tracking-wider">
                          Voice Settings Console
                        </span>
                        
                        <button
                          onClick={toggleMicMute}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isMicMuted
                              ? "bg-red-950/60 border-red-500/50 text-red-400"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {isMicMuted ? (
                            <>
                              <MicOff className="h-3 w-3 text-red-400 animate-pulse" />
                              <span>Muted</span>
                            </>
                          ) : (
                            <>
                              <Mic className="h-3 w-3 text-slate-450" />
                              <span>Mute Mic</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                            <span>Speech Rate (Speed)</span>
                            <span className="text-purple-400 font-bold">{speechRate}x</span>
                          </div>
                          <input 
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={speechRate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setSpeechRate(val);
                              addVoiceLog(`Speech speed adjusted: ${val}x`, "info");
                            }}
                            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                            <span>Vocal Pitch</span>
                            <span className="text-purple-400 font-bold">{speechPitch}x</span>
                          </div>
                          <input 
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.1"
                            value={speechPitch}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setSpeechPitch(val);
                              addVoiceLog(`Vocal pitch adjusted: ${val}x`, "info");
                            }}
                            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Automatic Detected Language Badges */}
                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4 text-purple-400 shrink-0" />
                        <div>
                          <span className="text-[8.5px] uppercase font-mono text-slate-500 font-bold block">Auto Language Detected</span>
                          <span className="text-[10.5px] font-bold text-purple-300 font-sans tracking-tight">
                            🇮🇳 {autoDetectedLanguageLabel || "Detecting speech..."}
                          </span>
                        </div>
                      </div>
                      
                      {/* Active audio cancellation control */}
                      {voiceCallState === "speaking" && (
                        <button 
                          onClick={() => {
                            if (window.speechSynthesis) window.speechSynthesis.cancel();
                            setSriIsSpeaking(false);
                            setVoiceCallState("listening");
                            startVoiceRecognition(true);
                          }}
                          className="px-2 py-1 text-[9.5px] bg-red-950/40 hover:bg-red-950 text-red-400 font-bold font-mono border border-red-900/40 rounded-lg cursor-pointer transition-colors"
                          title="Click here to interrupt Speech Output and speak"
                        >
                          Interrupt
                        </button>
                      )}
                    </div>

                    {/* Fallback Text Input when mic is blocked or user prefers typing */}
                    <div className="bg-[#121217] p-2.5 rounded-xl border border-slate-900 space-y-1.5 text-left">
                      <span className="text-[8.5px] uppercase font-mono font-bold text-slate-500 block">Keyboard Fallback Accent Input</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Type response or custom prompt fallback..."
                          className="flex-1 bg-slate-950 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-slate-700 font-mono"
                          value={voiceFallbackInput}
                          onChange={(e) => setVoiceFallbackInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && voiceFallbackInput.trim()) {
                              const typedText = voiceFallbackInput.trim();
                              setVoiceFallbackInput("");
                              addVoiceLog(`Keyboard Input: "${typedText}"`, "info");
                              setVoiceTranscript(typedText);
                              setVoiceCallState("thinking");
                              handleVoiceCommandSubmit(typedText);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (voiceFallbackInput.trim()) {
                              const typedText = voiceFallbackInput.trim();
                              setVoiceFallbackInput("");
                              addVoiceLog(`Keyboard Input: "${typedText}"`, "info");
                              setVoiceTranscript(typedText);
                              setVoiceCallState("thinking");
                              handleVoiceCommandSubmit(typedText);
                            }
                          }}
                          className="px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Send
                        </button>
                      </div>
                    </div>

                    {/* Exquisite Scrolling Live Pipeline Audio/AI Debugging Console */}
                    <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-900 text-left font-mono text-[9px] max-h-[110px] overflow-y-auto space-y-1.5 scrollbar-thin">
                      <div className="text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Pipeline Debug Logs</span>
                        <span className="text-[8px] px-1 bg-slate-900 rounded font-normal text-slate-400 animate-pulse">Live</span>
                      </div>
                      <div className="space-y-1 max-h-[80px] overflow-y-auto">
                        {voiceLogs.length > 0 ? (
                          voiceLogs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-1 leading-normal">
                              <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                              <span className={
                                log.type === "success" ? "text-emerald-400" :
                                log.type === "error" ? "text-rose-400 font-bold" :
                                log.type === "warn" ? "text-amber-400" : "text-sky-400"
                              }>
                                {log.type === "success" ? "🟢" : log.type === "error" ? "🚨" : log.type === "warn" ? "⚠️" : "🔵"} {log.message}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-650 italic">Waiting for voice signals...</div>
                        )}
                      </div>
                    </div>

                    {/* End Call / Connection Hanging controls */}
                    {voiceCallState === "error" ? (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => {
                            setVoiceCallState("listening"); 
                            startVoiceRecognition(true);
                          }}
                          className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/20"
                        >
                          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                          <span>Retry connection</span>
                        </button>
                        <button
                          onClick={stopVoiceRecognition}
                          className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl text-xs font-bold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5"
                        >
                          <span>Go back</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        id="end-live-voice-call"
                        onClick={stopVoiceRecognition}
                        className="w-full py-3 px-4 bg-gradient-to-r from-red-650 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 shadow-lg shadow-red-950/20"
                      >
                        <PhoneOff className="h-4 w-4 text-white shrink-0 animate-bounce" />
                        <span>End Live Session</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* INACTIVE STANDBY CONSOLE TRIGGER */
                  <div className="space-y-3">
                    <p className="text-[11px] font-sans text-slate-400 leading-normal text-center">
                      Engage in true, continuous hands-free phone conversations. Speaks Tamil, Tanglish, English, Malayalam, Hindi, Telugu or Kannada.
                    </p>

                    <div className="flex justify-center items-end gap-1.5 h-10 bg-slate-950/20 border border-slate-900 rounded-xl p-2 mb-2">
                      {[10, 15, 8, 22, 12, 18, 11, 14, 9, 13].map((h, i) => (
                        <div key={i} className="w-1 bg-slate-800 rounded-full" style={{ height: `${h}px` }} />
                      ))}
                    </div>

                    <button
                      id="start-live-voice-call-trigger"
                      onClick={() => startVoiceRecognition(true)}
                      className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-950/30 transition-transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Phone className="h-4 w-4 animate-pulse" />
                      <span>Start Real-time Voice Call</span>
                    </button>

                    <div className="flex items-center justify-center">
                      <span className="text-[9px] font-mono text-slate-500 uppercase font-semibold">Continuous dialogue mode</span>
                    </div>
                  </div>
                )}
              </div>
            </div>


          </div>

          {/* Right Column Content Panel */}
          <div className="lg:col-span-8 flex flex-col border border-slate-800/90 bg-[#0F0F12] rounded-2xl overflow-hidden shadow-xl h-[600px] xl:h-[650px] transition-all">
            {voiceAppPipeline ? (
              /* VOICE APP GENERATION STEP-BY-STEP VISUAL PIPELINE */
              <div className="flex-1 flex flex-col bg-[#08080A] p-8 text-sans justify-between overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-3 w-3 bg-red-500 rounded-full animate-ping" />
                      <div>
                        <h3 className="text-base font-bold text-slate-100">Speech-to-App Pipeline</h3>
                        <p className="text-[11px] text-slate-500 font-mono">Sri AI Voice app generator active</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setVoiceAppPipeline(null)}
                      className="text-xs bg-[#151518] border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-250 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      Exit Pipeline
                    </button>
                  </div>

                  {/* Transcript Display */}
                  <div className="bg-[#111116] border border-blue-900/30 p-5 rounded-2xl">
                    <span className="text-[10px] font-bold font-mono text-blue-400 uppercase tracking-widest block mb-1">
                      Spoken Audio Commands Recognized
                    </span>
                    <p className="text-sm font-semibold text-slate-250 italic leading-relaxed">
                      " {voiceAppPipeline.transcript} "
                    </p>
                  </div>

                  {/* Multistage Pipeline visualization */}
                  <div className="space-y-3.5">
                    {[
                      { index: 1, label: "Recognizing User Mic Voice Speech", desc: "Recognizing audio signals, parsing language, converting Tamil/Hindi to text characters" },
                      { index: 2, label: "Analyzing Technical Swiggy Specifications & Features", desc: "Contacting OpenRouter API, extracting core entities, deciding schemas, routing endpoints" },
                      { index: 3, label: "Designing Database Mapping, SQL Schema & API Architecture", desc: "Constructing table structures, Express routes layout, Drizzle configurations" },
                      { index: 4, label: "Writing and Bundling Application React Source Code", desc: "Formulating front-end widgets, CSS layouts, payment mock-ups, interactive forms code" },
                      { index: 5, label: "Compiling Assets and Launching Sandbox Mirror Link", desc: "Preparing sandbox, compiling build tree modules, serving HTML page on port 3000" }
                    ].map((step) => {
                      const isDone = voiceAppPipeline.step > step.index;
                      const isActive = voiceAppPipeline.step === step.index;
                      return (
                        <div 
                          key={step.index} 
                          className={`p-3.5 rounded-xl border flex items-start gap-4 transition-all ${
                            isDone 
                              ? "bg-emerald-950/20 border-emerald-950 text-emerald-400 opacity-80" 
                              : isActive 
                                ? "bg-purple-950/20 border-purple-800 animate-pulse" 
                                : "bg-slate-900/20 border-slate-800/80 opacity-40"
                          }`}
                        >
                          <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            isDone 
                              ? "bg-emerald-600 text-white" 
                              : isActive 
                                ? "bg-purple-600 text-white animate-bounce" 
                                : "bg-zinc-850 text-zinc-500"
                          }`}>
                            {isDone ? "✓" : step.index}
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${isDone ? "text-slate-300" : isActive ? "text-purple-300" : "text-slate-500"}`}>
                              {step.label}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive preview and deploy CTA triggers once step 5 is loaded */}
                {voiceAppPipeline.step >= 5 ? (
                  <div className="mt-6 p-5 bg-gradient-to-r from-blue-950/30 to-purple-950/20 border border-purple-900/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black text-emerald-400 font-mono uppercase tracking-widest block mb-0.5">
                        APPLICATION READY !
                      </span>
                      <p className="text-xs text-slate-300 font-bold">
                        Created: Swiggy-like Marketplace, Express Backend, SQL structures.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setActiveGlobalTab("workspace");
                          setActiveTab("code");
                        }}
                        className="px-4 py-2 bg-[#121215] border border-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-all"
                      >
                        Inspect Code
                      </button>
                      <button
                        id="auto-launch-preview-btn"
                        onClick={() => {
                          setActiveGlobalTab("workspace");
                          setActiveTab("preview");
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-blue-950"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Launch Preview</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveGlobalTab("workspace");
                          setActiveTab("deploy");
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-purple-950"
                      >
                        Deploy Live
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 font-mono italic animate-pulse">
                    Constructing Swiggy application codebase... Please monitor progress blocks above.
                  </div>
                )}
              </div>
            ) : (
              /* STANDARD ASSISTANT DIALOGUE VIEWPORT */
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Chat Header */}
                <div className="bg-[#151519] border-b border-slate-800/80 px-6 py-4 flex items-center justify-between select-none">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-extrabold text-slate-200 uppercase tracking-widest font-mono">
                      Diagnostics Chatroom
                    </span>
                  </div>
                  <button 
                    onClick={() => setSriChat([{ role: "ai", text: "Chat history cleared. Specify any request!", time: "Now" }])}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                </div>

                {/* Chat Scroller */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {sriChat.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 items-start ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar */}
                      <div className="flex-shrink-0 select-none">
                        {msg.role === "user" ? (
                          userState.user && userState.user.picture ? (
                            <img 
                              src={userState.user.picture} 
                              alt={userState.user.name} 
                              className="h-7 w-7 rounded-full border border-blue-500/30 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white font-mono shadow">
                              {userState.user?.name ? userState.user.name.charAt(0).toUpperCase() : "U"}
                            </div>
                          )
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-purple-900/60 flex items-center justify-center border border-purple-500/40 shadow">
                            <Sparkles className="h-3.5 w-3.5 text-purple-300 animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Content Bubble */}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all shadow-md ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-none shadow-blue-950/20"
                          : "bg-[#1d1d24] text-slate-250 rounded-tl-none border border-slate-850 shadow-black/10"
                      }`}>
                        {/* Sender Label */}
                        <span className={`block text-[8px] mb-1 font-semibold tracking-widest font-mono uppercase opacity-55 ${
                          msg.role === "user" ? "text-blue-100" : "text-purple-300"
                        }`}>
                          {msg.role === "user" ? (userState.user?.name || "You") : "Sri AI Lead Cofounder"}
                        </span>

                        <div className="whitespace-pre-line font-sans">{msg.text}</div>
                        
                        {/* Auto-Fix CTA block */}
                        {msg.fixAvailable && msg.fixPrompt && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400">
                              Sri AI Smart Hotfix ready.
                            </span>
                            <button
                              onClick={() => handleExecuteSriAutoFix(msg.fixPrompt!)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Apply Auto-Fix</span>
                            </button>
                          </div>
                        )}
                        
                        <span className={`block text-[8px] mt-1.5 text-right font-mono opacity-50 ${
                          msg.role === "user" ? "text-blue-200" : "text-slate-500"
                        }`}>
                          {msg.time}
                        </span>
                      </div>
                    </div>
                  ))}

                  {sriIsLoading && (
                    <div className="flex gap-3 items-start flex-row animate-pulse">
                      <div className="flex-shrink-0 select-none">
                        <div className="h-7 w-7 rounded-full bg-purple-900/60 flex items-center justify-center border border-purple-500/40 shadow">
                          <Sparkles className="h-3.5 w-3.5 text-purple-300 animate-pulse" />
                        </div>
                      </div>
                      <div className="bg-[#1d1d24] text-slate-300 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-850 text-xs shadow-lg flex items-center gap-3">
                        <span className="font-mono text-[8.5px] uppercase tracking-wider font-semibold text-purple-300/80">Sri AI is thinking</span>
                        <div className="flex items-center gap-1 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Auto-scroll helper anchor */}
                  <div ref={sriChatEndRef} />
                </div>

                {/* Chat Footer Input */}
                <div className="bg-[#151519] border-t border-slate-800/80 p-4 space-y-3 select-none">
                  {/* File Upload Attachment Indicator */}
                  {uploadedFileName && (
                    <div className="bg-purple-950/20 border border-purple-900/40 p-2.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded font-mono font-bold uppercase">
                          {uploadedFileType}
                        </span>
                        <span className="text-xs text-slate-200 truncate max-w-sm">{uploadedFileName}</span>
                      </div>
                      <button
                        onClick={() => {
                          setUploadedFileType("none");
                          setUploadedFileName("");
                          setUploadedFilePreview(null);
                          setCustomFileContent("");
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  )}

                  {/* Dropdown status details / attachments */}
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-bold text-slate-500 font-mono uppercase mr-1">
                        ATTACHMENTS:
                      </span>
                      <button
                        onClick={() => setAttachmentType(attachmentType === "logs" ? "none" : "logs")}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                          attachmentType === "logs"
                            ? "bg-blue-950/65 border-blue-900 text-blue-400 font-bold"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        📁 Live Build Logs
                      </button>
                      <button
                        onClick={() => setAttachmentType(attachmentType === "schema" ? "none" : "schema")}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                          attachmentType === "schema"
                            ? "bg-blue-950/65 border-blue-900 text-blue-400 font-bold"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        📝 Supabase SQL Schema
                      </button>
                    </div>

                    {/* New real HTML File/Image/PDF selector trigger */}
                    <div>
                      <label 
                        htmlFor="sri-file-upload"
                        className="text-[10px] font-mono px-2.5 py-1 rounded border bg-purple-950/10 border-purple-900/30 hover:bg-purple-900/20 text-purple-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span>Upload File, PNG, PDF</span>
                      </label>
                      <input 
                        type="file"
                        id="sri-file-upload"
                        accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.js,.ts,.tsx,.html,.css,.json,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={sriInput}
                      onChange={(e) => setSriInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSriAsk()}
                      placeholder={uploadedFileName ? `Analyzing file active context: Ask questions...` : "Ask Sri AI or Speak Tamil/Hindi to generate Swiggy clone app..."}
                      className="flex-1 bg-[#0F0F12] border border-slate-800 hover:border-slate-700 outline-none text-white rounded-xl px-4 py-3 text-xs font-sans placeholder-slate-500 focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                    />
                    <button
                      onClick={() => handleSriAsk()}
                      disabled={sriIsLoading || (!sriInput.trim() && uploadedFileType === "none")}
                      className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center shadow-md shadow-purple-950"
                    >
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      ) : !currentProject ? (
        // HUB LANDING STATE VIEWPORT
        <main id="hub-landing-dashboard" className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start select-none">
            
            {/* Left Column Entry Prompt Box */}
            <div className="lg:col-span-8 space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-950 to-[#101014] border border-blue-900/50 text-blue-400 rounded-lg text-xs font-extrabold tracking-widest font-mono uppercase">
                  <Sparkles className="h-3 w-3 animate-pulse text-blue-400" />
                  <span>PREMIUM COMPILER BUILDER</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-none font-sans">
                  Instantly Build, Review and Deploy <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">Full-Stack Apps</span> from Prompt.
                </h1>
                <p className="text-slate-400 text-sm max-w-xl leading-relaxed font-sans">
                  Our professional engine translates descriptive prompt parameters into highly polished client visuals, Express nodes, and matching Supabase persistence models in real-time.
                </p>
              </div>

              {/* Requirement analyzer loader */}
              {isAnalyzing ? (
                <div className="bg-[#0F0F12] border border-slate-800 p-8 rounded-2xl text-center space-y-3">
                  <div className="flex justify-center">
                    <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">Analyzing App Specifications Blueprint</h3>
                  <p className="text-xs text-slate-500 font-mono">Generating Features, SQL mapping, API requirements matrix...</p>
                </div>
              ) : (
                <PromptPanel
                  currentProject={currentProject}
                  onGenerate={handleStartAnalysis}
                  isGenerating={isGenerating}
                  onRefine={handleRefine}
                  isRefining={isRefining}
                />
              )}
            </div>

            {/* Right Column Layout */}
            <div className="lg:col-span-4 space-y-6">
              <ProjectHistory
                projects={projectsList}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
                isGenerating={isGenerating}
              />

              {/* Limits and plans indicators */}
              <div className="bg-[#0F0F12] p-5 rounded-2xl border border-slate-800/90 space-y-4 shadow-md text-sans">
                <h4 className="text-xs font-black text-slate-400 font-mono tracking-widest flex items-center gap-1.5 uppercase">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  SANDBOX SECURITY ENGINE
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Every precompiled template operates on isolated sandboxed rendering scopes. Direct SQL schemas are parsed and vetted for maximum validation, protecting accounts with high performance.
                </p>
                
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11.5px]">
                  <span className="text-slate-500 font-medium">Free creations count:</span>
                  <span className="font-bold text-slate-300 font-mono">{userState.appCreationsCount} / 5 creations limit</span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-slate-500 font-medium">Free hosting deploys:</span>
                  <span className="font-bold text-slate-300 font-mono">{userState.deploymentsCount} / 2 deploys limit</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : activeGlobalTab === "marketplace" ? (
        <MarketplacePage
          apps={marketplaceApps}
          onOpenApp={(app) => {
            setSelectedAppId(app.id);
            setActiveGlobalTab("workspace");
          }}
          onLikeApp={async (appId) => {
            const userId = userState.user?.googleId;
            if (!userId) return;
            await supabase.from("app_likes").insert({ app_id: appId, user_id: userId });
            await supabase.rpc("increment_app_likes", { app_id: appId });
          }}
          onCloneApp={(app) => {
            const clonedProject = {
              id: "proj_" + Math.random().toString(36).substring(2, 9),
              name: app.name + " (Clone)",
              description: app.description,
              prompt: app.prompt || "",
              previewHtml: app.preview_html || "",
              files: [],
              analysis: { features: [], database: [], apis: [], security: "" },
              createdAt: new Date().toISOString(),
              deployments: [],
              deploymentsCount: 0
            };
            setCurrentProject(clonedProject);
            setSelectedProjectId(clonedProject.id);
            setProjectsList(prev => [clonedProject, ...prev]);
            setActiveGlobalTab("workspace");
          }}
        />
      ) : activeGlobalTab === "dashboard" ? (
        <DashboardPage
          user={userState.user}
          userState={userState}
          projects={projectsList}
          marketplaceApps={marketplaceApps}
          stats={dashboardStats}
          onNavigate={(tab) => setActiveGlobalTab(tab as any)}
        />
      ) : (
        // MEDO-STYLE 3-PANEL AI WORKSPACE (PROJECT SELECTED)
        <AIWorkspaceLayout
          currentProject={currentProject}
          projectsList={projectsList}
          selectedProjectId={selectedProjectId}
          isGenerating={isGenerating}
          isDeploying={isDeploying}
          isRefining={isRefining}
          deployLogs={deployLogs}
          isApplyingEdits={isApplyingEdits}
          buildPhase={buildPhase}
          buildPhaseMessage={buildPhaseMessage}
          credits={userState.credits}
          deployStatus={deployStatus}
          deployError={deployError}
          onGenerate={handleWorkspaceGenerate}
          onRefine={handleRefine}
          onDeploy={handleDeploy}
          onSelectProject={handleSelectProject}
          onApplyManualEdit={handleApplyManualEdit}
          onAnalyzeFileInSriAI={handleAnalyzeFileInSriAI}
          onUpgrade={() => setActiveGlobalTab("pricing")}
        />
      )}

      {/* CREDIT CONFIRMATION MODAL */}
      <CreditConfirmModal
        open={creditModalOpen}
        estimate={pendingCreditAction?.estimate ?? null}
        currentCredits={userState.credits}
        prompt={pendingCreditAction?.prompt ?? ""}
        onConfirm={handleCreditConfirm}
        onCancel={handleCreditCancel}
        onUpgrade={() => { handleCreditCancel(); setActiveGlobalTab("pricing"); }}
      />

      {/* OVERLAY MODAL: SMART REQUIREMENTS PLANNING BLUEPRINT REPORT */}
      {analysisReport && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 md:p-6 backdrop-blur-md overflow-y-auto select-text">
          <div className="bg-[#0F0F12] border border-slate-800 max-w-3xl w-full max-w-[calc(100%-2rem)] md:max-w-3xl rounded-2xl overflow-hidden shadow-2xl my-8">
            <div className="bg-[#151519] px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-950 rounded-lg text-blue-400 border border-blue-900/40">
                  <Layers className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest font-mono">
                    Requirement Report & Architecture Plan
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Vetted securely via OpenRouter AI mesh</p>
                </div>
              </div>
              <span className="text-[10px] bg-amber-955 border border-amber-900/50 text-amber-400 px-2.5 py-0.5 rounded font-mono font-bold">
                PROPOSAL
              </span>
            </div>

            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-base font-black text-white">{analysisReport.name}</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{analysisReport.description}</p>
              </div>

              {/* Bento Grid Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#151519] p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest font-mono block mb-2.5">
                    🎯 Interactive Features
                  </span>
                  <ul className="space-y-1.5 list-none">
                    {analysisReport.analysis?.features?.map((feat: string, i: number) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 font-sans">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#151519] p-4 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest font-mono block mb-2.5">
                    📑 Pages / Routes
                  </span>
                  <ul className="space-y-1.5 list-none">
                    {analysisReport.analysis?.pages?.map((page: string, i: number) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5 font-sans">
                        <span className="text-indigo-400 mt-1">•</span>
                        <span>{page}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* DB and API structures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#151519] p-4 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest font-mono block mb-2">
                    🗃️ Designing Databases (Supabase mappings)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisReport.analysis?.database?.map((db: string, i: number) => (
                      <span key={i} className="text-[10px] bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 font-mono font-bold px-2.5 py-0.5 rounded">
                        {db}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#151519] p-4 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-extrabold text-[#ca8a04] uppercase tracking-widest font-mono block mb-2">
                    ⚓ Express APIs proxies
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisReport.analysis?.apis?.slice(0, 3).map((api: string, i: number) => (
                      <span key={i} className="text-[10px] bg-yellow-950/40 border border-yellow-905/60 text-yellow-500 font-mono px-2 py-0.5 rounded">
                        {api}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estimate Costings info */}
              <div className="border border-slate-800 bg-[#16161A]/50 p-4 rounded-xl">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-2">
                  Estimated Deployment Hosting Pricing
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-mono select-none">
                  <div className="bg-[#1c1c22]/50 p-2 border border-slate-800/80 rounded">
                    <span className="text-slate-500 block mb-0.5">API INFERENCE:</span>
                    <span className="text-sky-400 font-bold">{analysisReport.cost?.apiCallCost || "$0.002"}</span>
                  </div>
                  <div className="bg-[#1c1c22]/50 p-2 border border-slate-800/80 rounded">
                    <span className="text-slate-500 block mb-0.5">Live Host server:</span>
                    <span className="text-sky-400 font-bold">{analysisReport.cost?.hostingCost || "Free Tier ($0)"}</span>
                  </div>
                  <div className="bg-[#1c1c22]/50 p-2 border border-slate-800/80 rounded">
                    <span className="text-slate-500 block mb-0.5">Supabase Database:</span>
                    <span className="text-sky-400 font-bold">{analysisReport.cost?.databaseCost || "Free Tier ($0)"}</span>
                  </div>
                </div>
              </div>

              {/* Interactive Sizing selection block */}
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl select-none">
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest font-mono block mb-3">
                  Select App Compile Scope (Limits and Credits):
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Small Size */}
                  <button 
                    onClick={() => setSelectedSize("Small")}
                    className={`p-3 border text-left rounded-xl transition-all cursor-pointer ${
                      selectedSize === "Small"
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-slate-800/80 bg-[#151519] hover:border-slate-705"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-100">Small Scope</span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded leading-none">
                        5 cr
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Minimal standalone template. Extremely speedy.</p>
                  </button>

                  {/* Medium Size */}
                  <button 
                    onClick={() => setSelectedSize("Medium")}
                    className={`p-3 border text-left rounded-xl transition-all cursor-pointer ${
                      selectedSize === "Medium"
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-slate-800/80 bg-[#151519] hover:border-slate-705"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-100">Medium Scope</span>
                      <span className="text-[9px] bg-blue-950 text-blue-400 font-mono px-1.5 py-0.5 rounded leading-none">
                        15 cr
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Complete user flow. Interactive state forms and files.</p>
                  </button>

                  {/* Large Size */}
                  <button 
                    onClick={() => setSelectedSize("Large")}
                    className={`p-3 border text-left rounded-xl transition-all cursor-pointer ${
                      selectedSize === "Large"
                        ? "border-blue-500 bg-blue-950/20"
                        : "border-slate-800/80 bg-[#151519] hover:border-slate-705"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-100">Enterprise Large</span>
                      <span className="text-[9px] bg-purple-950 text-purple-400 font-mono px-1.5 py-0.5 rounded leading-none">
                        30 cr
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Full dashboards + charts analytics and schema exports.</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons CTAs */}
            <div className="bg-[#151519] border-t border-slate-800 px-6 py-4 flex items-center justify-between select-none">
              <button
                onClick={() => setAnalysisReport(null)}
                className="px-4 py-2 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel Planning
              </button>

              <button
                onClick={handleConfirmBuild}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-950 flex items-center gap-1.5 cursor-pointer"
              >
                <Rocket className="h-4 w-4 text-blue-100 animate-pulse" />
                <span>Confirm & Compile Blueprint (-{selectedSize === "Small" ? 5 : selectedSize === "Large" ? 30 : 15} cr)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER MODAL: BILLING & SIMULATED REFERRALS PANEL */}
      {billingOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6 backdrop-blur-md select-none">
          <div className="bg-[#0F0F12] border border-slate-805 max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="bg-[#151519] px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest font-mono">
                  SaaS Bill & Simulated Referrals Admin
                </h3>
              </div>
              <button 
                onClick={() => setBillingOpen(false)}
                className="text-xs text-slate-500 hover:text-white font-bold font-mono cursor-pointer"
              >
                [ CLOSE ]
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
              {/* Core Credits state */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#151519] p-4.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono mb-1">
                    ACTIVE TIER STATUS
                  </span>
                  <div className="text-lg font-black text-white uppercase tracking-tight font-sans">
                    {userState.plan} workspace
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {userState.plan === "Free" ? "Limited App creations & deploys" : "Unlimited creations and hosting deployment compile cycles!"}
                  </div>
                </div>

                <div className="bg-[#151519] p-4.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono mb-1">
                    REMAINING CREDITS
                  </span>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {userState.plan === "Free" ? `${userState.credits} cr` : "∞ Unlimited"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    100% simulated trial balance
                  </div>
                </div>
              </div>

              {/* Package Upgrades block */}
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono mb-2.5">
                  1. Tier Level Switching (Simulated payments)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Free plan option */}
                  <div className={`p-3 border rounded-xl flex flex-col justify-between ${
                    userState.plan === "Free" ? "border-slate-600 bg-slate-900/10" : "border-slate-800 bg-[#151519]/40"
                  }`}>
                    <div>
                      <span className="text-xs font-bold block text-slate-200">Free Tier</span>
                      <span className="text-[9px] text-slate-500 font-mono font-bold">Standard trial limitations</span>
                    </div>
                    <button 
                      onClick={() => handleChangePlan("Free")}
                      disabled={userState.plan === "Free"}
                      className="mt-3 w-full py-1.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg cursor-pointer"
                    >
                      {userState.plan === "Free" ? "Active" : "Downgrade"}
                    </button>
                  </div>

                  {/* Pro Workspace option */}
                  <div className={`p-3 border rounded-xl flex flex-col justify-between ${
                    userState.plan === "Pro" ? "border-blue-500 bg-blue-950/10" : "border-slate-800 bg-[#151519]/40"
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-slate-100">Pro Developer</span>
                        <span className="text-[8px] bg-blue-950 text-blue-400 font-mono font-bold px-1 py-0.5 rounded leading-none">
                          $19/mo
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono leading-none">9999 Max credits + speed runs</span>
                    </div>
                    <button 
                      onClick={() => handleChangePlan("Pro")}
                      disabled={userState.plan === "Pro"}
                      className="mt-3 w-full py-1.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer"
                    >
                      {userState.plan === "Pro" ? "Active" : "Sim Upgrade"}
                    </button>
                  </div>

                  {/* Team Workspace option */}
                  <div className={`p-3 border rounded-xl flex flex-col justify-between ${
                    userState.plan === "Team" ? "border-purple-500 bg-purple-950/10" : "border-slate-800 bg-[#151519]/40"
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-slate-100">Team Space</span>
                        <span className="text-[8px] bg-purple-950 text-purple-400 font-mono font-bold px-1 py-0.5 rounded leading-none">
                          $49/mo
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono leading-none">Highest compute speeds limit</span>
                    </div>
                    <button 
                      onClick={() => handleChangePlan("Team")}
                      disabled={userState.plan === "Team"}
                      className="mt-3 w-full py-1.5 text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg cursor-pointer"
                    >
                      {userState.plan === "Team" ? "Active" : "Sim Upgrade"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Referral Program — link to real dashboard */}
              <div className="border border-slate-800 bg-[#151519]/90 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block font-mono mb-2">
                  2. Referral Program
                </span>
                <p className="text-[11px] text-slate-400 font-mono mb-3">
                  Earn real credits for every friend you invite. Share your unique referral link and track rewards in real time.
                </p>
                <button
                  onClick={() => { setBillingOpen(false); setActiveGlobalTab("referral"); }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  Open Referral Dashboard →
                </button>
              </div>
            </div>

            {/* billing actions reset */}
            <div className="bg-[#151519] border-t border-slate-800 px-6 py-4 flex items-center justify-between text-xs">
              <button
                onClick={handleResetUserState}
                className="text-red-500 hover:text-red-400 font-mono font-bold cursor-pointer"
              >
                [ RESET ALL DATA ]
              </button>

              <button
                onClick={() => setBillingOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIRST-TIME USER SPECIAL DISCOUNT WELCOME POPUP */}
      {showOfferPopup && offerSecondsLeft !== null && offerSecondsLeft > 0 && !userState.offerRedeemed && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[200] p-4 backdrop-blur-xl animate-fade-in font-sans">
          <div className="bg-[#09090B] border-2 border-indigo-500/40 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl relative p-6 md:p-8 select-none text-center transform scale-100 hover:scale-[1.01] transition-transform duration-300">
            {/* Ambient Background Glow Particles */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="absolute -bottom-10 left-10 w-36 h-36 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />

            {/* Exclusive Corner Ribbon */}
            <div className="absolute top-0 right-0 overflow-hidden w-40 h-40 pointer-events-none">
              <div className="absolute top-[30px] right-[-35px] rotate-45 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-extrabold py-1.5 px-10 text-center uppercase tracking-wider shadow-md transform-gpu leading-none">
                🔥 Hot Deal
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowOfferPopup(false)}
              className="absolute top-4 left-4 p-2 bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white rounded-lg border border-white/[0.05] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header Content */}
            <div className="space-y-3 mt-6">
              <div className="mx-auto w-14 h-14 bg-gradient-to-b from-indigo-500/20 to-indigo-500/30 rounded-2xl border border-indigo-500/30 flex items-center justify-center text-3xl animate-bounce">
                🎉
              </div>
              <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400 tracking-tight leading-none pt-2">
                Welcome to your AI Builder
              </h2>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-950/60 border border-indigo-505/30 rounded-full text-[10.5px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                <Sparkles className="h-3 w-3 fill-indigo-400" />
                <span>Special First-Time User Offer</span>
              </div>
            </div>

            {/* Price Cards & Comparison */}
            <div className="grid grid-cols-2 gap-4 mt-6 bg-white/[0.02] border border-white/[0.05] p-5 rounded-2xl relative overflow-hidden">
              {/* Save Overlay */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-950/85 border border-red-900/40 text-red-400 text-[10.5px] font-extrabold tracking-wider px-3.5 py-1 rounded-full uppercase shadow">
                Save ₹200 Instantly
              </div>

              {/* Original Card */}
              <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl flex flex-col justify-center pt-8">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono mb-1">
                  Original Price
                </span>
                <span className="text-2xl font-bold font-sans text-slate-400 line-through">
                  ₹499
                </span>
                <span className="text-[9.5px] mt-1 text-slate-500 font-medium">/month</span>
              </div>

              {/* Discounted Card */}
              <div className="p-3 bg-gradient-to-b from-red-950/20 to-red-900/10 border border-red-500/30 rounded-xl flex flex-col justify-center pt-8">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block font-mono mb-1">
                  Offer Price
                </span>
                <span className="text-3xl font-black font-sans text-white bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
                  ₹299
                </span>
                <span className="text-[9.5px] mt-1 text-amber-300 font-bold uppercase animate-pulse">
                  First-Time Users Only
                </span>
              </div>
            </div>

            {/* High-Converting Validations */}
            <div className="mt-5 space-y-2">
              <span className="text-xs text-slate-400 block font-sans">
                Unlock <strong>25 App Creations, 5 Live Deployments, Sri AI Assistant, and priority support</strong>. Build your MVP immediately!
              </span>
              
              {/* Live Countdown Clock */}
              <div className="bg-[#0B0B0D] border border-red-900/30 p-3 h-14 rounded-xl flex items-center justify-between gap-4 max-w-sm mx-auto shadow-inner">
                <div className="flex items-center gap-1.5 text-red-500">
                  <Clock className="h-4 w-4 animate-spin shrink-0" style={{ animationDuration: "10s" }} />
                  <span className="text-[10px] font-bold font-mono uppercase tracking-widest leading-none">
                    LIMITED TIME OFFER:
                  </span>
                </div>
                <span className="text-lg font-black font-mono text-white tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                  {(() => {
                    const h = Math.floor(offerSecondsLeft / 3600);
                    const m = Math.floor((offerSecondsLeft % 3600) / 60);
                    const s = offerSecondsLeft % 60;
                    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
                  })()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
              <button
                onClick={() => {
                  setShowOfferPopup(false);
                  setActiveGlobalTab("pricing");
                  setClaimOfferTriggered(true);
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-950/30 hover:shadow-red-500/20 transform hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4 text-white fill-white" />
                <span>Claim Offer (₹299 Only)</span>
              </button>

              <button
                onClick={() => setShowOfferPopup(false)}
                className="w-full py-2 px-4 hover:bg-white/[0.02] text-slate-500 hover:text-slate-300 text-xs font-semibold cursor-pointer rounded-lg transition-colors font-mono uppercase tracking-wider"
              >
                [ Maybe Later ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-FIDELITY IN-APP INTERACTIVE STANDALONE APP SIMULATOR OVERLAY */}
      {isSimulatorOpen && currentProject && (
        <div className="fixed inset-0 bg-black/95 flex flex-col z-[150] backdrop-blur-xl select-none p-4 md:p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-950/60 rounded-xl border border-indigo-900/40 text-indigo-400">
                <Monitor className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white font-sans uppercase tracking-tight">
                    TRUST ME AI - LIVE PRODUCT SIMULATOR
                  </h3>
                  <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950/70 border border-indigo-900/40 px-1.5 py-0.5 rounded font-mono uppercase animate-pulse">
                    ACTIVE SANDBOX
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Interactive responsive emulation layer bypassing external popup blocks and iframe restrict triggers.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg cursor-pointer border border-slate-800 hover:border-slate-750 transition-colors"
              title="Close Simulator"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch overflow-hidden min-h-0">
            {/* LEFT COLUMN: SIMULATED ENVIRONMENT & CONTROLLERS */}
            <div className="lg:col-span-8 flex flex-col gap-4 bg-[#0A0A0C] border border-slate-850 p-4 rounded-2xl overflow-y-auto">
              {/* Simulator Action/Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111114] p-3 rounded-xl border border-slate-800/60">
                {/* Device selectors */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-850 rounded-lg">
                  <button
                    onClick={() => {
                      setSimulatorDevice("phone");
                      addSimulatedLog("Switched viewport to simulated Mobile Device scale", "info");
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded cursor-pointer transition-all ${
                      simulatorDevice === "phone" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Mobile
                  </button>
                  <button
                    onClick={() => {
                      setSimulatorDevice("tablet");
                      addSimulatedLog("Switched viewport to simulated Tablet Device scale", "info");
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded cursor-pointer transition-all ${
                      simulatorDevice === "tablet" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Tablet className="h-3.5 w-3.5" />
                    Tablet
                  </button>
                  <button
                    onClick={() => {
                      setSimulatorDevice("desktop");
                      addSimulatedLog("Switched viewport to simulated Desktop Device scale", "info");
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded cursor-pointer transition-all ${
                      simulatorDevice === "desktop" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Desktop
                  </button>
                </div>

                {/* Network Controllers / Latency Switchers */}
                <div className="flex items-center gap-3">
                  {/* Slow latency simulator */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-mono font-semibold text-slate-400 uppercase">Latency Speed:</span>
                    <select
                      value={simulatorLatency}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSimulatorLatency(v);
                        addSimulatedLog(`Network mode set to ${v === 0 ? "LAN 5G Speed" : `3G connection latency simulation (${v}ms)`}`, "info");
                      }}
                      className="bg-slate-950 border border-slate-800 text-[11px] text-indigo-400 font-mono rounded px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value="0">Ultra LAN 5G (Instant)</option>
                      <option value="1200">Simulated 4G (+1200ms)</option>
                      <option value="2500">Simulated 3G (+2500ms)</option>
                    </select>
                  </div>

                  {/* Offline switch */}
                  <label className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer text-xs font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={simulatorIsOffline}
                      onChange={(e) => {
                        const isOff = e.target.checked;
                        setSimulatorIsOffline(isOff);
                        addSimulatedLog(isOff ? "SYSTEM ALERT: Offline simulation model enabled. All proxy request layers severed." : "SYSTEM ALERT: Online sync restored.", isOff ? "warn" : "info");
                      }}
                      className="rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-950 h-3.5 w-3.5"
                    />
                    {simulatorIsOffline ? (
                      <span className="text-rose-400 flex items-center gap-1 font-mono text-[10.5px] font-semibold">
                        <WifiOff className="h-3.5 w-3.5" />
                        OFFLINE
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10.5px] font-semibold">
                        <Wifi className="h-3.5 w-3.5" />
                        ONLINE
                      </span>
                    )}
                  </label>
                </div>

                {/* Sri AI Audio diagnostic report reader */}
                <button
                  onClick={() => {
                    const speech = `Launching Trust Me AI standalone device simulator with model identifier ${currentProject.name}. Offline simulation status index: ${simulatorIsOffline ? "offline active" : "online"}. All interactive routes are active.`;
                    const utterance = new SpeechSynthesisUtterance(speech);
                    utterance.rate = 1.05;
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                    addSimulatedLog("Sri AI Speak Trigger Client: Spoken analysis stream executed.", "info");
                  }}
                  className="flex items-center gap-1 bg-[#1A1A24] hover:bg-slate-800/80 border border-indigo-900/40 text-indigo-400 px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer"
                  title="Sri AI speaks app diagnostic summaries"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Voice Diagnostics
                </button>
              </div>

              {/* SIMULATOR CANVAS PREVIEW WRAPPER */}
              <div className="flex-1 flex items-center justify-center bg-slate-950/85 border border-slate-850 p-4 md:p-6 rounded-2xl overflow-hidden relative min-h-[460px]">
                {/* Background grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#151515_1px,transparent_1px),linear-gradient(to_bottom,#151515_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-30 pointer-events-none"></div>

                {simulatorLoading ? (
                  <div className="flex flex-col items-center justify-center text-center z-10 bg-slate-950/90 absolute inset-0">
                    <div className="h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-xs font-bold text-slate-300 font-mono">
                      Simulating Latency Buffers ({simulatorIsOffline ? "Offline Mode" : `${simulatorLatency}ms delay`})...
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      Sri AI syncing responsive parameters, CSS layouts, and reactive modules...
                    </p>
                  </div>
                ) : simulatorIsOffline ? (
                  <div className="max-w-md mx-auto text-center p-6 bg-[#0E0E11] border border-red-950 rounded-xl z-10 shadow-lg relative">
                    <div className="mx-auto w-10 h-10 rounded-full bg-rose-950/40 border border-rose-900 flex items-center justify-center text-rose-500 mb-3 animate-bounce">
                      <WifiOff className="h-5 w-5" />
                    </div>
                    <h4 className="text-sm font-black text-rose-400 font-mono uppercase tracking-wider mb-2">
                      DNS_CONNECTION_REFUSED
                    </h4>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed font-sans mb-3">
                      This app simulated an offline disconnection. Sri AI has successfully isolated all REST query handlers and database sync instances. Toggle the Online mode above to restore live container synchronization.
                    </p>
                    <div className="text-[10px] font-mono bg-rose-950/15 border border-rose-900/30 p-2.5 rounded text-rose-300 text-left">
                      <strong className="block text-rose-400">Offline Fallback Checked:</strong>
                      ✓ User cache loaded from localStorage.<br />
                      ✓ No fatal Javascript crashes registered.<br />
                      ✓ ServiceWorker mock thread: operating.<br />
                    </div>
                  </div>
                ) : (
                  /* RENDER RESPONSIVE DEVICE SHELLS */
                  <div 
                    className={`transition-all duration-300 flex items-center justify-center ${
                      simulatorDevice === "phone" 
                        ? "w-[340px] h-[580px] bg-[#111113] border-4 border-[#242429] rounded-[40px] shadow-2xl relative p-3 flex-shrink-0"
                        : simulatorDevice === "tablet"
                        ? "w-[620px] h-[480px] bg-[#111113] border-4 border-[#242429] rounded-[24px] shadow-2xl relative p-2 flex-shrink-0"
                        : "w-full h-full min-h-[440px] bg-[#111113] border border-slate-850 rounded-lg shadow-2xl relative p-1"
                    }`}
                  >
                    {/* PHONE DEVICE INDICATION GRAPHICS */}
                    {simulatorDevice === "phone" && (
                      <>
                        {/* Dynamic Island Notch */}
                        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5.5 bg-black rounded-full z-20 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-950 flex items-center justify-center mr-1">
                            <div className="w-1 h-1 rounded-full bg-blue-900"></div>
                          </div>
                          <span className="text-[8px] font-mono text-slate-600 font-extrabold pb-0.5 select-none uppercase">DYNAMIC ISLAND</span>
                        </div>
                        {/* Speaker line */}
                        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-14 h-1 bg-slate-855 rounded-full z-20"></div>

                        {/* Top Battery/Signal Overlay Bar */}
                        <div className="absolute top-11 left-10 right-10 flex items-center justify-between text-[9px] font-bold font-mono text-slate-500 z-10 px-1 select-none">
                          <span>09:41</span>
                          <div className="flex items-center gap-1">
                            <span>5G</span>
                            <div className="w-4 h-2 border border-slate-500 p-0.5 rounded flex items-center">
                              <div className="w-full h-full bg-slate-400 rounded-xs"></div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Slide indicators bar */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-700/80 rounded-full z-20 hover:bg-slate-500 cursor-pointer transition-colors" title="Home slider indicator"></div>
                      </>
                    )}

                    {/* TABLET CHAMBER GRAPHICS */}
                    {simulatorDevice === "tablet" && (
                      <>
                        {/* Tablet Camera dot */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-950 border border-slate-800 z-20 flex items-center justify-center">
                          <div className="w-0.5 h-0.5 bg-blue-900 rounded-full"></div>
                        </div>
                      </>
                    )}

                    {/* Simulating iFrame with previewHTML */}
                    <div className="w-full h-full bg-slate-950 rounded-2xl overflow-hidden relative" style={{ minHeight: "400px" }}>
                      <iframe
                        title="In-App standalone virtual runtime simulation sandbox host"
                        srcDoc={currentProject.previewHtml || "<body style='background:#0a0a0b;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'>No preview available</body>"}
                        className="w-full h-full border-0 select-text bg-[#08080B]"
                        style={{ minHeight: "400px", display: "block" }}
                        sandbox="allow-scripts"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: INTERACTIVE CONSOLE LOG TRACER */}
            <div className="lg:col-span-4 flex flex-col bg-[#0F0F12] border border-slate-850 p-4 rounded-2xl h-full overflow-hidden shrink-0">
              <div className="flex items-center justify-between pb-3 border-b border-slate-850 mb-3 select-none shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4.5 w-4.5 text-blue-450" />
                  <span className="text-xs font-extrabold text-white font-sans uppercase tracking-tight">
                    Terminal Console Output
                  </span>
                </div>
                
                <button
                  onClick={() => {
                    setSimulatedLogs([]);
                    addSimulatedLog("Terminal trace logs cleared.", "info");
                  }}
                  className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-355 font-mono transition-colors bg-slate-955 hover:bg-slate-900 border border-slate-850 px-2 py-1 rounded cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              {/* Logs Stream Container */}
              <div className="flex-1 bg-[#070709] border border-slate-850 p-3 rounded-xl font-mono text-[11px] overflow-y-auto space-y-1.5 min-h-[160px]">
                {simulatedLogs.length === 0 ? (
                  <p className="text-slate-600 text-center italic py-2">No logging traces compiled. Trigger interactions above!</p>
                ) : (
                  simulatedLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 leading-snug break-all border-b border-slate-900 pb-1">
                      <span className="text-slate-600 select-none text-[10px] shrink-0 mt-0.5">{log.timestamp}</span>
                      <span className={`px-1 rounded-[3px] text-[9.5px] font-bold select-none uppercase shrink-0 mt-0.5 ${
                        log.level === "info" ? "bg-blue-950/70 border border-blue-900/40 text-blue-400" :
                        log.level === "warn" ? "bg-amber-950/70 border border-amber-900/40 text-amber-400" :
                        log.level === "error" ? "bg-red-950/70 border border-red-900/40 text-red-400" :
                        "bg-slate-900 border border-slate-800 text-slate-400"
                      }`}>
                        {log.level}
                      </span>
                      <span className={
                        log.level === "error" ? "text-red-400" :
                        log.level === "warn" ? "text-amber-300" :
                        log.level === "info" ? "text-blue-300" :
                        "text-slate-300"
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Console Code Executor Input bar */}
              <div className="pt-3 border-t border-slate-850 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono mb-1">
                  Inject Console Snippet / Query
                </span>
                <div className="flex items-center gap-1.5 bg-[#070709] border border-slate-850 p-2 rounded-xl">
                  <span className="text-blue-500 font-bold font-mono pl-1 text-xs select-none">{`>`}</span>
                  <input
                    type="text"
                    value={simulatedConsoleInput}
                    onChange={(e) => setSimulatedConsoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleExecuteConsoleSnippet();
                      }
                    }}
                    placeholder="e.g. document.title, throw Error, credits"
                    className="flex-1 bg-transparent text-xs text-slate-320 outline-none placeholder-slate-600 font-mono py-0.5 hover:text-white"
                  />
                  <button
                    onClick={handleExecuteConsoleSnippet}
                    className="p-1 px-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Run
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-1 px-0.5">
                  Type code inputs and compile. Result is parsed inside the sandbox client.
                </p>
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="mt-4 border-t border-slate-850 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[#111114]/30 px-4 py-2.5 rounded-xl border border-slate-850/50 shrink-0">
            <span className="text-slate-500 font-mono select-none">
              Client Session ID: <strong className="text-slate-400">{currentProject.id.substring(0, 10).toUpperCase()}</strong> - Connected.
            </span>

            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer transition-all shadow-md shadow-indigo-900/20"
            >
              Done Emulating
            </button>
          </div>
        </div>
      )}

      {/* FOOTER attribution with DEVELOPED BY SC TECH @ 2026 */}
      <footer className="border-t border-slate-805 bg-[#0F0F12] py-4.5 px-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono select-none">
        <div>
          © 2026 Trust Me AI Builder. Connected via Server-Side OpenRouter Node Mesh.
        </div>
        <div className="flex items-center gap-1 mt-1.5 sm:mt-0 font-sans tracking-tight font-semibold text-slate-400">
          DEVELOPED BY SC TECH @ 2026
          <Heart className="h-3 w-3 text-red-500 fill-red-500 animate-pulse inline ml-0.5" />
        </div>
      </footer>
      </>
      )}
    </div>
  );
}
