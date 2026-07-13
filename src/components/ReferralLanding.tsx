import React, { useEffect } from "react";
import { ArrowRight, Gift, Sparkles } from "lucide-react";
import { buildReferralLink } from "../lib/referral";

interface ReferralLandingProps {
  code?: string;
}

export default function ReferralLanding({ code }: ReferralLandingProps) {
  useEffect(() => {
    const normalizedCode = (code || "").trim().toUpperCase();
    if (normalizedCode) {
      localStorage.setItem("pending_referral_code", normalizedCode);
    }
  }, [code]);

  const referralLink = buildReferralLink(code ?? "");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(135deg,_#020617,_#0f172a)] text-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-500/10 backdrop-blur">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">
          <Gift className="h-4 w-4" />
          Referral bonus ready
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <Sparkles className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Join Trust Me AI Builder</h1>
            <p className="mt-1 text-sm text-slate-300">Your referral code has been saved. Sign up to unlock your bonus and start building faster.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Referral link</div>
          <div className="break-all font-mono text-cyan-300">{referralLink || "https://sctrustai.vercel.app"}</div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => {
              window.location.assign("/");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Continue to app
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(referralLink || "https://sctrustai.vercel.app");
            }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Copy referral link
          </button>
        </div>
      </div>
    </main>
  );
}
