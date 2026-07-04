import React, { useState } from "react";
import { motion } from "framer-motion";

export default function StudentVerification() {
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/student-verification/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j?.success) setMessage("Submitted for review. We'll notify you when approved."); else setMessage(j.error || "Submission failed");
    } catch (err: any) {
      setMessage(err.message || String(err));
    }
    setSubmitting(false);
  };

  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-4 rounded-xl bg-white/5 glass-shadow">
      <h3 className="text-lg font-bold mb-3">🎓 Student Launch Program</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <input placeholder="Full Name" required onChange={(e) => update("full_name", e.target.value)} className="input" />
        <input placeholder="Registered Email" required onChange={(e) => update("registered_email", e.target.value)} className="input" />
        <input placeholder="Mobile Number" required onChange={(e) => update("mobile_number", e.target.value)} className="input" />
        <input placeholder="College Name" required onChange={(e) => update("college_name", e.target.value)} className="input" />
        <input placeholder="Course" required onChange={(e) => update("course", e.target.value)} className="input" />
        <input placeholder="Year" required onChange={(e) => update("year", e.target.value)} className="input" />

        <div>
          <label className="block mb-1">College ID Front</label>
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const b64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(f);
            });
            update("id_front_base64", b64);
          }} />
        </div>

        <div>
          <label className="block mb-1">College ID Back</label>
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const b64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(f);
            });
            update("id_back_base64", b64);
          }} />
        </div>

        <div>
          <button type="submit" className="btn" disabled={submitting}>{submitting ? "Submitting…" : "Submit for Verification"}</button>
        </div>
      </form>
      {message && <div className="mt-3 text-sm">{message}</div>}
    </motion.div>
  );
}
