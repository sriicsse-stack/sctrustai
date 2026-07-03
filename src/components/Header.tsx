import React from "react";
import { motion } from "motion/react";
import { 
  Sparkles, 
  Code, 
  Terminal, 
  Download, 
  Rocket, 
  ArrowLeft,
  RefreshCw,
  Coins,
  MessageSquare,
  Layers,
  Zap,
  Globe,
  CreditCard,
  User,
  LogOut,
  Chrome,
  AlertCircle,
  ShieldCheck,
  Users
} from "lucide-react";
import { ProjectDetails } from "../types";

interface HeaderProps {
  currentProject: ProjectDetails | null;
  activeTab: "preview" | "code" | "deploy";
  setActiveTab: (tab: "preview" | "code" | "deploy") => void;
  isDeploying: boolean;
  onDeploy: (platform: string) => void;
  onDownload: () => void;
  onBackToHub: () => void;
  hasApiKey: boolean;
  
  // Custom interactive channels & billing stats
  activeGlobalTab: "workspace" | "sri-ai" | "pricing" | "referral" | "admin" | "marketplace" | "dashboard";
  setActiveGlobalTab: (tab: "workspace" | "sri-ai" | "pricing" | "referral" | "admin" | "marketplace" | "dashboard") => void;
  credits: number;
  plan: string;
  onOpenBilling: () => void;

  // Google OAuth Auth properties
  user: null | {
    name: string;
    email: string;
    picture: string;
    googleId: string;
    expiresAt: string;
  };
  onLoginStart: () => void;
  onLogout: () => void;
  oauthError: string | null;
  clearOauthError: () => void;
  offerActive?: boolean;
}

