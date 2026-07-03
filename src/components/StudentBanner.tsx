import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { GraduationCap, Sparkles, Star, Zap, Gift, Shield, BookOpen } from "lucide-react";

interface Props {
  onVerifyClick: () => void;
  verificationStatus?: "pending" | "approved" | "rejected" | null;
}

function FloatingParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-blue-400/60"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{ y: [-10, 10, -10], opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.3, 0.8] }}
      transition={{ duration: 3 + delay, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

function SparkleEffect({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute text-yellow-400/70 text-xs select-none pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{ scale: [0, 1.4, 0], rotate: [0, 180, 360], opacity: [0, 1, 0] }}
      transition={{ duration: 2, repeat: Infinity, delay, ease: "easeInOut" }}
    >✦</motion.div>
  );
}

const PARTICLES = [
  { x: 5, y: 20, delay: 0 }, { x: 15, y: 70, delay: 0.5 }, { x: 25, y: 40, delay: 1 },
  { x: 35, y: 80, delay: 0.3 }, { x: 45, y: 15, delay: 0.8 }, { x: 55, y: 55, delay: 1.2 },
  { x: 65, y: 30, delay: 0.6 }, { x: 75, y: 75, delay: 0.1 }, { x: 85, y: 45, delay: 1.5 },
  { x: 92, y: 25, delay: 0.9 }, { x: 10, y: 50, delay: 1.8 }, { x: 80, y: 60, delay: 0.4 },
];
const SPARKLES = [
  { x: 8, y: 30, delay: 0 }, { x: 20, y: 65, delay: 1 }, { x: 50, y: 10, delay: 0.5 },
  { x: 70, y: 85, delay: 1.5 }, { x: 90, y: 40, delay: 0.8 }, { x: 40, y: 90, delay: 1.2 },
];

const BENEFITS = [
  { icon: <Zap className="h-3.5 w-3.5" />, text: "50% OFF All Plans" },
  { icon: <Gift className="h-3.5 w-3.5" />, text: "Bonus Credits" },
  { icon: <GraduationCap className="h-3.5 w-3.5" />, text: "Student Badge" },
  { icon: <Shield className="h-3.5 w-3.5" />, text: "Priority Support" },
  { icon: <BookOpen className="h-3.5 w-3.5" />, text: "Exclusive Templates" },
];

export default function StudentBanner({ onVerifyClick, verificationStatus }: Props) {
  const isPending = verificationStatus === "pending";
  const isApproved = verificationStatus === "approved";
  const isRejected = verificationStatus === "rejected";

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl mb-8 select-none"
    >
      {/* Animated gradient border */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        animate={{
          background: [
            "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)",
            "linear-gradient(180deg, #8b5cf6, #ec4899, #3b82f6, #8b5cf6)",
            "linear-gradient(270deg, #ec4899, #3b82f6, #8b5cf6, #ec4899)",
            "linear-gradient(360deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)",
          ]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        style={{ padding: "2px" }}
      />
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-30"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: "radial-gradient(ellipse at center, rgba(139,92,246,0.5) 0%, transparent 70%)",
          filter: "blur(20px)"
        }}
      />

      {/* Inner content */}
      <div className="relative bg-gradient-to-br from-[#0D0D14] via-[#111120] to-[#0D0D14] border border-purple-500/30 rounded-2xl p-6 overflow-hidden">
        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <FloatingParticle key={i} x={p.x} y={p.y} delay={p.delay} />
        ))}
        {SPARKLES.map((s, i) => (
          <SparkleEffect key={i} x={s.x} y={s.y} delay={s.delay} />
        ))}

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5">
          {/* Icon */}
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40"
          >
            <GraduationCap className="h-8 w-8 text-white" />
          </motion.div>

          {/* Text */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-[11px] font-bold tracking-widest text-yellow-400 uppercase">Student Special Offer</span>
              <Sparkles className="h-4 w-4 text-yellow-400" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Verify Your Student Status</h3>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {BENEFITS.map((b, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 text-[11px] font-medium px-2.5 py-1 rounded-full"
                >
                  <span className="text-blue-400">{b.icon}</span>
                  {b.text}
                </motion.span>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <div className="shrink-0">
            {isApproved ? (
              <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 px-4 py-2.5 rounded-xl text-sm font-bold">
                <Star className="h-4 w-4 fill-emerald-400" />
                Student Verified ✓
              </div>
            ) : isPending ? (
              <div className="flex flex-col items-center gap-1 bg-amber-950/60 border border-amber-500/40 text-amber-400 px-4 py-2.5 rounded-xl text-sm font-bold text-center">
                <span>⏳ Pending Review</span>
                <span className="text-[10px] font-normal text-amber-500/70">We'll notify you soon</span>
              </div>
            ) : isRejected ? (
              <motion.button
                onClick={onVerifyClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all"
              >
                <GraduationCap className="h-4 w-4" />
                Resubmit Verification
              </motion.button>
            ) : (
              <motion.button
                onClick={onVerifyClick}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                className="relative overflow-hidden flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-purple-900/30 transition-all duration-300"
              >
                {/* Shine sweep */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                  animate={{ x: ["-200%", "200%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                />
                <GraduationCap className="h-4 w-4 relative z-10" />
                <span className="relative z-10">Verify Student Status</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
