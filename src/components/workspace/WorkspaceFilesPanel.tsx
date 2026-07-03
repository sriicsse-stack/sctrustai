import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Files, Image as ImageIcon, FileText, Code2, Archive,
  Search, X, Eye, Loader2, CheckCircle2,
  AlertCircle, Upload, FolderOpen, ChevronRight,
  Trash2, FileCode, FileImage, File as FilePlaceholder,
} from "lucide-react";

export type UploadedFileType = "image" | "document" | "code" | "zip" | "other";

export interface ZipEntry {
  path: string;
  isDirectory: boolean;
  content?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: UploadedFileType;
  mimeType: string;
  previewUrl?: string;  // for images — object URL
  publicUrl?: string;   // after upload to storage
  content?: string;     // for text/code files (read locally)
  uploading: boolean;
  error?: string;
  uploadedAt: Date;
  zipEntries?: ZipEntry[]; // extracted file tree for ZIPs
  zipExpanded?: boolean;   // UI state: is tree expanded
}

interface Props {
  files: UploadedFile[];
  onRemove: (id: string) => void;
  onPreview: (file: UploadedFile) => void;
  onUseInChat: (file: UploadedFile) => void;
}

type TabKey = "all" | "images" | "docs" | "code" | "zips";

const TAB_LABELS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "all",    label: "All",   icon: <Files className="h-3 w-3" /> },
  { key: "images", label: "Images",icon: <ImageIcon className="h-3 w-3" /> },
  { key: "docs",   label: "Docs",  icon: <FileText className="h-3 w-3" /> },
  { key: "code",   label: "Code",  icon: <Code2 className="h-3 w-3" /> },
  { key: "zips",   label: "ZIP",   icon: <Archive className="h-3 w-3" /> },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: UploadedFileType, mimeType: string) {
  if (type === "image")    return <FileImage className="h-4 w-4 text-violet-400" />;
  if (type === "zip")      return <Archive className="h-4 w-4 text-amber-400" />;
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-400" />;
  if (type === "code")     return <FileCode className="h-4 w-4 text-blue-400" />;
  if (type === "document") return <FileText className="h-4 w-4 text-emerald-400" />;
  return <FilePlaceholder className="h-4 w-4 text-slate-400" />;
}

function ZipFileTree({ entries, onToggle, expanded }: { entries: ZipEntry[]; onToggle: () => void; expanded: boolean }) {
  return (
    <div className="mt-1.5">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer mb-1"
      >
        {expanded ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? "Hide" : "Show"} file tree ({entries.length} items)
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-2 space-y-0.5 max-h-[200px] overflow-y-auto font-mono text-[10px]">
              {entries.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 py-0.5 px-1 rounded ${entry.isDirectory ? "text-slate-400" : "text-slate-300"}`}
                  style={{ paddingLeft: `${(entry.path.split("/").length) * 10}px` }}
                >
                  {entry.isDirectory ? (
                    <FolderOpen className="h-3 w-3 text-amber-500/70 shrink-0" />
                  ) : (
                    <FilePlaceholder className="h-3 w-3 text-slate-500 shrink-0" />
                  )}
                  <span className="truncate">{entry.path}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkspaceFilesPanel({ files, onRemove, onPreview, onUseInChat }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [expandedZips, setExpandedZips] = useState<Set<string>>(new Set());

  const toggleZip = (id: string) => {
    setExpandedZips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === "all"    ? true :
      activeTab === "images" ? f.type === "image" :
      activeTab === "docs"   ? f.type === "document" :
      activeTab === "code"   ? f.type === "code" :
      activeTab === "zips"   ? f.type === "zip" : true;
    return matchesSearch && matchesTab;
  });

  const counts: Record<TabKey, number> = {
    all:    files.length,
    images: files.filter(f => f.type === "image").length,
    docs:   files.filter(f => f.type === "document").length,
    code:   files.filter(f => f.type === "code").length,
    zips:   files.filter(f => f.type === "zip").length,
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0D10] border-l border-slate-800 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
          <span className="font-bold text-slate-200 text-[11px]">Workspace Files</span>
          {files.length > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-800/40 text-blue-400 rounded text-[9px] font-bold">
              {files.length}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      {files.length > 0 && (
        <div className="px-2 py-2 border-b border-slate-800/60 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5">
            <Search className="h-3 w-3 text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              className="flex-1 bg-transparent text-[11px] text-slate-300 placeholder-slate-600 outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-500 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {files.length > 0 && (
        <div className="flex gap-0.5 px-2 py-1.5 border-b border-slate-800/60 shrink-0 overflow-x-auto">
          {TAB_LABELS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.key
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.icon}
              {t.label}
              {counts[t.key] > 0 && (
                <span className="text-[9px] opacity-60">{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
              <Upload className="h-5 w-5 text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 font-medium text-[11px]">No files uploaded yet</p>
              <p className="text-slate-600 text-[10px]">Use the attach button to upload images, docs, code files or ZIPs</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-600 text-[11px] py-6">No files match "{search}"</p>
        ) : (
          filtered.map(file => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="group flex items-start gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800/60 hover:border-slate-700/60 transition-colors"
            >
              {/* Thumbnail or icon */}
              <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-slate-700/40 flex items-center justify-center bg-slate-800">
                {file.type === "image" && file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                  getFileIcon(file.type, file.mimeType)
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-medium truncate text-[11px]">{file.name}</p>
                <p className="text-slate-500 text-[10px]">{formatBytes(file.size)}</p>

                {/* Status */}
                {file.uploading && (
                  <div className="flex items-center gap-1 text-blue-400 text-[10px] mt-0.5">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Uploading…
                  </div>
                )}
                {file.error && (
                  <div className="flex items-center gap-1 text-red-400 text-[10px] mt-0.5">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Upload failed
                  </div>
                )}
                {file.publicUrl && !file.uploading && (
                  <div className="flex items-center gap-1 text-emerald-400 text-[10px] mt-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Ready
                  </div>
                )}
                {!file.publicUrl && !file.uploading && !file.error && file.content && (
                  <div className="flex items-center gap-1 text-emerald-400 text-[10px] mt-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Read
                  </div>
                )}
                {!file.uploading && !file.error && file.type === "zip" && file.zipEntries && file.zipEntries.length > 0 && (
                  <div className="flex items-center gap-1 text-amber-400 text-[10px] mt-0.5">
                    <Archive className="h-2.5 w-2.5" />
                    {file.zipEntries.length} items extracted
                  </div>
                )}
                {/* ZIP file tree */}
                {!file.uploading && !file.error && file.type === "zip" && file.zipEntries && (
                  <ZipFileTree
                    entries={file.zipEntries}
                    expanded={expandedZips.has(file.id)}
                    onToggle={() => toggleZip(file.id)}
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setPreviewFile(file); onPreview(file); }}
                  className="p-1 text-slate-500 hover:text-blue-400 rounded transition-colors cursor-pointer"
                  title="Preview"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onUseInChat(file)}
                  className="p-1 text-slate-500 hover:text-violet-400 rounded transition-colors cursor-pointer"
                  title="Use in chat"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onRemove(file.id)}
                  className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Inline image preview modal */}
      <AnimatePresence>
        {previewFile && previewFile.type === "image" && previewFile.previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={previewFile.previewUrl}
                alt={previewFile.name}
                className="max-w-[80vw] max-h-[70vh] object-contain rounded-xl border border-slate-700"
              />
              <button
                onClick={() => setPreviewFile(null)}
                className="absolute -top-3 -right-3 w-7 h-7 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <p className="text-center text-slate-400 text-[11px] mt-2">{previewFile.name}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
