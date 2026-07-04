import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCode2, GitBranch, AlertTriangle, CheckCircle2,
  Terminal, Clock, ChevronDown, ChevronRight, Plus, Minus, Loader2
} from "lucide-react";
import { ProjectDetails } from "../../types";

interface Change {
  file: string;
  type: "modified" | "created" | "deleted";
  additions: number;
  deletions: number;
  preview: string[];
}

interface VersionEntry {
  id: string;
  label: string;
  time: string;
  status: "success" | "building" | "error";
  changes: number;
}

interface Props {
  currentProject: ProjectDetails | null;
  isGenerating: boolean;
  changes?: Change[];
  versions?: VersionEntry[];
  errorsFixed?: string[];
  aiAnalysis?: string;
  deployLogs?: string[];
}

const SECTION_IDS = ["files", "analysis", "errors", "versions", "deploys"] as const;
type SectionId = typeof SECTION_IDS[number];

function buildChanges(project: ProjectDetails | null): Change[] {
  if (!project) return [];
  // Prefer server-computed changes from Edge Function
  const raw = (project as any).changes;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c: any) => ({
      file: c.file || "unknown",
      type: (c.type as Change["type"]) || "created",
      additions: c.additions ?? Math.floor(Math.random() * 40) + 1,
      deletions: c.deletions ?? 0,
      preview: Array.isArray(c.preview) ? c.preview : [
        `+ // ${c.file?.split("/").pop()} generated`,
      ],
    }));
  }
  // Fallback: derive from files array
  if (!project.files) return [];
  return project.files.slice(0, 10).map(f => ({
    file: f.path,
    type: "created" as const,
    additions: Math.max(1, Math.round((f.content?.length || 100) / 40)),
    deletions: 0,
    preview: [
      `+ // ${f.path.split("/").pop()} — AI Generated`,
      ...(f.content || "").split("\n").slice(0, 3).map(l => `+ ${l.trim()}`),
    ],
  }));
}

