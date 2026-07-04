import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, GraduationCap, AlertCircle, XCircle } from "lucide-react";
import { supabase, StudentVerification } from "../lib/supabaseClient";

interface Props {
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}
type UploadField = "id_card_front" | "id_card_back";

interface FileEntry {
  file: File;
  preview: string | null;
}

const BUCKET = "students-verification";

// ─── FileRow extracted outside component so ref identity is stable ───────────
interface FileRowProps {
  label: string;
  fileRef: React.RefObject<HTMLInputElement>;
  entry: FileEntry | undefined;
  onChoose: () => void;
  onClear: () => void;
  onChange: (f: File | null) => void;
}

function FileRow({ label, fileRef, entry, onChoose, onClear, onChange }: FileRowProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-400 font-medium">{label}</label>
      {/* Row: Choose File button + filename */}
      <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 overflow-hidden">
        <button
          type="button"
          onClick={onChoose}
          className="shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-all"
        >
          Choose File
        </button>
        <span className="text-sm text-slate-400 truncate flex-1 min-w-0">
          {entry ? entry.file.name : "No file chosen"}
        </span>
        {entry && (
          <button type="button" onClick={onClear} className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
            <XCircle className="h-4 w-4" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => onChange(e.target.files?.[0] || null)}
        />
      </div>
      {/* Image preview */}
      <AnimatePresence>
        {entry?.preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
          >
            <div className="p-2 border-b border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-white font-medium truncate max-w-[260px]">{entry.file.name}</p>
                <p className="text-[10px] text-slate-500">{entry.file.type} · {(entry.file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button type="button" onClick={onClear} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center p-3 bg-slate-950 min-h-[160px]">
              <img
                src={entry.preview}
                alt={label}
                className="max-h-60 max-w-full object-contain rounded-lg"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function StudentVerificationModal({ userId, onClose, onSubmitted }: Props) {
  const [form, setForm] = useState({
    full_name: "", college_name: "", department: "",
    year: "", college_email: "", mobile_number: ""
  });
  const [idCardNumber, setIdCardNumber] = useState("");
  const [fileEntries, setFileEntries] = useState<Partial<Record<UploadField, FileEntry>>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const refs: Record<UploadField, React.RefObject<HTMLInputElement>> = {
    id_card_front: frontRef, id_card_back: backRef,
  };

  const handleFile = (field: UploadField, f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError("File must be under 10MB"); return; }
    setError(null);
    const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    setFileEntries(prev => ({ ...prev, [field]: { file: f, preview } }));
  };

  const clearFile = (field: UploadField) => {
    const entry = fileEntries[field];
    if (entry?.preview) URL.revokeObjectURL(entry.preview);
    setFileEntries(prev => { const n = { ...prev }; delete n[field]; return n; });
    const r = refs[field].current;
    if (r) r.value = "";
  };

  const uploadFile = async (field: UploadField, file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileEntries.id_card_front || !fileEntries.id_card_back) {
      setError("Please upload both College ID Front and Back."); return;
    }
    setUploading(true); setError(null);
    try {
      const [frontUrl, backUrl] = await Promise.all([
        uploadFile("id_card_front", fileEntries.id_card_front!.file),
        uploadFile("id_card_back", fileEntries.id_card_back!.file),
      ]);
      const record: StudentVerification = {
        ...form,
        student_id: idCardNumber || "",
        user_id: userId,
        id_card_front_url: frontUrl,
        id_card_back_url: backUrl,
        verification_status: "pending",
      };
      const { error: insertErr } = await supabase.from("student_verifications").insert(record);
      if (insertErr) throw new Error(insertErr.message);
      onSubmitted();
    } catch (err: any) {
      setError(err.message || "Submission failed. Please try again.");
    } finally { setUploading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }} transition={{ type: "spring", damping: 20 }}
          className="bg-[#0D0D10] border border-slate-700/60 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0D0D10]/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Student Verification</h2>
                <p className="text-slate-400 text-xs">Unlock 50% discount on all plans</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Personal Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "full_name", label: "Full Name", placeholder: "Your full name" },
                { key: "college_name", label: "College Name", placeholder: "Institution name" },
                { key: "department", label: "Department", placeholder: "e.g. Computer Science" },
                { key: "year", label: "Year", placeholder: "e.g. 2nd Year" },
                { key: "mobile_number", label: "Mobile Number", placeholder: "+91 XXXXXXXXXX" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">{label}</label>
                  <input
                    required type="text" placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-slate-900/60 border border-slate-700 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                </div>
              ))}
              {/* Optional Student ID Number */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Student ID Number <span className="text-slate-600 font-normal">(Optional)</span>
                </label>
                <input
                  type="text" placeholder="e.g. 21CS058AD157"
                  value={idCardNumber}
                  onChange={e => setIdCardNumber(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">College Email</label>
                <input
                  required type="email" placeholder="your@college.edu"
                  value={form.college_email}
                  onChange={e => setForm(prev => ({ ...prev, college_email: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                />
              </div>
            </div>

            {/* Upload Documents */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Upload College ID</p>
                  <span className="text-[10px] text-slate-500">Manual review required</span>
                </div>

                <p className="text-[11px] text-slate-400 leading-6">
                  Upload both the front and back of your college ID. Submissions are stored securely and reviewed by an admin before any student credits or discounts are granted.
                </p>

                <motion.div
                  key="college_id"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <FileRow
                    label="College ID Front"
                    fileRef={frontRef}
                    entry={fileEntries.id_card_front}
                    onChoose={() => frontRef.current?.click()}
                    onClear={() => clearFile("id_card_front")}
                    onChange={f => handleFile("id_card_front", f)}
                  />
                  <FileRow
                    label="College ID Back"
                    fileRef={backRef}
                    entry={fileEntries.id_card_back}
                    onChoose={() => backRef.current?.click()}
                    onClear={() => clearFile("id_card_back")}
                    onChange={f => handleFile("id_card_back", f)}
                  />
                </motion.div>
              </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit" disabled={uploading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
            >
              {uploading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading & Submitting...</>
                : <><GraduationCap className="h-4 w-4" />Submit Verification</>
              }
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
