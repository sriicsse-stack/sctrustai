import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
// @ts-ignore
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  HelpCircle, 
  Star, 
  ArrowRight, 
  CreditCard, 
  Shield, 
  Volume2, 
  Code, 
  Cpu, 
  TrendingUp, 
  Flame,
  Award,
  Lock,
  ThumbsUp,
  UserCheck,
  Linkedin,
  Twitter,
  Github,
  Quote,
  Globe,
  Users,
  Rocket,
  GraduationCap,
  Settings
} from "lucide-react";
import StudentBanner from "./StudentBanner";
import StudentVerificationModal from "./StudentVerificationModal";
import StudentApprovedScreen from "./StudentApprovedScreen";
import AdminVerificationDashboard from "./AdminVerificationDashboard";
import { supabase, StudentVerification } from "../lib/supabaseClient";
import { safeInvoke, isInvokeSuccess } from "../lib/safeInvoke";

interface PricingPageProps {
  currentPlan: string;
  onSelectPlan: (plan: string, info: { credits: number; isUnlimited: boolean; isOfferRedeemed?: boolean }) => void;
  offerActive?: boolean;
  offerTimeLeftStr?: string;
  claimOfferTriggered?: boolean;
  onCloseClaimOfferTrigger?: () => void;
  userId?: string;
}

// Student discount map: plan name → [original, student price, savings]
const STUDENT_PRICES: Record<string, { original: string; student: string; save: string }> = {
  Basic:    { original: "₹299",   student: "₹149",   save: "₹150" },
  Medium:   { original: "₹999",   student: "₹499",   save: "₹500" },
  Gold:     { original: "₹1,999", student: "₹999",   save: "₹1,000" },
  Platinum: { original: "₹4,999", student: "₹2,499", save: "₹2,500" },
};