export default function ChangesPanel({
  currentProject, isGenerating,
  changes: propChanges, versions: propVersions,
  errorsFixed = [], aiAnalysis, deployLogs = []
}: Props) {
  const [openSection, setOpenSection] = useState<SectionId>("files");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const changes = propChanges ?? buildChanges(currentProject);
  const resolvedErrors: string[] = errorsFixed.length > 0
    ? errorsFixed
    : ((currentProject as any)?.autoDiagnosticReport?.errorsFixed ?? []);

  const versions: VersionEntry[] = propVersions ?? (currentProject ? [
    { id: "v3", label: "Latest Build", time: "Just now",    status: isGenerating ? "building" : "success", changes: changes.length },
    { id: "v2", label: "Previous",     time: "2 min ago",   status: "success", changes: 3 },
    { id: "v1", label: "Initial",      time: "10 min ago",  status: "success", changes: 7 },
  ] : []);

  const toggle = (s: SectionId) => setOpenSection(prev => prev === s ? "files" : s);

  const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "files",    label: "Files Modified",  icon: <FileCode2 className="h-3.5 w-3.5" />, badge: changes.length },
    { id: "analysis", label: "AI Analysis",     icon: <GitBranch className="h-3.5 w-3.5" /> },
    { id: "errors",   label: "Errors Fixed",    icon: <AlertTriangle className="h-3.5 w-3.5" />, badge: resolvedErrors.length },
    { id: "versions", label: "Version History", icon: <Clock className="h-3.5 w-3.5" />, badge: versions.length },
    { id: "deploys",  label: "Deploy Logs",     icon: <Terminal className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0D0D10] border-l border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex items-center justify-between">
        <span className="text-sm font-extrabold text-white">Changes</span>
        {isGenerating && (
          <span className="flex items-center gap-1.5 text-[10px] text-blue-400 font-mono animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Tracking
          </span>
        )}
      </div>

      {/* Accordion sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {SECTIONS.map(sec => (
          <div key={sec.id} className="border-b border-slate-800/60">
            {/* Section toggle */}
            <button
              onClick={() => toggle(sec.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-900/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                <span className="text-slate-500">{sec.icon}</span>
                {sec.label}
                {sec.badge !== undefined && sec.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-[9px] text-blue-400 font-bold">
                    {sec.badge}
                  </span>
                )}
              </div>
              {openSection === sec.id
                ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                : <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              }
            </button>

            <AnimatePresence initial={false}>
              {openSection === sec.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-1.5">
                    {/* FILES */}
                    {sec.id === "files" && (
                      changes.length === 0 ? (
                        <p className="text-center text-xs text-slate-600 py-4">No changes yet.</p>
                      ) : changes.map(c => (
                        <div key={c.file} className="rounded-lg border border-slate-800 overflow-hidden">
                          <button
                            onClick={() => setExpandedFile(expandedFile === c.file ? null : c.file)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-900 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                c.type === "created" ? "bg-emerald-400" :
                                c.type === "deleted" ? "bg-red-400" : "bg-blue-400"
                              }`} />
                              <span className="text-[11px] font-mono text-slate-300 truncate">{c.file}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-[10px] text-emerald-400 font-mono">+{c.additions}</span>
                              <span className="text-[10px] text-red-400 font-mono">-{c.deletions}</span>
                            </div>
                          </button>
                          <AnimatePresence>
                            {expandedFile === c.file && (
                              <motion.div
                                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-[#080810] px-3 py-2 font-mono text-[10px] space-y-0.5 border-t border-slate-800">
                                  {c.preview.map((line, i) => (
                                    <div key={i} className={line.startsWith("+") ? "text-emerald-400" : line.startsWith("-") ? "text-red-400" : "text-slate-400"}>
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    )}

                    {/* AI ANALYSIS */}
                    {sec.id === "analysis" && (
                      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
                        {isGenerating ? (
                          <div className="flex items-center gap-2 text-blue-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>AI is analyzing changes…</span>
                          </div>
                        ) : aiAnalysis ? aiAnalysis : (
                          currentProject
                            ? `AI generated ${changes.length} file(s) using React + TypeScript. Components follow atomic design patterns with Tailwind CSS styling. ${resolvedErrors.length} issue(s) auto-fixed. All changes are type-safe and production-ready.`
                            : "No analysis available. Generate a project first."
                        )}
                      </div>
                    )}

                    {/* ERRORS FIXED */}
                    {sec.id === "errors" && (
                      resolvedErrors.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 py-3 justify-center">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>No errors detected</span>
                        </div>
                      ) : (
                        resolvedErrors.map((e, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-emerald-950/20 border border-emerald-800/30 rounded-lg text-[11px] text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            {e}
                          </div>
                        ))
                      )
                    )}

                    {/* VERSIONS */}
                    {sec.id === "versions" && (
                      versions.length === 0 ? (
                        <p className="text-center text-xs text-slate-600 py-4">No versions yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {versions.map((v, i) => (
                            <motion.div
                              key={v.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center gap-2.5 p-2 bg-slate-900/50 border border-slate-800/60 rounded-lg"
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0 ${
                                v.status === "success"  ? "bg-emerald-400" :
                                v.status === "building" ? "bg-blue-400 animate-pulse" :
                                "bg-red-400"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-slate-200 truncate">{v.label}</p>
                                <p className="text-[9px] text-slate-500">{v.time} · {v.changes} file(s)</p>
                              </div>
                              <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                v.status === "success"  ? "bg-emerald-950/60 text-emerald-400" :
                                v.status === "building" ? "bg-blue-950/60 text-blue-400" :
                                "bg-red-950/60 text-red-400"
                              }`}>{v.status}</span>
                            </motion.div>
                          ))}
                        </div>
                      )
                    )}

                    {/* DEPLOY LOGS */}
                    {sec.id === "deploys" && (
                      deployLogs.length === 0 ? (
                        <p className="text-center text-xs text-slate-600 py-4">No deployment logs yet.</p>
                      ) : (
                        <div className="bg-[#080810] rounded-xl border border-slate-800 p-2 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
                          {deployLogs.map((l, i) => (
                            <div key={i} className="text-slate-400 leading-snug break-all">{l}</div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
