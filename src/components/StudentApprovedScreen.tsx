import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { GraduationCap, Star, Zap, Shield, Gift, X } from "lucide-react";

interface Props {
  bonusCredits?: number;
  discountPercentage?: number;
  onClose: () => void;
}

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    color: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444"][Math.floor(Math.random() * 6)],
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ left: `${p.x}%`, top: "-10px", width: p.size, height: p.size, background: p.color }}
          animate={{ y: ["0vh", "110vh"], rotate: [0, 720], opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / 40);
    const interval = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [target]);
  return <>{val}</>;
}

const BENEFITS = [
  { icon: <Zap className="h-5 w-5" />, label: "50% Discount Applied", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-800/40" },
  { icon: <GraduationCap className="h-5 w-5" />, label: "Student Badge Activated", color: "text-purple-400", bg: "bg-purple-950/40 border-purple-800/40" },
  { icon: <Gift className="h-5 w-5" />, label: "Bonus Credits Added", color: "text-yellow-400", bg: "bg-yellow-950/40 border-yellow-800/40" },
  { icon: <Shield className="h-5 w-5" />, label: "Priority Support Enabled", color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-800/40" },
];

export default function StudentApprovedScreen({ bonusCredits = 100, discountPercentage = 50, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <Confetti />

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 16, stiffness: 120, delay: 0.1 }}
        className="relative bg-gradient-to-br from-[#0A0A14] via-[#0F0F1E] to-[#0A0A14] border border-purple-500/30 rounded-3xl max-w-md w-full p-8 shadow-2xl shadow-purple-900/30 text-center overflow-hidden"
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors z-10">
          <X className="h-4 w-4" />
        </button>

        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-3xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.3) 0%, transparent 70%)", filter: "blur(30px)" }}
        />

        {/* Badge */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.3 }}
          className="relative z-10 w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-purple-900/50"
        >
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-purple-400/50"
            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <GraduationCap className="h-10 w-10 text-white" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400 text-xs font-bold tracking-widest uppercase">Verified Student</span>
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-1">🎉 Verification Approved!</h2>
          <p className="text-slate-400 text-sm mb-6">Your student benefits have been activated</p>

          {/* Bonus credits */}
          <div className="bg-gradient-to-r from-yellow-950/50 to-amber-950/50 border border-yellow-700/30 rounded-xl p-4 mb-6">
            <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">Bonus Credits Added</p>
            <div className="text-4xl font-bold text-yellow-300">
              +<CountUp target={bonusCredits} />
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm font-medium ${b.color} ${b.bg}`}
              >
                {b.icon}
                <span className="text-[11px] leading-tight">{b.label}</span>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-900/30"
          >
            View Student Pricing →
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
