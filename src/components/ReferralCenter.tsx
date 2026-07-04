import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function ReferralCenter() {
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/stats")
      .then((r) => r.json())
      .then((d) => { if (d && d.referral) setReferral(d.referral); })
      .catch(() => {});
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
          </div>

          <div className="mt-4">
            <div>Total Referrals: <strong>{referral.total_referrals || 0}</strong></div>
            <div>Successful Referrals: <strong>{referral.successful_referrals || 0}</strong></div>
            <div>Credits Earned: <strong>{referral.earned_credits || 0}</strong></div>
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
