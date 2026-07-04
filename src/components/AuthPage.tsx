import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, ArrowRight, Lock, Mail, Users, Zap } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { readJsonResponse } from "../lib/apiResponse";

type UserInfo = {
  name: string;
  email: string;
  picture: string;
  googleId: string;
  expiresAt: string;
};

type UserState = {
  credits: number;
  appCreationsCount: number;
  deploymentsCount: number;
  referralCode: string;
  referrals: Array<{ id: string; friend: string; action: string; reward: number; timestamp: string }>;
  plan: string;
  offerRedeemed: boolean;
  offerSignupTime: string | null;
  offerPopupShown: boolean;
  user: UserInfo | null;
};

type AuthPageProps = {
  setUserState: React.Dispatch<React.SetStateAction<UserState>>;
  setActiveGlobalTab: React.Dispatch<React.SetStateAction<"workspace" | "sri-ai" | "pricing" | "referral" | "admin" | "marketplace" | "dashboard">>;
};

const mapSupabaseSessionToUser = (session: any): UserInfo | null => {
  if (!session?.user) return null;
  const user = session.user;
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    picture: user.user_metadata?.avatar_url || "",
    googleId: user.id,
    expiresAt,
  };
};

const AuthPage = ({ setUserState, setActiveGlobalTab }: AuthPageProps) => {
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const updateUserState = async (session: any) => {
    const user = mapSupabaseSessionToUser(session);
    if (!user) return;

    setUserState((prev) => ({
      ...prev,
      user,
    }));

    try {
      const res = await fetch("/api/user-state");
      const data = await readJsonResponse(res);
      if (data && !("error" in data && data.error)) {
        setUserState((prev) => ({
          ...prev,
          ...data,
          user: prev.user || (data as any).user || user,
        }));
      }
    } catch (error) {
      console.warn("Unable to refresh user state after auth", error);
    }

    setActiveGlobalTab("workspace");
  };

  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusMessage(null);

    if (!email || !email.includes("@")) {
      setStatusMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    if (!password) {
      setStatusMessage({ type: "error", text: "Please enter your password." });
      return;
    }

    if (authMode === "signUp" && password !== confirmPassword) {
      setStatusMessage({ type: "error", text: "Passwords do not match. Please check and try again." });
      return;
    }

    setAuthLoading(true);

    try {
      const payload = authMode === "signUp"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (payload.error) {
        throw payload.error;
      }

      if (payload.data?.session) {
        await updateUserState(payload.data.session);
      }

      setStatusMessage({
        type: "success",
        text: authMode === "signUp"
          ? "Account created successfully. Check your inbox for confirmation."
          : "Signed in successfully. Redirecting to your workspace...",
      });
    } catch (error: any) {
      setStatusMessage({ type: "error", text: error?.message || "Authentication failed. Please try again." });
    } finally {
      setAuthLoading(false);
    }
  };

  const authPopupRef = useRef<Window | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (authPopupRef.current && event.source !== authPopupRef.current) return;
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "OAUTH_AUTH_SUCCESS") {
        const user = event.data.user;
        if (user) {
          setUserState((prev) => ({ ...prev, user }));
          setActiveGlobalTab("workspace");
          setStatusMessage({ type: "success", text: "Signed in successfully via Google." });
        }
      }
      if (event.data.type === "OAUTH_AUTH_ERROR") {
        setStatusMessage({ type: "error", text: event.data.error || "Google sign-in failed." });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setActiveGlobalTab, setUserState]);

  const handleGoogleLogin = async () => {
    setStatusMessage(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        const popup = window.open(data.url, "GoogleSignIn", "width=600,height=700");
        if (!popup) {
          throw new Error("Popup blocked. Please allow popups and try again.");
        }
        authPopupRef.current = popup;
        setStatusMessage({ type: "info", text: "Opening Google sign-in in a new window..." });
      } else {
        setStatusMessage({ type: "info", text: "Google sign-in started. Complete the popup to continue." });
      }
    } catch (error: any) {
      setStatusMessage({ type: "error", text: error?.message || "Google sign-in failed. Please try again." });
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email || !email.includes("@")) {
      setStatusMessage({ type: "error", text: "Enter your email first to receive reset instructions." });
      return;
    }

    setAuthLoading(true);
    setStatusMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        throw error;
      }
      setStatusMessage({ type: "success", text: "Password reset link sent. Check your inbox." });
    } catch (error: any) {
      setStatusMessage({ type: "error", text: error?.message || "Unable to send reset link right now." });
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_80%_15%,rgba(168,85,247,0.14),transparent_20%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_18%)] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.1),transparent_22%),radial-gradient(circle_at_15%_75%,rgba(59,130,246,0.08),transparent_24%),radial-gradient(circle_at_90%_50%,rgba(168,85,247,0.07),transparent_24%)]" />

      <main className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.section
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/90 p-10 shadow-[0_40px_120px_rgba(15,23,42,0.55)] backdrop-blur-3xl"
        >
          <div className="absolute -right-16 top-16 h-72 w-72 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/0 blur-3xl" />
          <div className="absolute -left-16 bottom-16 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/0 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.32em] text-slate-200 shadow-[0_15px_60px_rgba(255,255,255,0.04)]">
              <Sparkles className="h-4 w-4 text-sky-300" />
              Aurora authentication
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 via-fuchsia-500 to-cyan-400 shadow-lg shadow-cyan-500/20 animate-[pulse_4s_ease-in-out_infinite]">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.32em] text-sky-300">Trust Me AI Builder</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Modern identity. Safe workspace access.
                </h1>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-7 text-slate-300">
              Access your AI workspace through a polished sign-in experience built with glassmorphism, motion, and smart credential flows for both sign in and sign up.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: <ShieldCheck className="h-5 w-5 text-emerald-300" />, title: "Security-first", detail: "Encrypted sign-in and password recovery." },
                { icon: <Users className="h-5 w-5 text-sky-300" />, title: "Flexible onboarding", detail: "Sign in instantly or create a new account." },
                { icon: <Zap className="h-5 w-5 text-fuchsia-300" />, title: "Smart motion", detail: "Animated auth flow with a luminous brand stage." },
              ].map((item, index) => (
                <div key={index} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 ring-1 ring-white/5 backdrop-blur-xl">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-50 shadow-lg shadow-sky-500/10">
                    {item.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.55)] backdrop-blur-3xl">
            <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-gradient-to-br from-violet-500/20 to-sky-500/0 blur-3xl" />
            <div className="absolute -left-10 bottom-10 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/20 to-emerald-400/0 blur-3xl" />

            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Secure access</span>
                  <h2 className="mt-3 text-3xl font-black text-white">Sign in to your workspace</h2>
                  <p className="mt-2 text-sm text-slate-400">Fast login for returning users, or create a fresh workspace account.</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 to-violet-500 shadow-lg shadow-sky-500/20">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
              </div>

              <div className="relative mb-6 overflow-hidden rounded-full bg-slate-900/70 p-1.5">
                <motion.div
                  animate={{ x: authMode === "signUp" ? "100%" : "0%" }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                />
                <div className="grid grid-cols-2 text-sm uppercase tracking-[0.28em] text-white/70">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signIn")}
                    className="relative z-10 rounded-full py-3 font-semibold transition-colors duration-200"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signUp")}
                    className="relative z-10 rounded-full py-3 font-semibold transition-colors duration-200"
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={authMode}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-5"
                >
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <label className="block text-sm font-semibold text-slate-200">
                      Email
                      <div className="mt-2 rounded-3xl border border-white/10 bg-slate-900/80 p-0.5 shadow-inner shadow-slate-950/20">
                        <div className="flex items-center gap-3 rounded-3xl bg-slate-950/90 px-4 py-3">
                          <Mail className="h-4 w-4 text-sky-300" />
                          <input
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            type="email"
                            placeholder="you@example.com"
                            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                            autoComplete="email"
                          />
                        </div>
                      </div>
                    </label>

                    <label className="block text-sm font-semibold text-slate-200">
                      Password
                      <div className="mt-2 rounded-3xl border border-white/10 bg-slate-900/80 p-0.5 shadow-inner shadow-slate-950/20">
                        <div className="flex items-center gap-3 rounded-3xl bg-slate-950/90 px-4 py-3">
                          <Lock className="h-4 w-4 text-fuchsia-300" />
                          <input
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            type="password"
                            placeholder="Enter your password"
                            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                            autoComplete={authMode === "signUp" ? "new-password" : "current-password"}
                          />
                        </div>
                      </div>
                    </label>

                    {authMode === "signUp" && (
                      <label className="block text-sm font-semibold text-slate-200">
                        Confirm Password
                        <div className="mt-2 rounded-3xl border border-white/10 bg-slate-900/80 p-0.5 shadow-inner shadow-slate-950/20">
                          <div className="flex items-center gap-3 rounded-3xl bg-slate-950/90 px-4 py-3">
                            <Lock className="h-4 w-4 text-slate-300" />
                            <input
                              value={confirmPassword}
                              onChange={(event) => setConfirmPassword(event.target.value)}
                              type="password"
                              placeholder="Repeat your password"
                              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                              autoComplete="new-password"
                            />
                          </div>
                        </div>
                      </label>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {authLoading ? "Processing..." : authMode === "signUp" ? "Create account" : "Sign in"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={authLoading}
                      className="inline-flex w-full items-center justify-center gap-3 rounded-3xl border border-white/10 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                    >
                      <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" className="h-5 w-5" />
                      Continue with Google
                    </button>

                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="text-sm font-medium text-slate-400 transition hover:text-slate-100"
                    >
                      Forgot password?
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {statusMessage && (
                <div className={`rounded-3xl border p-4 text-sm ${
                  statusMessage.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : statusMessage.type === "error"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    : "border-sky-500/20 bg-sky-500/10 text-sky-100"
                }`}>
                  {statusMessage.text}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default AuthPage;
