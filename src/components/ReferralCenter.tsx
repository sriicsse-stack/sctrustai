import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { buildReferralLink, normalizeReferralLink } from "../lib/referral";
import { getReferralProfile } from "../lib/referralProfile";

export default function ReferralCenter() {
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const isLoadingReferral = useRef(false);

  const referralLink = referral?.referral_link ? normalizeReferralLink(referral.referral_link) : (referral?.referral_code ? buildReferralLink(referral.referral_code) : "");

  useEffect(() => {
    (async () => {
      try {
        let user = null;
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            user = {
              googleId: userData.user.id,
              email: userData.user.email,
              name: (userData.user.user_metadata as any)?.full_name || (userData.user.user_metadata as any)?.name,
              picture: (userData.user.user_metadata as any)?.avatar_url || (userData.user.user_metadata as any)?.picture,
            };
          }
        } catch (_) {}
        if (!user) {
          try { const s = await (await fetch('/api/user-state')).json(); user = s.user; } catch (_) { user = null; }
        }
        if (!user) return;

        if (isLoadingReferral.current) return;
        isLoadingReferral.current = true;

        try {
          const response = await getReferralProfile(supabase, {
            body: { user_id: user.googleId, email: user.email, name: user.name, picture: user.picture, fetch_dashboard: true }
          });

          console.log('[ReferralCenter] referral-profile response', { error: response.error, data: response.data });
          if (!response.error && response.data) {
            const ref = response.data.dashboard?.profile ?? response.data.profile;
            if (ref) {
              const normalized = {
                ...ref,
                referral_link: normalizeReferralLink(ref.referral_link) || normalizeReferralLink(ref.referral_code) || (ref.referral_code ? buildReferralLink(ref.referral_code) : ''),
              };
              setReferral(normalized);
            }
            if (response.data.dashboard?.referrals) setHistory(response.data.dashboard.referrals);
          }
        } finally {
          isLoadingReferral.current = false;
        }
      } catch (e) {
        console.error('[ReferralCenter] load referral exception:', e);
      }
    })();
  }, []);

  const onGenerate = async () => {
    try {
      const userResponse = await (await fetch('/api/user-state')).json();
      const user = userResponse?.user;
      if (!user) return;
      console.log('[ReferralCenter] Generating referral for:', user.googleId);
      const response = await getReferralProfile(supabase, {
        body: { user_id: user.googleId, email: user.email, name: user.name, picture: user.picture, fetch_dashboard: false, auto_create_referral: true }
      });
      if (response.error) {
        console.error('[ReferralCenter] Referral generation error:', response.error);
        return;
      }
      if (response.data) {
        const prof = response.data.profile ?? response.data.dashboard?.profile;
        if (prof) {
          const normalized = {
            ...prof,
            referral_link: normalizeReferralLink(prof.referral_link) || normalizeReferralLink(prof.referral_code) || (prof.referral_code ? buildReferralLink(prof.referral_code) : ''),
          };
          console.log('[ReferralCenter] Generated referral:', normalized);
          setReferral(normalized);
        }
      }
    } catch (e) {
      console.error('[ReferralCenter] Generate referral exception:', e);
    }
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
            <input readOnly value={referralLink} className="flex-1 p-2 rounded bg-white/5" />
            <button onClick={() => onCopy(referralLink)} className="btn">{copied ? "Copied" : "Copy"}</button>
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={() => shareWhatsApp(referralLink)} className="btn">WhatsApp</button>
            <button onClick={() => shareTelegram(referralLink)} className="btn">Telegram</button>
            <button onClick={() => shareEmail(referralLink)} className="btn">Email</button>
            <button onClick={() => onNativeShare(referralLink)} className="btn">Share</button>
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
