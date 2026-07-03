import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  Coins,
  Award,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface TopReferrer {
  id: string;
  name: string;
  email: string;
  credits: number;
  total_referrals: number;
  deploy_bonuses: number;
  paid_bonuses: number;
}

interface RecentReward {
  id: string;
  user_id: string;
  user_name: string;
  reward_type: string;
  credits: number;
  created_at: string;
}

interface AdminStats {
  top_referrers: TopReferrer[];
  total_referrals: number;
  total_rewards_issued: number;
  total_deploy_bonuses: number;
  total_paid_bonuses: number;
  recent_rewards: RecentReward[];
}

const rewardTypeLabel: Record<string, { label: string; color: string }> = {
  signup_referrer:  { label: "Signup Bonus (Referrer)", color: "text-amber-400" },
  signup_new_user:  { label: "Welcome Bonus (New User)", color: "text-emerald-400" },
  deploy_bonus:     { label: "Deploy Bonus", color: "text-blue-400" },
  paid_bonus:       { label: "Paid Plan Bonus", color: "text-purple-400" },
};

export default function ReferralAdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("referral-admin");
      if (fnErr) {
        let msg = fnErr?.message || String(fnErr);
        if (fnErr?.context?.text && typeof fnErr.context.text === 'function') {
          try { msg = await fnErr.context.text(); } catch (_) {}
        } else if (typeof fnErr?.context?.text === 'string') {
          msg = fnErr.context.text;
        }
        console.error("[ReferralAdminPanel] referral-admin error:", msg);
        setError(msg);
        return;
      }
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-purple-400 font-mono font-bold uppercase tracking-widest mb-1">Admin</div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-400" />
            Referral System Dashboard
          </h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-xs font-mono disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 text-slate-600 animate-spin" />
        </div>
      )}

      {stats && (
        <>
          {/* Global Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Referrals", value: stats.total_referrals, color: "text-blue-400", icon: Users },
              { label: "Credits Issued", value: stats.total_rewards_issued, color: "text-amber-400", icon: Coins },
              { label: "Deploy Bonuses", value: stats.total_deploy_bonuses, color: "text-sky-400", icon: Award },
              { label: "Paid Bonuses", value: stats.total_paid_bonuses, color: "text-purple-400", icon: Sparkles },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-[#0F0F12] border border-slate-800 rounded-xl p-4 flex flex-col gap-1.5">
                <Icon className={`h-4 w-4 ${color}`} />
                <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide font-mono">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Referrers */}
            <div className="bg-[#0F0F12] border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2 border-b border-slate-800 pb-3">
                <TrendingUp className="h-4 w-4 text-amber-400" />
                Top Referrers
              </h3>
              <div className="space-y-2 overflow-y-auto max-h-[320px]">
                {(stats.top_referrers ?? []).length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-6">No referrers yet.</p>
                ) : (
                  (stats.top_referrers ?? []).map((r, i) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-[#16161A]/60 border border-slate-800/50 rounded-xl">
                      <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black font-mono text-slate-400 shrink-0">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-200 truncate">{r.name || r.email}</div>
                        <div className="text-[10px] text-slate-500 truncate">{r.email}</div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-amber-400 font-mono">{r.total_referrals} refs</span>
                        <span className="text-[10px] text-slate-500 font-mono">{r.credits} cr</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Rewards */}
            <div className="bg-[#0F0F12] border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2 border-b border-slate-800 pb-3">
                <Coins className="h-4 w-4 text-emerald-400" />
                Recent Rewards Issued
              </h3>
              <div className="space-y-2 overflow-y-auto max-h-[320px]">
                {(stats.recent_rewards ?? []).length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-6">No rewards issued yet.</p>
                ) : (
                  (stats.recent_rewards ?? []).map((rw) => {
                    const rt = rewardTypeLabel[rw.reward_type] ?? { label: rw.reward_type, color: "text-slate-400" };
                    return (
                      <div key={rw.id} className="flex items-center gap-3 p-3 bg-[#16161A]/60 border border-slate-800/50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <div className={`text-[10px] font-bold font-mono ${rt.color}`}>{rt.label}</div>
                          <div className="text-[10px] text-slate-500 truncate">{rw.user_name || rw.user_id}</div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col gap-0.5">
                          <span className={`text-xs font-bold font-mono ${rt.color}`}>+{rw.credits} CR</span>
                          <span className="text-[9px] text-slate-600 font-mono flex items-center gap-1 justify-end">
                            <Clock className="h-2 w-2" />
                            {new Date(rw.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Suspicious Activity Notice */}
          <div className="bg-[#0F0F12] border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Anti-Abuse Controls
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Self-referrals", status: "Blocked", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Duplicate rewards", status: "Prevented", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Multiple signup abuse", status: "One per user pair", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              ].map(({ label, status, color, bg }) => (
                <div key={label} className={`flex items-center justify-between p-3 rounded-xl border ${bg}`}>
                  <span className="text-[11px] text-slate-300 font-mono">{label}</span>
                  <span className={`text-[10px] font-bold font-mono ${color}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