export default function PricingPage({ 
  currentPlan, 
  onSelectPlan,
  offerActive = false,
  offerTimeLeftStr = "24:00:00",
  claimOfferTriggered = false,
  onCloseClaimOfferTrigger,
  userId = "guest_" + (typeof window !== "undefined" ? (localStorage.getItem("tmab_uid") || (() => { const id = Math.random().toString(36).slice(2); localStorage.setItem("tmab_uid", id); return id; })()) : "anon")
}: PricingPageProps) {
  // Countdown Timer state: 23:59:59
  const [secondsLeft, setSecondsLeft] = useState(23 * 3600 + 59 * 60 + 59);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Student verification states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showApprovedScreen, setShowApprovedScreen] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [studentRecord, setStudentRecord] = useState<StudentVerification | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);

  const verificationStatus = studentRecord?.verification_status || studentRecord?.status;
  const isStudentApproved = verificationStatus === "approved";
  const isStudentPending = verificationStatus === "pending";
  const isStudentRejected = verificationStatus === "rejected";

  // Load existing student verification for this user
  useEffect(() => {
    const loadStudentRecord = async () => {
      setStudentLoading(true);
      const { data } = await supabase
        .from("student_verifications")
        .select("*")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setStudentRecord(data || null);
      setStudentLoading(false);
    };
    loadStudentRecord();
  }, [userId]);

  const handleVerificationSubmitted = async () => {
    setShowVerifyModal(false);
    // Reload record
    const { data } = await supabase
      .from("student_verifications")
      .select("*")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setStudentRecord(data || null);
  };
  
  // Razorpay checkout state
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<{
    name: string;
    price: string;
    credits: number;
    isUnlimited: boolean;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [checkoutError, setCheckoutError] = useState<string>("");
  const [receipt, setReceipt] = useState<{
    paymentId: string; orderId: string; plan: string; credits: number;
    amount: number; paidAt: string; receiptNumber: string;
  } | null>(null);

  useEffect(() => {
    if (claimOfferTriggered && offerActive) {
      handlePlanClick("Basic", "₹299", 25, false);
      if (onCloseClaimOfferTrigger) {
        onCloseClaimOfferTrigger();
      }
    }
  }, [claimOfferTriggered, offerActive, onCloseClaimOfferTrigger]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) return 23 * 3600 + 59 * 60 + 59; // reset to 24h
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlanClick = (planName: string, price: string, credits: number, isUnlimited: boolean) => {
    setSelectedUpgradePlan({ name: planName, price, credits, isUnlimited });
    setCheckoutStep("idle");
    setCheckoutError("");
    setReceipt(null);
  };

  // Load Razorpay SDK dynamically (no static script tag needed)
  const loadRazorpayScript = (): Promise<boolean> =>
    new Promise(resolve => {
      if ((window as any).Razorpay) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleRazorpayPayment = async () => {
    if (!selectedUpgradePlan) return;

    setIsProcessing(true);
    setCheckoutError("");
    setCheckoutStep("processing");

    // Step 1: Load Razorpay SDK
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setCheckoutError("Razorpay SDK failed to load. Please check your internet connection.");
      setCheckoutStep("error");
      setIsProcessing(false);
      return;
    }

    // Step 2: Create order on backend (server sets amount authoritatively)
    let orderData: any;
    try {
      const response = await safeInvoke(supabase, "razorpay-order", {
        body: {
          planName: selectedUpgradePlan.name,
          userId,
          isStudent: isStudentApproved,
        },
      });
      if (!isInvokeSuccess(response)) {
        throw new Error(response.error?.message || "Failed to create payment order.");
      }
      orderData = response.data;
    } catch (err: any) {
      setCheckoutError(err?.message || "Failed to create payment order. Please try again.");
      setCheckoutStep("error");
      setIsProcessing(false);
      return;
    }

    // Step 3: Open Razorpay Checkout with server-issued order
    setCheckoutStep("idle"); // hide our modal while Razorpay native UI is open
    const rzp = new (window as any).Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      name: "Trust Me AI Builder",
      description: `${selectedUpgradePlan.name} Plan — ${orderData.credits} Credits`,
      theme: { color: "#6366f1" },
      prefill: { name: "", email: "", contact: "" },
      handler: async (response: any) => {
        // Step 4: Verify signature on backend — NEVER trust client-side success alone
        setIsProcessing(true);
        setCheckoutStep("processing");
        try {
          const verifyResponse = await safeInvoke(supabase, "razorpay-verify", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId,
              planName: selectedUpgradePlan.name,
            },
          });
          if (!isInvokeSuccess(verifyResponse)) {
            throw new Error(verifyResponse.error?.message || "Payment verification failed.");
          }
          const verifyData = verifyResponse.data;

          // Step 5: Update local state + save receipt
          setReceipt({
            paymentId:     response.razorpay_payment_id,
            orderId:       response.razorpay_order_id,
            plan:          verifyData.planName,
            credits:       verifyData.creditsAdded,
            amount:        orderData.amount / 100,
            paidAt:        verifyData.paidAt,
            receiptNumber: verifyData.receiptNumber,
          });
          setCheckoutStep("success");
          onSelectPlan(verifyData.planName, {
            credits: verifyData.creditsAdded,
            isUnlimited: selectedUpgradePlan.isUnlimited,
            isOfferRedeemed: offerActive && selectedUpgradePlan.name === "Basic",
          });
        } catch (err: any) {
          setCheckoutError(err?.message || "Payment verification failed. Contact support with your payment ID.");
          setCheckoutStep("error");
        } finally {
          setIsProcessing(false);
        }
      },
      modal: {
        ondismiss: () => {
          setIsProcessing(false);
          setCheckoutStep("idle");
        },
      },
    });
    rzp.on("payment.failed", (resp: any) => {
      setCheckoutError(`Payment failed: ${resp.error?.description || "Unknown error"}`);
      setCheckoutStep("error");
      setIsProcessing(false);
    });
    rzp.open();
  };

  const plans = [
    {
      name: "Basic",
      price: offerActive ? "₹299" : "₹499",
      originalPrice: offerActive ? "₹499" : null,
      period: "month",
      desc: "Perfect for students and beginners.",
      credits: 25,
      isUnlimited: false,
      badge: offerActive ? "🔥 First-Time User Exclusive" : null,
      gradient: offerActive ? "from-red-600/20 via-blue-600/10 to-purple-600/20" : "from-blue-600/20 to-sky-500/20",
      buttonText: offerActive ? "Claim Welcome Offer" : "Start Building",
      icon: Code,
      features: [
        "25 App Creations",
        "5 Live Deployments",
        "Sri AI Assistant",
        "App Preview Links",
        "Basic Support",
        ...(offerActive ? [
          "🎉 Save ₹200 (Limited Time Offer)",
          "⚡ First-Time Users Only"
        ] : [])
      ]
    },
    {
      name: "Medium",
      price: "₹999",
      period: "month",
      desc: "Ideal for power creators and professional developers.",
      credits: 100,
      isUnlimited: false,
      badge: "⭐ MOST POPULAR",
      gradient: "from-indigo-600/30 via-purple-600/30 to-pink-500/20",
      buttonText: "Upgrade Now",
      icon: Zap,
      features: [
        "100 App Creations",
        "20 Live Deployments",
        "Voice AI Assistant",
        "Image Upload",
        "PDF Analysis",
        "Faster Build Queue",
        "Priority Support"
      ]
    },
    {
      name: "Gold",
      price: "₹1,999",
      period: "month",
      desc: "Scale your startup MVP with self-healing deployments.",
      credits: 300,
      isUnlimited: false,
      badge: "PRIME GOLD",
      gradient: "from-amber-600/25 to-yellow-500/20",
      buttonText: "Go Gold",
      icon: Award,
      features: [
        "300 App Creations",
        "75 Live Deployments",
        "Advanced Sri AI",
        "Auto Error Fixing",
        "Build Analytics",
        "Priority Build Processing",
        "Premium Voice Mode"
      ]
    },
    {
      name: "Platinum",
      price: "₹4,999",
      period: "month",
      desc: "Ultimate authority tier for teams and scaling agency workflows.",
      credits: 9999,
      isUnlimited: true,
      badge: "ULTIMATE PLATINUM",
      gradient: "from-teal-600/30 to-emerald-500/20",
      buttonText: "Become Platinum",
      icon: Cpu,
      features: [
        "Unlimited App Creations",
        "Unlimited Deployments",
        "Custom Domains",
        "Team Collaboration",
        "Dedicated Hosting",
        "VIP Support",
        "Fastest AI Infrastructure",
        "Early Access Features"
      ]
    }
  ];

  const testimonials = [
    {
      text: "Built my startup MVP in 2 hours. The speed of iteration and Sri AI context-sharing is wild.",
      author: "Charu Sri",
      role: "Founder, SC Tech",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80"
    },
    {
      text: "Better than hiring freelancers. I speak Tanglish and English, and it writes correct code and triggers automatic deployments in 1-click.",
      author: "Rohan Das",
      role: "Solo Indie Hacker",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80"
    },
    {
      text: "Deployment worked instantly. Best SaaS builder with natural Voice Assistant loop support.",
      author: "Priya Nair",
      role: "Product Designer",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80"
    }
  ];

  const faqs = [
    {
      q: "Do I need coding knowledge?",
      a: "Absolutely not! Trust Me AI Builder is designed as a zero-code-required system. You speak or type your ideas, and let Sri AI lay out full database tables, API proxies, and client-side code automatically."
    },
    {
      q: "Can I deploy apps?",
      a: "Yes! Deployments are integrated into your dashboard. Every plan includes instant sandboxed preview links and production deployments hosted on fast, edge-optimized Cloud Run containers."
    },
    {
      q: "Does Voice AI support Tamil?",
      a: "Yes, fully! Sri AI is trained to understand bilingual and single-language voice signals including Tamil, English, Tanglish, Hindi, Telugu, Malayalam, and Kannada with natural speech output."
    },
    {
      q: "Can I upgrade or downgrade later?",
      a: "Of course. You can switch plans instantly in your billing section or upgrade right here on this page to unlock wider credit pools and faster queue processing sizes."
    },
    {
      q: "Is there an offline mode support?",
      a: "Yes, our preview works 100% in-browser with automated local compilation backups, ensuring you never lose your progress during active connectivity drops."
    }
  ];

  return (
    <div id="saas-pricing-viewport" className="flex-1 bg-[#050507] text-white overflow-y-auto px-6 py-12 relative select-none scrollbar-thin">
      {/* Decorative Blur Background Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Student Verification Modal */}
      <AnimatePresence>
        {showVerifyModal && (
          <StudentVerificationModal
            userId={userId}
            onClose={() => setShowVerifyModal(false)}
            onSubmitted={handleVerificationSubmitted}
          />
        )}
      </AnimatePresence>

      {/* Approved Success Screen */}
      <AnimatePresence>
        {showApprovedScreen && (
          <StudentApprovedScreen
            bonusCredits={studentRecord?.bonus_credits ?? 100}
            discountPercentage={studentRecord?.discount_percentage ?? 50}
            onClose={() => setShowApprovedScreen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-16 relative">
        
        {/* PREMIUM TOP SECTION */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-950/80 to-purple-950/80 border border-blue-900/30 rounded-full text-xs font-bold text-blue-400">
            <Sparkles className="h-3 w-3 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />
            <span>Secure Premium Access Tiers</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white flex flex-col items-center justify-center gap-4 text-center">
            {/* Majestic Centered Rocket Badge with Premium Particles */}
            <span className="relative inline-flex items-center justify-center shrink-0 p-1 mb-1">
              <span className="absolute -inset-3 bg-indigo-500/25 rounded-full blur-lg opacity-80 animate-pulse" />
              <Rocket className="h-11 w-11 text-white shrink-0 -rotate-45 transform hover:scale-110 transition-all duration-500 animate-bounce relative" style={{ animationDuration: "3.5s" }} />
              {/* Sparkle star particles exactly matching the premium workspace aesthetic */}
              <span className="absolute -top-2 -left-2 text-[10px] animate-pulse text-amber-300">★</span>
              <span className="absolute -bottom-1.5 -right-1.5 text-[11px] animate-pulse text-indigo-200">✦</span>
              <span className="absolute top-2.5 -right-3 text-[8px] animate-ping text-blue-200">★</span>
            </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400">
              Build Any App From a Prompt
            </span>
          </h1>
          
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Turn your ideas into real websites and applications with AI. Generate, preview, deploy, and share in minutes.
          </p>

          {/* Core Trust Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 max-w-4xl mx-auto">
            {[
              { label: "10,000+ Apps Generated", icon: ShieldCheck },
              { label: "AI-Powered Development", icon: Cpu },
              { label: "Voice Assistant Included", icon: Volume2 },
              { label: "No Coding Required", icon: Code }
            ].map((indicator, index) => (
              <div 
                key={index} 
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm shadow-sm"
              >
                <indicator.icon className="h-4 w-4 text-indigo-400" />
                <span className="text-[11px] font-bold text-slate-200">{indicator.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* STUDENT VERIFICATION BANNER */}
        {!studentLoading && (
          <StudentBanner
            onVerifyClick={() => setShowVerifyModal(true)}
            verificationStatus={verificationStatus || null}
          />
        )}

        {/* Admin toggle (subtle, for admins) */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowAdminDashboard(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded"
          >
            <Settings className="h-3 w-3" />
            {showAdminDashboard ? "Hide Admin Panel" : "Admin Panel"}
          </button>
        </div>

        {/* Admin Dashboard */}
        <AnimatePresence>
          {showAdminDashboard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-8"
            >
              <AdminVerificationDashboard />
            </motion.div>
          )}
        </AnimatePresence>

        {/* HIGH-CONVERTING LIMITED TIME OFFER BANNER */}
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-slate-900/40 border border-purple-500/30 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-purple-900/5 backdrop-blur-md">
            <div className="absolute top-0 right-1/4 w-32 h-32 bg-purple-500/20 blur-2xl pointer-events-none" />
            
            <div className="space-y-2 text-center md:text-left z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-950/60 border border-red-900/40 rounded text-red-400 text-[10px] font-mono font-bold uppercase animate-pulse">
                <Flame className="h-3 w-3 fill-red-500" />
                <span>{offerActive ? "🔥 FIRST-TIME USER EXCLUSIVE" : "Launch Offer - Save 40% Today"}</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">
                {offerActive ? "🎉 Claim First-Time Builder Discount - Save ₹200!" : "Join now and lock in launch pricing forever."}
              </h3>
              <p className="text-xs text-slate-400">
                {offerActive 
                  ? "Get your Basic Plan unlocked at ₹299 instead of ₹499. Save ₹200 today! Limited Time Offer, First-Time Users Only."
                  : "Activate any premium account today and get lifetime immunity from future subscription price hikes!"}
              </p>
            </div>
 
            <div className="bg-[#0D0D11]/90 border border-purple-500/20 p-4 rounded-xl text-center shrink-0 min-w-[200px] z-10 shadow-lg">
              <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider block mb-1">
                ⏰ Offer expires in
              </span>
              <span className="text-xl font-black font-mono tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-amber-300 to-amber-400">
                {offerActive ? offerTimeLeftStr : formatTime(secondsLeft)}
              </span>
              <div className="h-px bg-slate-800 my-2" />
              <span className="text-[9px] text-emerald-400 font-bold block animate-pulse">
                {offerActive ? "🎁 ₹200 INSTANT DISCOUNT" : "🟢 Free Setup • Cancel Anytime"}
              </span>
            </div>
          </div>
        </div>

        {/* PRICING PLANS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch select-none">
          {plans.map((plan, idx) => {
            const isPlanActive = currentPlan === plan.name;
            const isMedium = plan.name === "Medium";
            const GraphicIcon = plan.icon;
            const sp = isStudentApproved ? STUDENT_PRICES[plan.name] : null;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.4 }}
                whileHover={{ scale: 1.025, rotateY: 2, rotateX: -1 }}
                style={{ perspective: 800 }}
                className={`group relative rounded-2xl bg-gradient-to-b ${plan.gradient} border ${
                  isMedium ? "border-purple-500/50" : isPlanActive ? "border-blue-500/50" : sp ? "border-purple-500/40" : "border-slate-800/80"
                } bg-[#0A0A0C]/90 p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl shadow-slate-950/50 overflow-hidden ${
                  isMedium ? "shadow-lg shadow-purple-900/10" : ""
                } ${sp ? "ring-1 ring-purple-500/20" : ""}`}
              >
                {/* Shimmer on student cards */}
                {sp && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent skew-x-12 pointer-events-none"
                    animate={{ x: ["-200%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
                  />
                )}

                {/* Decorative glow inside card */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] group-hover:bg-indigo-500/5 rounded-full blur-xl pointer-events-none transition-colors" />

                {/* Student badge */}
                {sp && (
                  <motion.div
                    animate={{ boxShadow: ["0 0 0px rgba(139,92,246,0)", "0 0 12px rgba(139,92,246,0.5)", "0 0 0px rgba(139,92,246,0)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-3 left-3 flex items-center gap-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full uppercase"
                  >
                    <GraduationCap className="h-2.5 w-2.5" />
                    Student Offer
                  </motion.div>
                )}

                {/* Popularity or Tier badges */}
                {plan.badge && (
                  <div className={`absolute ${sp ? "top-3 right-3" : "top-3 right-3"}`}>
                    <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded uppercase font-mono ${
                      isMedium ? "bg-purple-600/90 text-white shadow" : "bg-slate-800 text-slate-300"
                    }`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Card Header */}
                <div className={`space-y-4 ${sp ? "mt-5" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-white/[0.04] border border-white/[0.05] group-hover:border-indigo-500/30 transition-colors ${
                      isMedium ? "text-purple-400" : "text-blue-400"
                    }`}>
                      <GraphicIcon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-slate-300 group-hover:text-white transition-colors">
                      {plan.name} Plan
                    </span>
                  </div>

                  <div>
                    {sp ? (
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <motion.span
                            key={sp.student}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className="text-3xl font-extrabold tracking-tight text-purple-300"
                          >
                            {sp.student}
                          </motion.span>
                          <span className="text-sm text-slate-500 line-through">{sp.original}</span>
                          <span className="text-xs text-slate-500 font-mono">/{plan.period}</span>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-semibold">You Save {sp.save} 🎓</p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold tracking-tight text-white mb-0.5">{plan.price}</span>
                        {(plan as any).originalPrice && (
                          <span className="text-xs text-red-500 font-semibold line-through ml-1.5 my-auto">{(plan as any).originalPrice}</span>
                        )}
                        <span className="text-xs text-slate-500 font-mono">/{plan.period}</span>
                      </div>
                    )}
                    <p className="text-[11.5px] text-slate-400 font-sans leading-normal h-8 mt-1 border-b border-white/[0.03] pb-2.5">
                      {plan.desc}
                    </p>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-2 pt-2 text-left">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 bg-blue-900/20 rounded-full border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Check className="h-2.5 w-2.5 text-blue-400 font-bold" />
                        </div>
                        <span className="text-[11.5px] text-slate-300 font-medium group-hover:text-slate-100 transition-colors">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action button */}
                <div className="pt-6">
                  <button
                    onClick={() => handlePlanClick(plan.name, sp ? sp.student : plan.price, plan.credits, plan.isUnlimited)}
                    disabled={isPlanActive}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
                      isPlanActive
                        ? "bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 cursor-not-allowed"
                        : sp
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-md shadow-purple-950/50"
                        : isMedium
                        ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-md shadow-indigo-950/50 hover:shadow-indigo-500/25"
                        : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.05] hover:border-slate-700"
                    }`}
                  >
                    {isPlanActive ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Active Subscription</span>
                      </>
                    ) : sp ? (
                      <>
                        <GraduationCap className="h-3.5 w-3.5" />
                        <span>Get Student Price</span>
                      </>
                    ) : (
                      <>
                        <span>{plan.buttonText}</span>
                        <ArrowRight className="h-3 w-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* PREMIUM FOUNDER SPOTLIGHT SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8 pt-12 border-t border-white/[0.02]"
        >
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Message from the Founder
            </h2>
            <p className="text-xs md:text-sm text-slate-400 font-medium">
              The vision and mission behind Trust Me AI Builder
            </p>
          </div>

          <div className="bg-[#0b0c10]/70 border border-white/[0.05] rounded-3xl p-6 md:p-10 max-w-5xl mx-auto backdrop-blur-xl relative overflow-hidden shadow-2xl shadow-indigo-950/20 group hover:border-slate-800 transition-all duration-500">
            {/* Background ambient radial glow colors */}
            <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
              
              {/* Left Column: Authentic Founder Portrait Card */}
              <div className="lg:col-span-4 flex flex-col items-center text-center space-y-5">
                
                {/* Image Container with high-fidelity glow aura */}
                <div className="relative group/avatar">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 opacity-60 blur-md group-hover/avatar:opacity-100 transition-all duration-750 group-hover/avatar:scale-105" />
                  <div className="relative rounded-full p-[2px] bg-slate-950 overflow-hidden w-44 h-44 md:w-52 md:h-52">
                    <img 
                      src="https://miaoda-conversation-file.s3cdn.medo.dev/user-85ne2d90sv0g/app-cnl3z6hzzs3l/20260629/Screenshot_20260629_094638.jpg"
                      alt="Sridharan S C" 
                      className="w-full h-full object-cover rounded-full transition-transform duration-700 group-hover/avatar:scale-102"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  {/* Verified Founder Badge pill overlay */}
                  <div className="absolute -bottom-2 -left-3 bg-[#0a0b10]/95 border border-white/[0.08] rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-xl backdrop-blur-md">
                    <div className="h-5.5 w-5.5 bg-blue-500/15 rounded-lg flex items-center justify-center shrink-0 border border-blue-500/30">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-400 font-bold" />
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-[9px] font-bold text-white leading-none">Verified Founder</p>
                      <p className="text-[7.5px] text-slate-400 leading-none mt-0.5">Identity Verified</p>
                    </div>
                  </div>
                </div>

                {/* Founder Professional Details */}
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-slate-100 leading-tight">
                    Sridharan S C
                  </h3>
                  <p className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Founder & CEO
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Trust Me AI Builder
                  </p>
                </div>

                {/* Secure Social Connects */}
                <div className="flex items-center gap-2.5 pt-1">
                  <a 
                    href="https://linkedin.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="p-2 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-300"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                  </a>
                  <a 
                    href="https://twitter.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="p-2 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 transition-all duration-300"
                  >
                    <Twitter className="h-3.5 w-3.5" />
                  </a>
                  <a 
                    href="https://github.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="p-2 bg-white/[0.02] border border-white/[0.05] rounded-xl text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    <Github className="h-3.5 w-3.5" />
                  </a>
                </div>

              </div>
              
              {/* Right Column: Narrative Message & Blockquote */}
              <div className="lg:col-span-8 space-y-5 md:space-y-6">
                
                {/* Real-time rating status bar */}
                <div className="flex items-center gap-2 md:gap-3 bg-white/[0.02] border border-white/[0.05] py-1.5 px-3.5 rounded-full w-fit">
                  <div className="flex gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <span className="text-xs font-black text-slate-200">5.0</span>
                  <span className="h-3.5 w-px bg-white/[0.08]" />
                  <span className="text-[10.5px] text-slate-450 font-mono font-medium">From 100+ Creator Reviews</span>
                </div>

                {/* Text Description */}
                <div className="space-y-4 text-[12.5px] md:text-[13.5px] leading-relaxed text-slate-300 font-sans tracking-wide">
                  <p>
                    <span className="font-extrabold text-blue-400">Trust Me AI Builder</span> was founded with a vision to make software creation accessible to everyone. We believe innovation should not be limited by technical barriers. By combining advanced AI, intelligent automation, and seamless deployment, our platform empowers creators, students, startups, and businesses to transform ideas into real-world applications faster than ever before.
                  </p>
                  <p>
                    Our mission is simple: help anyone build, launch, and scale digital products with confidence. Every feature in Trust Me AI Builder is designed to simplify development, accelerate innovation, and unlock new opportunities for the next generation of creators.
                  </p>
                </div>

                {/* Styled Quote Box */}
                <div className="p-4 md:p-5 rounded-2xl bg-indigo-950/15 border border-indigo-500/10 relative shadow-inner overflow-hidden">
                  <div className="absolute top-2 left-2 text-indigo-500/10 pointer-events-none">
                    <Quote className="h-10 w-10 transform -rotate-12" />
                  </div>
                  <p className="text-[12.5px] md:text-xs text-indigo-250 italic leading-relaxed pl-5 relative z-10">
                    "The future belongs to those who can turn ideas into reality quickly. Trust Me AI Builder is built to make that future accessible to everyone."
                  </p>
                  <div className="mt-2.5 text-right font-sans">
                    <span className="text-[11px] font-bold text-indigo-400">— Sridharan S C</span>
                    <span className="text-[9.5px] text-slate-500 font-mono block">Founder & CEO</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Highlights Row */}
            <div className="mt-8 pt-6 border-t border-white/[0.03] grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-xl hover:bg-white/[0.01] transition-all">
                <div className="flex items-center justify-center gap-1 text-amber-400 mb-0.5">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs md:text-sm font-bold text-slate-200">Ideas to Apps</span>
                </div>
                <p className="text-[10px] text-slate-550 font-mono">In Minutes</p>
              </div>

              <div className="p-3 rounded-xl hover:bg-white/[0.01] transition-all">
                <div className="flex items-center justify-center gap-1 text-blue-400 mb-0.5">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs md:text-sm font-bold text-slate-200">10K+</span>
                </div>
                <p className="text-[10px] text-slate-550 font-mono">Active Creators</p>
              </div>

              <div className="p-3 rounded-xl hover:bg-white/[0.01] transition-all">
                <div className="flex items-center justify-center gap-1 text-emerald-400 mb-0.5">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="text-xs md:text-sm font-bold text-slate-200">150+</span>
                </div>
                <p className="text-[10px] text-slate-550 font-mono">Countries</p>
              </div>

              <div className="p-3 rounded-xl hover:bg-white/[0.01] transition-all">
                <div className="flex items-center justify-center gap-1 text-indigo-400 mb-0.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="text-xs md:text-sm font-bold text-slate-200">99.9%</span>
                </div>
                <p className="text-[10px] text-slate-550 font-mono">Uptime & Reliable</p>
              </div>
            </div>

          </div>
        </motion.div>

        {/* FAQ ACCORDION SECTION */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold text-slate-200">Frequently Asked Questions</h3>
            <p className="text-xs text-slate-500 font-mono">Everything you need to raise compile speeds</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index} 
                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full text-left px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/[0.01] transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                      {faq.q}
                    </span>
                    <span className="text-slate-500 font-mono font-bold text-xs">
                      {isOpen ? "[-]" : "[+]"}
                    </span>
                  </button>
                  
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="px-5 pb-4 text-[11.5px] text-slate-400 leading-relaxed font-sans mt-1">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM CTA JUMBOTRON */}
        <div className="text-center bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/20 border border-slate-800 rounded-3xl p-8 md:p-12 relative overflow-hidden max-w-4xl mx-auto shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-3xl pointer-events-none" />
          
          <div className="max-w-xl mx-auto space-y-5 z-10 relative">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white font-sans">
              Start Building Your Next Big Idea Today
            </h2>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-sans">
              Thousands of creators are already building with Trust Me AI Builder. Experience fast compilation sandboxes and instant production hosting.
            </p>
            <div className="pt-3">
              <button 
                onClick={() => handlePlanClick("Medium", "₹999", 100, false)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg hover:shadow-indigo-500/20 cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
              >
                <span>🚀 Start Free Trial</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Credit card not required to lock in trial tiers. Unlimited scaling deployments available.
            </p>
          </div>
        </div>

      </div>

      {/* RAZORPAY CHECKOUT MODAL */}
      <AnimatePresence>
        {selectedUpgradePlan && (checkoutStep === "processing" || checkoutStep === "success" || checkoutStep === "error") && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[110] p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0A0A0C] border border-slate-800 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative"
            >
              {/* Processing */}
              {checkoutStep === "processing" && (
                <div className="p-12 text-center space-y-4">
                  <div className="h-10 w-10 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                  <h4 className="text-sm font-bold text-slate-200">Verifying Payment…</h4>
                  <p className="text-xs text-slate-500 font-mono">Confirming with Razorpay servers</p>
                </div>
              )}

              {/* Success with receipt */}
              {checkoutStep === "success" && receipt && (
                <div className="p-8 text-center space-y-4">
                  <div className="h-12 w-12 bg-emerald-950 border border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white">Payment Successful!</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">
                      Welcome to <strong className="text-indigo-400">{receipt.plan} Plan</strong>
                    </p>
                  </div>

                  {/* Receipt card */}
                  <div className="bg-[#111117] border border-slate-700 rounded-xl p-4 text-left space-y-2 font-mono text-[11px]">
                    <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-2">Payment Receipt</div>
                    <div className="flex justify-between"><span className="text-slate-500">Plan</span><span className="text-white font-bold">{receipt.plan}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Credits Added</span><span className="text-amber-400 font-bold">+{receipt.credits} cr</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Amount Paid</span><span className="text-emerald-400 font-bold">₹{receipt.amount}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Payment ID</span><span className="text-slate-300 text-[10px] truncate max-w-[180px]">{receipt.paymentId}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Receipt No.</span><span className="text-slate-300">{receipt.receiptNumber}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-300">{new Date(receipt.paidAt).toLocaleString()}</span></div>
                  </div>

                  <button
                    onClick={() => setSelectedUpgradePlan(null)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Start Building on {receipt.plan} →
                  </button>
                </div>
              )}

              {/* Error state */}
              {checkoutStep === "error" && (
                <div className="p-8 text-center space-y-4">
                  <div className="h-12 w-12 bg-red-950 border border-red-700 rounded-full flex items-center justify-center mx-auto text-red-400">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">Payment Failed</h4>
                    <p className="text-xs text-red-400 mt-2 font-mono break-words">{checkoutError}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setCheckoutStep("idle"); setCheckoutError(""); }}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRazorpayPayment}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ArrowRight className="h-3 w-3" /> Retry Payment
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Plan selection confirmation modal (shown when user clicks a plan, before Razorpay opens) */}
      <AnimatePresence>
        {selectedUpgradePlan && checkoutStep === "idle" && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[110] p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0A0A0C] border border-slate-800 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest font-mono text-slate-200">
                      Secure Checkout · Razorpay
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedUpgradePlan(null)}
                    className="text-xs text-slate-500 hover:text-white font-bold font-mono cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                </div>

                {/* Order summary */}
                <div className="bg-[#121217] p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Plan</span>
                    <strong className="text-sm font-extrabold text-white">{selectedUpgradePlan.name}</strong>
                    <div className="text-[10px] text-indigo-300 mt-0.5">{selectedUpgradePlan.credits} Credits{selectedUpgradePlan.isUnlimited ? " (Unlimited)" : ""}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Amount</span>
                    <strong className="text-sm font-mono text-emerald-400 font-extrabold">
                      {isStudentApproved
                        ? ({ Basic:"₹149", Medium:"₹499", Gold:"₹999", Platinum:"₹2,499" }[selectedUpgradePlan.name] ?? selectedUpgradePlan.price)
                        : selectedUpgradePlan.price}
                      /mo
                    </strong>
                    {isStudentApproved && <div className="text-[10px] text-amber-400 mt-0.5">🎓 Student Price</div>}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>You will be redirected to Razorpay's secure checkout. Pay with UPI, cards, net banking, or wallets. Your card details are never stored on our servers.</span>
                </div>

                <div className="pt-2 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono">
                    <Lock className="h-3 w-3" />
                    <span>256-bit SSL · PCI-DSS</span>
                  </div>
                  <button
                    onClick={handleRazorpayPayment}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    {isProcessing ? (
                      <><div className="h-3.5 w-3.5 border border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
                    ) : (
                      <><CreditCard className="h-3.5 w-3.5" /> Pay with Razorpay</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