export default function Header({
  currentProject,
  activeTab,
  setActiveTab,
  isDeploying,
  onDeploy,
  onDownload,
  onBackToHub,
  hasApiKey,
  activeGlobalTab,
  setActiveGlobalTab,
  credits,
  plan,
  onOpenBilling,
  user,
  onLoginStart,
  onLogout,
  oauthError,
  clearOauthError,
  offerActive = false,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState<string>("");

  // Dynamically recalculate remaining token duration to fulfill 'Handle token expiration'
  React.useEffect(() => {
    if (!user) return;

    const calculateTime = () => {
      const expiresAtDate = new Date(user.expiresAt);
      const diffMs = expiresAtDate.getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft("Session Expired");
        return;
      }
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [user]);
  return (
    <header id="workspace-header" className="border-b border-slate-800 bg-[#0F0F11]/95 px-6 py-4 flex flex-col xl:flex-row items-center justify-between gap-4 shadow-md sticky top-0 z-50 backdrop-blur-md">
      {/* Brand & Motto */}
      <div className="flex items-center gap-4 w-full xl:w-auto justify-between sm:justify-start">
        <div className="flex items-center gap-3">
          {currentProject && activeGlobalTab === "workspace" && (
            <button 
              id="back-to-hub-btn"
              onClick={onBackToHub}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/80 cursor-pointer"
              title="Go back to dashboard hub"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 rounded-xl text-white font-bold leading-none shadow-lg shadow-blue-900/30">
              <Zap className="h-5 w-5 text-amber-300 fill-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 id="app-title" className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 font-sans">
                  Trust Me AI Builder
                </h1>
                <span className="text-[9px] font-bold text-blue-400 bg-blue-950/70 border border-blue-900/40 px-1.5 py-0.5 rounded font-mono">
                  PRO
                </span>
              </div>
              <p id="app-subtitle" className="text-[11px] text-slate-400 font-medium">
                "Turn Ideas into Live Apps in Minutes."
              </p>
            </div>
          </div>
        </div>

        {/* Action Toggle for Mobile */}
        <div className="flex xl:hidden items-center gap-2">
          <button 
            onClick={onOpenBilling}
            className="flex items-center gap-1 bg-amber-950/40 border border-amber-900/50 hover:bg-amber-950/70 text-amber-400 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer"
          >
            <Coins className="h-3.5 w-3.5" />
            <span>{plan === "Free" ? `${credits}cr` : plan}</span>
          </button>
        </div>
      </div>

      {/* Global Tab Channels: Website Builder vs Sri AI Doubt Assistant vs Pricing */}
      <div id="global-view-channels" className="flex items-center bg-[#151519] border border-slate-800/80 p-1 rounded-xl w-full xl:w-auto max-w-full overflow-x-auto scrollbar-none gap-1">
        <button
          onClick={() => setActiveGlobalTab("workspace")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[11.5px] sm:text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
            activeGlobalTab === "workspace" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeGlobalTab === "workspace" && (
            <motion.span
              layoutId="activeGlobalTabBackground"
              className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-900/30"
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <Layers className="h-3.5 w-3.5 font-bold shrink-0" />
            <span className="hidden sm:inline">Website Builder</span>
            <span className="inline sm:hidden">Website</span>
          </span>
        </button>

        <button
          onClick={() => setActiveGlobalTab("sri-ai")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[11.5px] sm:text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
            activeGlobalTab === "sri-ai" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeGlobalTab === "sri-ai" && (
            <motion.span
              layoutId="activeGlobalTabBackground"
              className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-900/30"
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <MessageSquare className="h-3.5 w-3.5 font-bold shrink-0" />
            <span className="hidden sm:inline">Sri AI Assistance</span>
            <span className="inline sm:hidden">Sri AI</span>
            <span className="absolute -top-1 -right-1 block h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveGlobalTab("referral")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[11.5px] sm:text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
            activeGlobalTab === "referral" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeGlobalTab === "referral" && (
            <motion.span
              layoutId="activeGlobalTabBackground"
              className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-900/30"
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <Users className="h-3.5 w-3.5 font-bold shrink-0 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">🎁 Earn Credits</span>
            <span className="inline sm:hidden">🎁 Refer</span>
          </span>
        </button>

        <button
          onClick={() => setActiveGlobalTab("pricing")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[11.5px] sm:text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
            activeGlobalTab === "pricing" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeGlobalTab === "pricing" && (
            <motion.span
              layoutId="activeGlobalTabBackground"
              className="absolute inset-0 bg-[#6366F1] rounded-lg shadow-md shadow-indigo-900/35 border border-indigo-500/20"
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <CreditCard className="h-3.5 w-3.5 font-bold text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">💎 Pricing Plans</span>
            <span className="inline sm:hidden">Pricing</span>
            {offerActive ? (
              <span className="hidden md:inline-flex items-center gap-0.5 text-[8.5px] font-black uppercase font-mono px-1 py-0.5 rounded ml-1 animate-pulse bg-gradient-to-r from-red-600 via-amber-500 to-amber-600 text-white shadow shadow-red-950">
                🔥 Promo
              </span>
            ) : (
              <span className="absolute -top-1 -right-1 block h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1 w-1 bg-indigo-500"></span>
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveGlobalTab("marketplace")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[11.5px] sm:text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
            activeGlobalTab === "marketplace" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeGlobalTab === "marketplace" && (
            <motion.span
              layoutId="activeGlobalTabBackground"
              className="absolute inset-0 bg-emerald-600 rounded-lg shadow-md shadow-emerald-900/30"
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <Globe className="h-3.5 w-3.5 font-bold text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">🛒 Marketplace</span>
            <span className="inline sm:hidden">Market</span>
          </span>
        </button>

        <button
          onClick={() => setActiveGlobalTab("dashboard")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[11.5px] sm:text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
            activeGlobalTab === "dashboard" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeGlobalTab === "dashboard" && (
            <motion.span
              layoutId="activeGlobalTabBackground"
              className="absolute inset-0 bg-purple-600 rounded-lg shadow-md shadow-purple-900/30"
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <User className="h-3.5 w-3.5 font-bold text-purple-400 shrink-0" />
            <span className="hidden sm:inline">📊 Dashboard</span>
            <span className="inline sm:hidden">Dashboard</span>
          </span>
        </button>
      </div>

      {/* Workspace Context tab selectors inside project */}
      <div className="flex items-center gap-2 w-full xl:w-auto justify-between xl:justify-end">
        {currentProject && activeGlobalTab === "workspace" && (
          <div id="navigation-tabs" className="flex items-center overflow-x-auto p-1 bg-[#151519] border border-slate-800 rounded-xl gap-1 w-full sm:w-auto">
            <button
              id="tab-preview-btn"
              onClick={() => setActiveTab("preview")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 font-bold text-[11px] sm:text-xs rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
                activeTab === "preview" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "preview" && (
                <motion.span
                  layoutId="activeWorkspaceTabBackground"
                  className="absolute inset-0 bg-slate-800 rounded-lg border border-slate-700/60"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Preview sandbox</span>
                <span className="inline sm:hidden">Preview</span>
              </span>
            </button>
            <button
              id="tab-code-btn"
              onClick={() => setActiveTab("code")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 font-bold text-[11px] sm:text-xs rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
                activeTab === "code" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "code" && (
                <motion.span
                  layoutId="activeWorkspaceTabBackground"
                  className="absolute inset-0 bg-slate-800 rounded-lg border border-slate-700/60"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="hidden sm:inline">Files editor</span>
                <span className="inline sm:hidden">Code</span>
              </span>
            </button>
            <button
              id="tab-deploy-btn"
              onClick={() => setActiveTab("deploy")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 font-bold text-[11px] sm:text-xs rounded-lg cursor-pointer whitespace-nowrap relative transition-colors ${
                activeTab === "deploy" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {activeTab === "deploy" && (
                <motion.span
                  layoutId="activeWorkspaceTabBackground"
                  className="absolute inset-0 bg-[#1E1E24] rounded-lg border border-slate-700"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="hidden sm:inline">Production Hosting</span>
                <span className="inline sm:hidden">Hosting</span>
              </span>
            </button>
          </div>
        )}

        {/* Global actions: credentials, credits & deploy */}
        <div className="flex items-center gap-3 ml-auto xl:ml-0">
          {/* OAuth Errors Display */}
          {oauthError && (
            <div className="flex items-center gap-2">
              <div
                onClick={clearOauthError}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-950/40 border border-red-900/50 hover:bg-red-900/10 text-red-400 text-[11px] rounded-xl cursor-pointer transition-all animate-pulse"
                title={`${oauthError}. Click to clear.`}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold hidden lg:inline max-w-[150px] truncate">
                  {oauthError.toLowerCase().includes("origin_mismatch")
                    ? "Google origin blocked"
                    : "OAuth error"}
                </span>
              </div>
              {oauthError.toLowerCase().includes("origin_mismatch") && (
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 underline font-mono hidden xl:block"
                >
                  Fix in Google Console →
                </a>
              )}
            </div>
          )}

          {/* Continue with Google Login trigger or Profile Badge */}
          {!user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onLoginStart}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#181922] hover:bg-[#202230] text-slate-200 hover:text-white rounded-xl border border-slate-800 hover:border-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer group shrink-0"
                title="Authenticate and log in using standard Google services"
              >
                <Chrome className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                <span>Continue with Google</span>
              </button>

            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1 bg-slate-900/80 hover:bg-slate-850 rounded-xl border border-blue-500/30 hover:border-blue-500/60 p-0.5 cursor-pointer transition-colors shrink-0"
                title={`${user.name} verified session. Click to manage profile.`}
              >
                <img 
                  src={user.picture || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"} 
                  alt={user.name} 
                  className="w-7 h-7 rounded-lg object-cover border border-slate-800" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-[11px] font-bold text-slate-300 pr-1 truncate max-w-[90px] hidden sm:inline">{user.name.split(" ")[0]}</span>
              </button>

              {/* Profile details popover */}
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2.5 w-72 bg-[#12131A] border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3 mb-3">
                      <img 
                        src={user.picture || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"} 
                        alt={user.name} 
                        className="w-10 h-10 rounded-xl object-cover border border-slate-800 shadow" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-white truncate">{user.name}</h4>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-[10px] bg-slate-950/50 rounded-lg p-2 border border-slate-900">
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5 shrink-0">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          GIS Verified
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono select-none bg-blue-950/20 text-blue-400 px-1.5 py-0.5 rounded font-bold border border-blue-900/30">
                          Active Session
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] bg-slate-950/50 rounded-lg p-2 border border-slate-900">
                        <span className="text-slate-400">Token Expiration:</span>
                        <span className="font-mono text-amber-400 font-bold">{timeLeft}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-950/20 border border-red-900/40 hover:bg-red-950/50 text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Log Out Session</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Credits Widget Pill (Desktop view) */}
          <button 
            onClick={onOpenBilling}
            className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-slate-900 to-[#16161A] hover:from-slate-800 hover:to-slate-900 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-bold font-sans cursor-pointer transition-all shadow-sm"
            title="Manage limits, credit packages and simulated invite program"
          >
            <Coins className="h-4 w-4 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span className="text-slate-400 font-mono text-[10px]">PLAN:</span>
            <span className="text-blue-400 uppercase font-mono">{plan}</span>
            <div className="h-3 w-px bg-slate-800 mx-0.5" />
            <span className="bg-amber-950/50 hover:bg-amber-950 text-amber-400 px-2 py-0.5 rounded text-[11px] font-mono border border-amber-900/40">
              {plan === "Free" ? `${credits} Credits` : "Unlimited Free"}
            </span>
          </button>

          {/* OpenRouter API state */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#16161A] border border-slate-800 rounded-xl text-xs">
            <div className={`h-1.5 w-1.5 rounded-full ${hasApiKey ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span className="text-slate-400 font-mono text-[9px]">OPENROUTER AI</span>
            <span className={`font-bold font-mono text-[10px] ${hasApiKey ? "text-emerald-400" : "text-rose-400"}`}>
              {hasApiKey ? "ACTIVE" : "MISSING"}
            </span>
          </div>

          {currentProject && activeGlobalTab === "workspace" && (
            <div className="flex items-center gap-2">
              <button
                id="download-source-btn"
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 bg-[#16161A] text-slate-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                title="Download full project ZIP"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline text-[11px]">Download ZIP</span>
              </button>

              <button
                id="launch-deploy-header-btn"
                onClick={() => onDeploy("Vercel")}
                disabled={isDeploying}
                className={`flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all shadow-blue-900/25 ${
                  isDeploying ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isDeploying ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-[11px]">Building...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="h-3.5 w-3.5 text-blue-100 -rotate-45 hover:scale-120 hover:text-white transition-all duration-300 animate-pulse" />
                    <span className="text-[11px]">Live Deploy</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
