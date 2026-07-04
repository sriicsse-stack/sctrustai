import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Eye, Code2, History, Rocket, RefreshCw, CheckCircle2,
  Globe, Copy, ExternalLink, X, Upload, AlertTriangle, Loader2, XCircle
} from "lucide-react";

export type DeployStatus = "idle" | "deploying" | "success" | "failed";

interface Props {
  activeTab: "preview" | "code" | "history";
  setActiveTab: (t: "preview" | "code" | "history") => void;
  isGenerating: boolean;
  isDeploying: boolean;
  projectName?: string;
  publishedUrl?: string;
  credits?: number;
  deployStatus?: DeployStatus;
  deployError?: string;
  onPublish: () => void;
  onUpdate: () => void;
  onUpgrade?: () => void;
}

export default function WorkspaceTopBar({
  activeTab, setActiveTab, isGenerating, isDeploying,
  projectName, publishedUrl, credits = 70,
  deployStatus = "idle", deployError,
  onPublish, onUpdate, onUpgrade
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLowCreditPopup, setShowLowCreditPopup] = useState(false);
  const [lowCreditDismissed, setLowCreditDismissed] = useState(false);

  // Show low credit popup once per session
  useEffect(() => {
    if (credits <= 10 && !lowCreditDismissed) {
      setShowLowCreditPopup(true);
    }
  }, [credits, lowCreditDismissed]);

  // Auto-open modal only when deployment truly succeeds or fails
  useEffect(() => {
    if (deployStatus === "success" || deployStatus === "failed") {
      setShowModal(true);
    }
  }, [deployStatus]);

  const handlePublishClick = () => {
    if (isDeploying) return; // already in flight
    if (publishedUrl) {
      onUpdate(); // re-deploy with latest HTML — modal opens via deployStatus effect
    } else {
      onPublish(); // first deploy — modal opens via deployStatus effect
    }
  };

  const handleCopy = () => {
    if (publishedUrl) {
      navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs: { id: "preview" | "code" | "history"; label: string; icon: React.ReactNode }[] = [
    { id: "preview", label: "Preview", icon: <Eye className="h-3.5 w-3.5" /> },
    { id: "code",    label: "Code",    icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: "history", label: "History", icon: <History className="h-3.5 w-3.5" /> },
  ];

  const isLowCredit = credits <= 10;

  return (
    <>
      {/* Top Bar */}
      <div className="flex flex-col shrink-0 border-b border-slate-800 bg-[#0D0D10]/95 backdrop-blur-md z-20">
        {/* Main row: branding | tabs | actions */}
        <div className="h-12 flex items-center justify-between px-3 md:px-4 gap-2">
          {/* Left: branding */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="p-1.5 bg-gradient-to-tr from-blue-700 to-sky-400 rounded-lg shadow-lg shadow-blue-900/30 shrink-0">
              <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300 animate-pulse" />
            </div>
            <span className="text-sm font-extrabold text-white tracking-tight hidden sm:block">SC Workspace</span>
            {projectName && (
              <span className="text-[10px] text-slate-500 font-mono hidden md:block truncate max-w-[120px]">/ {projectName}</span>
            )}
          </div>

          {/* Center: tab switcher */}
          <div className="flex items-center bg-[#151519] border border-slate-800 rounded-lg p-0.5 gap-0.5 shrink-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  activeTab === t.id ? "text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {activeTab === t.id && (
                  <motion.span
                    layoutId="wsTopTabBg"
                    className="absolute inset-0 bg-slate-700 rounded-md"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Right: credits + status + publish */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Credits — visible on sm+ */}
            <button
              onClick={() => isLowCredit && setShowLowCreditPopup(true)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold font-mono transition-all cursor-pointer ${
                isLowCredit
                  ? "bg-red-950/60 border-red-700/60 text-red-400 animate-pulse"
                  : "bg-amber-950/40 border-amber-800/40 text-amber-400"
              }`}
            >
              <Zap className="h-3 w-3 fill-current" />
              <span>{credits}</span>
            </button>

            {/* Status pills — desktop only */}
            <div className="hidden lg:flex items-center gap-1.5">
              <StatusPill label="AI Ready" active={!isGenerating} color="emerald" />
              <StatusPill label="Build OK" active={!isDeploying} color="blue" />
              <StatusPill label="Live" active={!!publishedUrl} color="purple" />
            </div>

            {/* Publish / Update button */}
            <motion.button
              onClick={handlePublishClick}
              disabled={isDeploying}
              whileHover={!isDeploying ? { scale: 1.03, boxShadow: "0 0 16px rgba(99,102,241,0.5)" } : {}}
              whileTap={!isDeploying ? { scale: 0.97 } : {}}
              className={`flex items-center gap-1 px-2.5 md:px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                isDeploying
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : publishedUrl
                  ? "bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              }`}
            >
              {isDeploying ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">Deploying…</span></>
              ) : publishedUrl ? (
                <><Upload className="h-3.5 w-3.5" /><span className="hidden sm:inline">Update</span></>
              ) : (
                <><Rocket className="h-3.5 w-3.5 -rotate-45" /><span>Publish</span></>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Low Credits Popup */}
      <AnimatePresence>
        {showLowCreditPopup && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && setShowLowCreditPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 24 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className="bg-[#0D0D12] border border-red-800/50 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-red-950/40"
            >
              <div className="relative bg-gradient-to-br from-red-950/60 via-orange-950/20 to-transparent p-6 text-center border-b border-red-900/40">
                <button
                  onClick={() => { setShowLowCreditPopup(false); setLowCreditDismissed(true); }}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-red-900/50">
                  <AlertTriangle className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-black text-white">⚠ Low Credits Remaining</h3>
                <p className="text-sm text-slate-300 mt-2">
                  You have only <span className="text-red-400 font-extrabold">{credits} credit{credits !== 1 ? "s" : ""}</span> left.
                </p>
                <p className="text-xs text-slate-500 mt-1">Upgrade now to continue building without interruption.</p>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <button
                  onClick={() => { onUpgrade?.(); setShowLowCreditPopup(false); setLowCreditDismissed(true); }}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-indigo-900/40 cursor-pointer"
                >
                  🚀 Upgrade Plan
                </button>
                <button
                  onClick={() => { setShowLowCreditPopup(false); setLowCreditDismissed(true); }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deploy Result Modal — success OR failure, never shown for fake URLs */}
      <AnimatePresence>
        {showModal && (deployStatus === "success" || deployStatus === "failed") && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className={`bg-[#0D0D12] border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl ${
                deployStatus === "success"
                  ? "border-slate-700/60 shadow-indigo-950/30"
                  : "border-red-800/50 shadow-red-950/30"
              }`}
            >
              {/* Header */}
              <div className={`relative p-6 text-center border-b ${
                deployStatus === "success"
                  ? "bg-gradient-to-br from-indigo-900/40 via-blue-900/20 to-transparent border-slate-800"
                  : "bg-gradient-to-br from-red-950/60 via-orange-950/20 to-transparent border-red-900/40"
              }`}>
                <button onClick={() => setShowModal(false)} className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
                <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center shadow-lg ${
                  deployStatus === "success"
                    ? "bg-gradient-to-br from-indigo-600 to-blue-500 shadow-indigo-900/40"
                    : "bg-gradient-to-br from-red-600 to-orange-600 shadow-red-900/40"
                }`}>
                  {deployStatus === "success"
                    ? <CheckCircle2 className="h-7 w-7 text-white" />
                    : <XCircle className="h-7 w-7 text-white" />
                  }
                </div>
                {deployStatus === "success" ? (
                  <>
                    <h3 className="text-lg font-black text-white">App Published Successfully! 🎉</h3>
                    <p className="text-xs text-slate-400 mt-1">Your app is live and accessible worldwide.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-black text-white">Deployment Failed</h3>
                    <p className="text-xs text-slate-400 mt-1">Your app was not published. No URL was generated.</p>
                  </>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Success: URL row */}
                {deployStatus === "success" && publishedUrl && (
                  <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-xl p-2.5">
                    <Globe className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="flex-1 text-xs text-blue-300 font-mono truncate">{publishedUrl}</span>
                    <button onClick={handleCopy} className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer">
                      {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                {/* Failure: error message */}
                {deployStatus === "failed" && deployError && (
                  <div className="flex items-start gap-2.5 bg-red-950/30 border border-red-800/50 rounded-xl p-3">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300 leading-relaxed">{deployError}</p>
                  </div>
                )}

                {/* Success: action buttons */}
                {deployStatus === "success" && (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={handleCopy} className="flex flex-col items-center gap-1.5 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 font-bold transition-colors cursor-pointer">
                      <Copy className="h-4 w-4 text-blue-400" />
                      <span>Copy Link</span>
                    </button>
                    <button
                      onClick={() => publishedUrl && window.open(publishedUrl, "_blank")}
                      className="flex flex-col items-center gap-1.5 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 font-bold transition-colors cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4 text-emerald-400" />
                      <span>Open App</span>
                    </button>
                    <button
                      onClick={() => { onUpdate(); setShowModal(false); }}
                      className="flex flex-col items-center gap-1.5 p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 font-bold transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-4 w-4 text-indigo-400" />
                      <span>Update App</span>
                    </button>
                  </div>
                )}

                {/* Failure: retry button */}
                {deployStatus === "failed" && (
                  <button
                    onClick={() => { setShowModal(false); onPublish(); }}
                    className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry Deployment
                  </button>
                )}

                <button onClick={() => setShowModal(false)} className={`w-full py-2.5 font-bold rounded-xl text-sm transition-colors cursor-pointer ${
                  deployStatus === "success"
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}>
                  {deployStatus === "success" ? "Done" : "Close"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatusPill({ label, active, color }: { label: string; active: boolean; color: "emerald" | "blue" | "purple" }) {
  const colors = {
    emerald: "bg-emerald-950/60 border-emerald-800/50 text-emerald-400",
    blue:    "bg-blue-950/60 border-blue-800/50 text-blue-400",
    purple:  "bg-purple-950/60 border-purple-800/50 text-purple-400",
  };
  const dotColors = { emerald: "bg-emerald-400", blue: "bg-blue-400", purple: "bg-purple-400" };
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold font-mono ${colors[color]} ${active ? "opacity-100" : "opacity-40"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? dotColors[color] + " animate-pulse" : "bg-slate-600"}`} />
      {label}
    </div>
  );
}
