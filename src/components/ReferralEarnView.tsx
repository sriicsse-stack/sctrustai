import React, { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Copy,
  Check,
  Users,
  Coins,
  Flame,
  Clock,
  Share2,
  Sparkles,
  Award,
  Zap,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Mail,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface ReferralStats {
  total_referrals: number;
  successful_referrals: number;
  deploy_bonuses: number;
  paid_bonuses: number;
  credits_earned: number;
}

interface ReferralRecord {
  id: string;
  referred_user_id: string;
  referred_name: string;
  referred_email: string;
  status: "signed_up" | "deployed" | "paid";
  deploy_rewarded: boolean;
  paid_rewarded: boolean;
  created_at: string;
}

interface ProfileData {
  id: string;
  name: string;
  email: string;
  credits: number;
  referral_code: string;
}

interface ReferralEarnViewProps {
  userState: {
    credits: number;
    plan: string;
    referralCode: string;
    referrals: Array<{ id: string; friend: string; action: string; reward: number; timestamp: string }>;
    user: any;
  };
}

const BASE_URL = "https://trustmeai.com";

function statusLabel(r: ReferralRecord) {
  if (r.paid_rewarded) return { text: "Paid Plan", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" };
  if (r.deploy_rewarded) return { text: "Deployed", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
  return { text: "Signed Up", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
}

function creditsForRecord(r: ReferralRecord): number {
  let c = 45; // always earned signup bonus
  if (r.deploy_rewarded) c += 5;
  if (r.paid_rewarded) c += 50;
  return c;
}

export default function ReferralEarnView({ userState }: ReferralEarnViewProps) {
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveCredits, setLiveCredits] = useState<number>(userState.credits);
  const [newRewardPulse, setNewRewardPulse] = useState(false);

  const user = userState.user;

  // Derive referral link from real profile or fall back to placeholder
  const referralCode = profile?.referral_code ?? null;
  const referralLink = referralCode
    ? `${BASE_URL}/ref/${referralCode}`
    : user
    ? `${BASE_URL}/ref/...`
    : null;

  // ── Load / upsert profile + dashboard ───────────────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!user?.googleId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("referral-profile", {
        body: {
          user_id: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture,
          fetch_dashboard: true,
        },
      });
      if (error) {
        let msg = error?.message || String(error);
        if (error?.context?.text && typeof error.context.text === 'function') {
          try { msg = await error.context.text(); } catch (_) {}
        } else if (typeof error?.context?.text === 'string') {
          msg = error.context.text;
        }
        console.error("[ReferralEarnView] referral-profile error:", msg);
        return;
      }
      if (data?.dashboard) {
        setProfile(data.dashboard.profile);
        setReferrals(data.dashboard.referrals ?? []);
        setStats(data.dashboard.stats);
        setLiveCredits(data.dashboard.profile.credits);
      } else if (data?.profile) {
        setProfile(data.profile);
        setLiveCredits(data.profile.credits);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Realtime: credit updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.googleId) return;
    const channel = supabase
      .channel("profile-credits")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.googleId}` },
        (payload) => {
          const newCredits = (payload.new as any)?.credits;
          if (typeof newCredits === "number") {
            setLiveCredits(newCredits);
            setNewRewardPulse(true);
            setTimeout(() => setNewRewardPulse(false), 2000);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "referral_rewards", filter: `user_id=eq.${user.googleId}` },
        () => { loadDashboard(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.googleId, loadDashboard]);

  // ── Share helpers ────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareMsg = encodeURIComponent(
    `🚀 Join me on Trust Me AI Builder — the fastest AI dev workspace!\nUse my link to get +10 free credits when you sign up: ${referralLink}`
  );
  const shareLinks = [
    {
      label: "WhatsApp",
      color: "bg-green-600/15 border-green-600/30 text-green-400 hover:bg-green-600/25",
      href: `https://wa.me/?text=${shareMsg}`,
      icon: "💬",
    },
    {
      label: "Telegram",
      color: "bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25",
      href: `https://t.me/share/url?url=${encodeURIComponent(referralLink ?? "")}&text=${shareMsg}`,
      icon: "✈️",
    },
    {
      label: "Twitter",
      color: "bg-slate-600/15 border-slate-600/30 text-slate-300 hover:bg-slate-600/25",
      href: `https://twitter.com/intent/tweet?text=${shareMsg}`,
      icon: "🐦",
    },
    {
      label: "Email",
      color: "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25",
      href: `mailto:?subject=Join Trust Me AI Builder&body=${shareMsg}`,
      icon: "📧",
    },
  ];

  return (
    <main id="referral-credits-portal" className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-8 flex flex-col gap-8 select-text">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950/40 via-[#0F0F12] to-indigo-950/30 border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex-1 relative z-10 flex flex-col gap-3">
          <span className="self-start text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-amber-500 animate-pulse" />
            Live Referral Program — Real Credits
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight text-balance">
            🎉 Invite Friends &amp; Earn Credits
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-xl text-pretty">
            Share your unique referral link. Every friend who signs up earns you <strong className="text-white">+45 credits</strong> instantly — deployed first project earns <strong className="text-white">+5 more</strong>, paid plan earns <strong className="text-white">+50</strong>.
          </p>
        </div>

        <div className={`relative z-10 flex items-center gap-4 bg-slate-900/60 p-5 rounded-2xl border backdrop-blur transition-all duration-500 ${newRewardPulse ? "border-amber-400/60 shadow-amber-500/20 shadow-lg" : "border-slate-800/60"}`}>
          <div className={`p-3 rounded-xl border transition-colors ${newRewardPulse ? "bg-amber-400/20 border-amber-400/40" : "bg-amber-400/10 border-amber-400/20"}`}>
            <Coins className={`h-7 w-7 text-amber-400 ${newRewardPulse ? "animate-bounce" : ""}`} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Credits Balance
            </div>
            <div className={`text-2xl font-black flex items-center gap-1.5 font-mono transition-colors ${newRewardPulse ? "text-amber-300" : "text-white"}`}>
              {profile ? liveCredits : userState.credits}
              <span className="text-[10px] text-slate-500 font-semibold uppercase">credits</span>
            </div>
            {!user && (
              <p className="text-[10px] text-slate-500 mt-0.5">Sign in to sync credits</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Not signed in warning ────────────────────────────────────────── */}
      {!user && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            <strong>Sign in with Google</strong> to generate your personal referral link, track real referrals, and earn live credits to your account.
          </p>
        </div>
      )}

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Referrals", value: stats.total_referrals, color: "text-blue-400", icon: Users },
            { label: "Successful", value: stats.successful_referrals, color: "text-emerald-400", icon: ShieldCheck },
            { label: "Credits Earned", value: stats.credits_earned, color: "text-amber-400", icon: Coins },
            { label: "Deploy Bonuses", value: stats.deploy_bonuses, color: "text-sky-400", icon: Award },
            { label: "Paid Bonuses", value: stats.paid_bonuses, color: "text-purple-400", icon: Sparkles },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-[#0F0F12] border border-slate-800 rounded-xl p-4 flex flex-col gap-1.5">
              <Icon className={`h-4 w-4 ${color}`} />
              <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide font-mono">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Left: Referral Link + Reward Rules + Share */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          {/* Referral Link Card */}
          <div className="bg-[#0F0F12] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2 border-b border-slate-800 pb-3">
              <Share2 className="h-4 w-4 text-blue-400" />
              Your Unique Referral Link
            </h2>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                {user ? "Copy & share this link" : "Sign in to get your link"}
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex-1 min-w-0 border p-3 rounded-xl font-mono text-[11.5px] truncate select-all transition-colors ${
                  referralLink ? "bg-slate-950 border-slate-800 text-blue-400" : "bg-slate-950/50 border-slate-800/50 text-slate-600"
                }`}>
                  {referralLink ?? "https://trustmeai.com/ref/your-code"}
                </div>
                <button
                  onClick={handleCopy}
                  disabled={!referralLink || !profile}
                  className={`shrink-0 px-4 py-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 border ${
                    copied
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-blue-600 hover:bg-blue-500 border-blue-700 text-white shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
                </button>
              </div>
            </div>

            {/* Share buttons */}
            {referralLink && profile && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Share via</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {shareLinks.map(({ label, color, href, icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-[11px] font-bold font-mono transition-all ${color}`}
                    >
                      <span>{icon}</span>
                      {label}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reward Rules */}
          <div className="bg-[#0F0F12] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2 border-b border-slate-800 pb-3">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              Reward Rules
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { badge: "+45", label: "Friend Signup", desc: "You earn 45 credits the moment your friend completes sign up.", badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                { badge: "+5", label: "First Deploy", desc: "Earn +5 bonus credits when your referred friend deploys their first project.", badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                { badge: "+50", label: "Paid Plan", desc: "Earn +50 credits when your referred friend buys any paid plan.", badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
              ].map(({ badge, label, desc, badgeColor }) => (
                <div key={label} className="bg-[#16161A]/60 border border-slate-800/50 p-4 rounded-xl flex flex-col gap-2">
                  <div className={`self-start px-2.5 py-0.5 rounded border text-xs font-black font-mono ${badgeColor}`}>{badge} CR</div>
                  <h3 className="text-xs font-bold text-slate-200">{label}</h3>
                  <p className="text-[10px] text-slate-400 leading-normal text-pretty">{desc}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl">
              <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <p className="text-[10px] text-slate-400">
                <strong className="text-emerald-400">Your friend also gets +10 credits</strong> just for joining via your link. Unlimited referrals — no caps.
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <p className="text-[10px] text-slate-400">
                Anti-abuse protection: self-referrals blocked · duplicate signups blocked · rewards issued only once per referred user.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Referred Friends Ledger */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-[#0F0F12] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Referred Friends Ledger
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadDashboard}
                  disabled={loading}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                </button>
                <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded">
                  {referrals.length} referred
                </span>
              </div>
            </div>

            {loading && referrals.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <RefreshCw className="h-5 w-5 text-slate-600 animate-spin" />
              </div>
            ) : !user ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20 min-h-[220px]">
                <Mail className="h-8 w-8 text-slate-600 mb-3" />
                <p className="text-slate-300 text-xs font-bold">Sign in to view your referrals</p>
                <p className="text-slate-500 text-[10px] max-w-xs mt-1">All referral data is stored in your profile — sign in with Google to load it.</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20 min-h-[220px]">
                <Users className="h-8 w-8 text-slate-600 mb-3" />
                <p className="text-slate-300 text-xs font-bold">No referrals yet</p>
                <p className="text-slate-500 text-[10px] max-w-xs mt-1">Share your unique link above — registrations will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-0.5 flex-1">
                {referrals.map((r) => {
                  const sl = statusLabel(r);
                  return (
                    <div key={r.id} className="p-3.5 bg-[#16161A]/80 border border-slate-800/60 hover:border-slate-700 transition-colors rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-[11px] text-blue-400 shrink-0 font-mono uppercase">
                          {(r.referred_name || r.referred_email || "?").slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {r.referred_name || r.referred_email}
                          </span>
                          <span className={`text-[10px] flex items-center gap-1 ${sl.color}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse shrink-0" />
                            {sl.text}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border font-mono ${sl.bg} ${sl.color}`}>
                          +{creditsForRecord(r)} CR
                        </span>
                        <span className="text-[8px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
