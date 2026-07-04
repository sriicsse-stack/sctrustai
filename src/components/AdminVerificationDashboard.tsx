import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, CheckCircle2, XCircle, Eye, Clock, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase, StudentVerification } from "../lib/supabaseClient";

const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || "";

export default function AdminVerificationDashboard() {
  const [records, setRecords] = useState<StudentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_verifications")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50);
    setRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (record: StudentVerification, status: "approved" | "rejected") => {
    const id = record.id!;
    const isApprove = status === "approved";
    setProcessing(id);
    const bonusCredits = isApprove ? (credits[id] ?? 100) : 0;
    const discountPercentage = isApprove ? (discount[id] ?? 50) : 0;
    const reviewNotes = notes[id] || null;
    const rejectionReason = status === "rejected" ? (notes[id] || "Verification rejected by admin.") : null;
    await supabase.from("student_verifications").update({
      verification_status: status,
      status: status,
      reviewer_notes: reviewNotes,
      rejection_reason: rejectionReason,
      approved_by: isApprove ? "admin" : null,
      approved_at: isApprove ? new Date().toISOString() : null,
      bonus_credits: bonusCredits,
      discount_percentage: discountPercentage,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    if (isApprove && record.user_id) {
      const profile = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", record.user_id)
        .single();
      if (profile.data) {
        await supabase.from("profiles").update({
          credits: (profile.data.credits || 0) + bonusCredits,
          student_discount_active: true,
          student_status: "approved",
        }).eq("id", record.user_id);
      }
    }

    if (!isApprove && record.user_id) {
      await supabase.from("profiles").update({
        student_discount_active: false,
        student_status: "rejected",
      }).eq("id", record.user_id);
    }

    await load();
    setProcessing(null);
  };

  const statusBadge = (s?: string) => {
    if (s === "approved") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-700/40">APPROVED</span>;
    if (s === "rejected") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-700/40">REJECTED</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-700/40">PENDING</span>;
  };

  return (
    <div className="bg-[#0D0D10] border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-400" />
          <h2 className="text-white font-bold text-lg">Student Verification Admin</h2>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm px-3 py-1.5 bg-slate-800 rounded-lg transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading submissions...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-10 text-slate-500">No submissions yet</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpanded(expanded === r.id ? null : r.id!)}
              >
                <div className="flex items-center gap-3">
                  {statusBadge(r.verification_status || r.status)}
                  <div>
                    <p className="text-white text-sm font-semibold">{r.full_name}</p>
                    <p className="text-slate-400 text-xs">{r.college_name} · {r.department} · {r.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs hidden sm:block">
                    {new Date(r.submitted_at || r.created_at).toLocaleDateString()}
                  </span>
                  {expanded === r.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {expanded === r.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-slate-800"
                  >
                    <div className="p-4 space-y-4">
                      {/* Info grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        {[
                          ["Email", r.college_email], ["Mobile", r.mobile_number],
                          ["Student ID", r.student_id], ["Year", r.year],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-slate-900/60 rounded-lg p-2.5">
                            <p className="text-slate-500 mb-0.5">{k}</p>
                            <p className="text-white font-medium truncate">{v}</p>
                          </div>
                        ))}
                      </div>

                      {/* Document links */}
                      <div className="flex flex-wrap gap-2">
                        {r.id_card_front_url && <a href={r.id_card_front_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-800/30 px-3 py-1.5 rounded-lg transition-colors"><Eye className="h-3 w-3" />ID Front</a>}
                        {r.id_card_back_url && <a href={r.id_card_back_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-800/30 px-3 py-1.5 rounded-lg transition-colors"><Eye className="h-3 w-3" />ID Back</a>}
                        {r.document_url && <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-800/30 px-3 py-1.5 rounded-lg transition-colors"><Eye className="h-3 w-3" />Support Doc</a>}
                      </div>

                      {/* Admin controls */}
                      {(r.verification_status || r.status) === "pending" && (
                        <div className="space-y-3 pt-2 border-t border-slate-800">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Bonus Credits</label>
                              <input
                                type="number"
                                value={credits[r.id!] ?? 100}
                                onChange={e => setCredits(p => ({ ...p, [r.id!]: parseInt(e.target.value) }))}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 block mb-1">Discount %</label>
                              <input
                                type="number"
                                value={discount[r.id!] ?? 50}
                                onChange={e => setDiscount(p => ({ ...p, [r.id!]: parseInt(e.target.value) }))}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Reviewer Notes</label>
                            <textarea
                              rows={2}
                              value={notes[r.id!] || ""}
                              onChange={e => setNotes(p => ({ ...p, [r.id!]: e.target.value }))}
                              placeholder="Optional notes..."
                              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={processing === r.id}
                              onClick={() => update(r, "approved")}
                              className="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                            >
                              <CheckCircle2 className="h-4 w-4" />Approve
                            </button>
                            <button
                              disabled={processing === r.id}
                              onClick={() => update(r, "rejected")}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                            >
                              <XCircle className="h-4 w-4" />Reject
                            </button>
                          </div>
                        </div>
                      )}
                      {(r.verification_status || r.status) !== "pending" && (
                        <div className="space-y-2 text-xs text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                          {r.reviewer_notes && (
                            <div><span className="font-semibold text-slate-300">Reviewer Notes: </span>{r.reviewer_notes}</div>
                          )}
                          {r.rejection_reason && (
                            <div><span className="font-semibold text-slate-300">Rejection Reason: </span>{r.rejection_reason}</div>
                          )}
                          {r.approved_by && (
                            <div><span className="font-semibold text-slate-300">Approved By: </span>{r.approved_by}</div>
                          )}
                          {r.approved_at && (
                            <div><span className="font-semibold text-slate-300">Approved At: </span>{new Date(r.approved_at).toLocaleString()}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
