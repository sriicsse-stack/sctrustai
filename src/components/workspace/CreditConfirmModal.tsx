import { motion, AnimatePresence } from "motion/react";
import { Zap, X, AlertTriangle, ArrowRight, Sparkles, Clock, Layers } from "lucide-react";
import type { CreditEstimate } from "../../lib/creditCost";

interface CreditConfirmModalProps {
  open: boolean;
  estimate: CreditEstimate | null;
  currentCredits: number;
  prompt: string;
  onConfirm: () => void;
  onCancel: () => void;
  onUpgrade: () => void;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  Micro:      { bg: "bg-slate-800",    border: "border-slate-700",  text: "text-slate-300", badge: "bg-slate-700 text-slate-300" },
  Simple:     { bg: "bg-emerald-950",  border: "border-emerald-800", text: "text-emerald-400", badge: "bg-emerald-900 text-emerald-300" },
  Medium:     { bg: "bg-blue-950",     border: "border-blue-800",   text: "text-blue-400",   badge: "bg-blue-900 text-blue-300" },
  Large:      { bg: "bg-violet-950",   border: "border-violet-800", text: "text-violet-400", badge: "bg-violet-900 text-violet-300" },
  Complex:    { bg: "bg-orange-950",   border: "border-orange-800", text: "text-orange-400", badge: "bg-orange-900 text-orange-300" },
  Enterprise: { bg: "bg-red-950",      border: "border-red-900",    text: "text-red-400",    badge: "bg-red-900 text-red-300" },
};

export default function CreditConfirmModal({
  open, estimate, currentCredits, prompt, onConfirm, onCancel, onUpgrade,
}: CreditConfirmModalProps) {
  if (!estimate) return null;

  const insufficient = currentCredits < estimate.cost;
  const remaining = currentCredits - estimate.cost;
  const tier = TIER_COLORS[estimate.label] ?? TIER_COLORS.Medium;
  const truncatedPrompt = prompt.length > 80 ? prompt.slice(0, 80) + "…" : prompt;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card */}
          <motion.div
            className="relative w-full max-w-md bg-[#0f0f14] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {/* Header stripe */}
            <div className={`h-1 w-full ${insufficient ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-gradient-to-r from-blue-600 to-violet-500"}`} />

            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${insufficient ? "bg-red-950 border border-red-800" : "bg-blue-950 border border-blue-800"}`}>
                  {insufficient
                    ? <AlertTriangle className="h-4 w-4 text-red-400" />
                    : <Zap className="h-4 w-4 text-blue-400 fill-blue-400/30" />
                  }
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">
                    {insufficient ? "Insufficient Credits" : "Credit Cost Estimate"}
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {insufficient ? "You need more credits to continue" : "Review before generation starts"}
                  </p>
                </div>
              </div>
              <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Prompt preview */}
            <div className="mx-5 mb-4 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
              <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Your prompt
              </p>
              <p className="text-slate-300 text-xs leading-relaxed font-mono">{truncatedPrompt}</p>
            </div>

            {/* Cost breakdown */}
            <div className={`mx-5 mb-4 rounded-xl border ${tier.border} ${tier.bg} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> App Type
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.badge}`}>
                  {estimate.appType}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Complexity
                </span>
                <span className={`text-xs font-bold ${tier.text}`}>{estimate.label}</span>
              </div>
              <div className="text-[11px] text-slate-500 mb-4 leading-relaxed border-t border-slate-700/50 pt-2.5">
                {estimate.breakdown}
              </div>

              {/* Cost display */}
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm font-semibold">Estimated Cost</span>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-400 fill-amber-400/30" />
                  <span className={`text-2xl font-black ${tier.text}`}>{estimate.cost}</span>
                  <span className="text-slate-500 text-sm">credits</span>
                </div>
              </div>
            </div>

            {/* Balance summary */}
            <div className="mx-5 mb-4 grid grid-cols-3 gap-2">
              {[
                { label: "Current", value: currentCredits, color: "text-slate-300" },
                { label: "Cost",    value: `-${estimate.cost}`, color: insufficient ? "text-red-400" : "text-orange-400" },
                { label: "After",   value: insufficient ? "—" : remaining, color: insufficient ? "text-red-500" : remaining < 10 ? "text-orange-400" : "text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <p className="text-slate-500 text-[10px] mb-1">{label}</p>
                  <p className={`font-black text-base ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="p-5 pt-0 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              {insufficient ? (
                <button
                  onClick={onUpgrade}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-900/30"
                >
                  Upgrade Plan <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={onConfirm}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-900/30"
                >
                  <Zap className="h-3.5 w-3.5 fill-white/60" />
                  Generate · {estimate.cost} cr
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
