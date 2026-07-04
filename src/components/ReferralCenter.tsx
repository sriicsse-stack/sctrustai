import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function ReferralCenter() {
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/referrals/stats")
      .then((r) => r.json())
      .then((d) => { if (d && d.referral) setReferral(d.referral); })
      .catch(() => {});
    fetch("/api/referrals/history").then((r) => r.json()).then((d) => { if (d?.history) setHistory(d.history); }).catch(() => {});
  }, []);

  const onGenerate = async () => {
    const res = await fetch(`/api/referrals/generate`, { method: "POST", headers: { "Content-Type": "application/json" } });
    const j = await res.json();
    if (j?.referral) setReferral(j.referral);
  };

  const onCopy = (link: string) => {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const shareWhatsApp = (link: string) => window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, "_blank");
  const shareTelegram = (link: string) => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}`, "_blank");
  const shareEmail = (link: string) => window.open(`mailto:?subject=Join%20me%20on%20TMAI&body=${encodeURIComponent(link)}`);

  const onNativeShare = async (link: string) => {
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: 'Join me on TMAI', text: 'Sign up using my referral link', url: link }); return; } catch (e) { /* user cancelled */ }
    }
    // fallback to copy
    onCopy(link);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-white/5 rounded-xl glass-shadow">
      <h3 className="text-lg font-bold mb-3">Referral Center</h3>
      {referral ? (
        <div>
          <div className="mb-2">Your referral link:</div>
          <div className="flex items-center gap-2">
            <input readOnly value={referral.referral_link} className="flex-1 p-2 rounded bg-white/5" />
            <button onClick={() => onCopy(referral.referral_link)} className="btn">{copied ? "Copied" : "Copy"}</button>
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={() => shareWhatsApp(referral.referral_link)} className="btn">WhatsApp</button>
            <button onClick={() => shareTelegram(referral.referral_link)} className="btn">Telegram</button>
            <button onClick={() => shareEmail(referral.referral_link)} className="btn">Email</button>
            <button onClick={() => onNativeShare(referral.referral_link)} className="btn">Share</button>
          </div>

          <div className="mt-4">
            <div>Total Referrals: <strong>{referral.total_referrals || 0}</strong></div>
            <div>Successful Referrals: <strong>{referral.successful_referrals || 0}</strong></div>
            <div>Credits Earned: <strong>{referral.earned_credits || 0}</strong></div>
          </div>

          <div className="mt-4">
            <h4 className="font-semibold mb-2">Referral History</h4>
            {history.length === 0 && <div className="text-sm text-muted">No referral history yet.</div>}
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={`${h.referred_user_id}_${h.created_at}`} className="p-2 rounded bg-white/3">
                  <div className="text-sm"><strong>{h.referred_user_id}</strong> — {h.reward_type} — +{h.amount} credits</div>
                  <div className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3">You don't have a referral code yet.</p>
          <button onClick={onGenerate} className="btn">Generate Referral Link</button>
        </div>
      )}
    </motion.div>
  );
}
