import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Loader2, Bot, User, ChevronRight,
  CheckCircle2, Circle, AlertTriangle, Lightbulb,
  X, Mic, MicOff, Paperclip, ImageIcon, Volume2,
  Image as ImageIconLucide, FileText, Code2, Archive,
  Files, FolderOpen, Eye,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import JSZip from "jszip";
import WorkspaceFilesPanel, { UploadedFile, UploadedFileType, ZipEntry } from "./WorkspaceFilesPanel";


// ─── Types ────────────────────────────────────────────────────────────────────
export interface AIMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  time: string;
  isStreaming?: boolean;
  images?: string[]; // public URLs of attached images
}

export interface TaskStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

export interface BuildLogEntry {
  time: string;
  level: "info" | "success" | "warn" | "error";
  text: string;
}

// Legacy — kept for image-only backward compat
export interface ImageAttachment {
  id: string;
  file: File;
  previewUrl: string;
  publicUrl?: string;
  uploading: boolean;
  error?: string;
}

type VoiceStatus = "idle" | "listening" | "processing" | "generating";
type PanelSection = "chat" | "tasks" | "logs" | "files";

interface Props {
  messages: AIMessage[];
  taskSteps: TaskStep[];
  buildLogs: BuildLogEntry[];
  isGenerating: boolean;
  onSend: (prompt: string, images?: string[], fileContext?: string) => void;
  autoFixMessage?: string | null;
}

const SUGGESTIONS = [
  "Build a Calculator app",
  "Build a Notes app",
  "Build a Shopping website",
  "Add dark mode toggle",
  "Make it mobile responsive",
  "Add user authentication",
];

const VOICE_LANGS = [
  { code: "en-US", label: "EN" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "auto",  label: "Auto" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
async function compressImage(file: File, maxBytes = 4 * 1024 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      const MAX_DIM = 1080;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxBytes || quality <= 0.3) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
          } else {
            quality -= 0.1;
            tryCompress();
          }
        }, "image/webp", quality);
      };
      tryCompress();
    };
    img.src = url;
  });
}

function detectFileType(file: File): UploadedFileType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/zip" || mime === "application/x-zip-compressed" || name.endsWith(".zip")) return "zip";
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime.includes("wordprocessingml") ||
    mime === "text/plain" ||
    name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".txt")
  ) return "document";
  if (
    mime === "text/javascript" || mime === "text/typescript" ||
    mime === "text/html" || mime === "text/css" ||
    mime === "application/json" ||
    name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".jsx") ||
    name.endsWith(".py") || name.endsWith(".java") || name.endsWith(".go") || name.endsWith(".rs") ||
    name.endsWith(".css") || name.endsWith(".html") || name.endsWith(".json") || name.endsWith(".md") ||
    name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".sh") || name.endsWith(".env")
  ) return "code";
  return "other";
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

function buildFileContextString(files: UploadedFile[]): string {
  const parts: string[] = [];
  for (const f of files) {
    if (f.type === "image") {
      parts.push(`[IMAGE: ${f.name}${f.publicUrl ? ` → ${f.publicUrl}` : " (local)"}]`);
    } else if (f.type === "code" && f.content) {
      const ext = f.name.split(".").pop() || "";
      const snippet = f.content.slice(0, 3000);
      parts.push(`[CODE FILE: ${f.name}]\n\`\`\`${ext}\n${snippet}${f.content.length > 3000 ? "\n… (truncated)" : ""}\n\`\`\``);
    } else if (f.type === "document" && f.content) {
      const snippet = f.content.slice(0, 2000);
      parts.push(`[DOCUMENT: ${f.name}]\n${snippet}${f.content.length > 2000 ? "\n… (truncated)" : ""}`);
    } else if (f.type === "zip" && f.zipEntries) {
      const treeLines = f.zipEntries.map(e => `  ${e.isDirectory ? "📁" : "📄"} ${e.path}`).join("\n");
      const codeParts: string[] = [];
      for (const entry of f.zipEntries) {
        if (!entry.isDirectory && entry.content) {
          const ext = entry.path.split(".").pop() || "";
          const snippet = entry.content.slice(0, 2000);
          codeParts.push(`[${entry.path}]\n\`\`\`${ext}\n${snippet}${entry.content.length > 2000 ? "\n… (truncated)" : ""}\n\`\`\``);
        }
      }
      parts.push(`[ZIP PROJECT: ${f.name}]\nFile Tree:\n${treeLines}${codeParts.length ? "\n\nExtracted Contents:\n" + codeParts.join("\n\n") : ""}`);
    } else if (f.type === "zip") {
      parts.push(`[ZIP PROJECT: ${f.name}]`);
    }
  }
  return parts.join("\n\n");
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AIAssistantPanel({
  messages, taskSteps, buildLogs, isGenerating, onSend, autoFixMessage
}: Props) {
  const [input, setInput] = useState("");
  const [activeSection, setActiveSection] = useState<PanelSection>("chat");
  // Image attachments (quick attach — inline in input)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  // All uploaded workspace files (persisted across sends)
  const [workspaceFiles, setWorkspaceFiles] = useState<UploadedFile[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceLang, setVoiceLang] = useState<string>("auto");
  const [voiceTranscript, setVoiceTranscript] = useState("");

  const chatEndRef   = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anyFileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Upload image to Supabase Storage ──────────────────────────────────────
  const uploadImage = useCallback(async (att: ImageAttachment) => {
    setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, uploading: true } : a));
    try {
      const compressed = await compressImage(att.file);
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
      const { error } = await supabase.storage
        .from("ai-uploads")
        .upload(safeName, compressed, { upsert: false, contentType: "image/webp" });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("ai-uploads").getPublicUrl(safeName);
      setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, uploading: false, publicUrl } : a));
      // Also add to workspace files panel
      setWorkspaceFiles(prev => [...prev, {
        id: att.id,
        name: att.file.name,
        size: att.file.size,
        type: "image",
        mimeType: att.file.type,
        previewUrl: att.previewUrl,
        publicUrl,
        uploading: false,
        uploadedAt: new Date(),
      }]);
    } catch (err: any) {
      setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, uploading: false, error: err.message } : a));
    }
  }, []);

  // ── Process any file (docs, code, zip) ────────────────────────────────────
  const processAnyFile = useCallback(async (file: File) => {
    const id = Math.random().toString(36).slice(2);
    const fileType = detectFileType(file);
    const previewUrl = fileType === "image" ? URL.createObjectURL(file) : undefined;

    const wf: UploadedFile = {
      id,
      name: file.name,
      size: file.size,
      type: fileType,
      mimeType: file.type,
      previewUrl,
      uploading: fileType === "image",
      uploadedAt: new Date(),
    };

    setWorkspaceFiles(prev => [...prev, wf]);

    if (fileType === "image") {
      // Upload image to storage
      const att: ImageAttachment = { id, file, previewUrl: previewUrl!, uploading: true };
      setAttachments(prev => [...prev, att]);
      try {
        const compressed = await compressImage(file);
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
        const { error } = await supabase.storage
          .from("ai-uploads")
          .upload(safeName, compressed, { upsert: false, contentType: "image/webp" });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("ai-uploads").getPublicUrl(safeName);
        setAttachments(prev => prev.map(a => a.id === id ? { ...a, uploading: false, publicUrl } : a));
        setWorkspaceFiles(prev => prev.map(f => f.id === id ? { ...f, uploading: false, publicUrl } : f));
      } catch (err: any) {
        setAttachments(prev => prev.map(a => a.id === id ? { ...a, uploading: false, error: err.message } : a));
        setWorkspaceFiles(prev => prev.map(f => f.id === id ? { ...f, uploading: false, error: err.message } : f));
      }
    } else if (fileType === "code" || fileType === "document") {
      // Read text content locally
      try {
        const content = await readTextFile(file);
        setWorkspaceFiles(prev => prev.map(f => f.id === id ? { ...f, content, uploading: false } : f));
      } catch {
        setWorkspaceFiles(prev => prev.map(f => f.id === id ? { ...f, uploading: false, error: "Could not read file" } : f));
      }
    } else if (fileType === "zip") {
      // Extract ZIP contents client-side using JSZip
      try {
        const zip = await JSZip.loadAsync(file);
        const entries: ZipEntry[] = [];
        const maxContentSize = 50_000; // max chars per file content
        const maxTotalSize = 500_000; // max total chars from all files
        let totalRead = 0;

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) {
            entries.push({ path: relativePath, isDirectory: true });
            continue;
          }
          // Skip binary/image/media files for content reading
          const isText = !/\.(png|jpg|jpeg|gif|webp|mp4|mp3|wav|ogg|pdf|docx|zip|exe|dll|so|dylib|ttf|woff|woff2|eot|ico)$/i.test(relativePath);
          let content: string | undefined;
          if (isText && totalRead < maxTotalSize) {
            try {
              const text = await zipEntry.async("text");
              if (text.length > maxContentSize) {
                content = text.slice(0, maxContentSize) + "\n… (truncated)";
              } else {
                content = text;
              }
              totalRead += content.length;
            } catch {
              content = undefined;
            }
          }
          entries.push({ path: relativePath, isDirectory: false, content });
        }

        setWorkspaceFiles(prev => prev.map(f => f.id === id ? { ...f, uploading: false, zipEntries: entries, zipExpanded: true } : f));
      } catch {
        setWorkspaceFiles(prev => prev.map(f => f.id === id ? { ...f, uploading: false, error: "Could not extract ZIP" } : f));
      }
    }
  }, []);

  // ── File picker: image-only (inline attachments) ─────────────────────────
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const targetFiles = e.target.files;
    if (!targetFiles) return;
    const files = Array.from(targetFiles);
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","image/avif"];
    const newAtts: ImageAttachment[] = files
      .filter((f) => allowed.includes(f.type))
      .map((f) => ({ id: Math.random().toString(36).slice(2), file: f, previewUrl: URL.createObjectURL(f), uploading: false }));
    setAttachments((prev) => [...prev, ...newAtts]);
    newAtts.forEach((a) => uploadImage(a));
    e.target.value = "";
  }, [uploadImage]);

  // ── File picker: any file type ────────────────────────────────────────────
  const handleAnyFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => processAnyFile(f));
    e.target.value = "";
  }, [processAnyFile]);

  // ── Drag and drop ─────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => processAnyFile(f));
  }, [processAnyFile]);

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att) URL.revokeObjectURL(att.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  const removeWorkspaceFile = (id: string) => {
    setWorkspaceFiles(prev => {
      const f = prev.find(f => f.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter(f => f.id !== id);
    });
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleUseFileInChat = (file: UploadedFile) => {
    const ref =
      file.type === "image"    ? `Analyze this image: ${file.name}` :
      file.type === "code"     ? `Review this code file: ${file.name}` :
      file.type === "document" ? `Read this document: ${file.name}` :
      file.type === "zip"      ? `Inspect this project: ${file.name}` :
      `Use file: ${file.name}`;
    setInput(prev => prev ? `${prev} [${ref}]` : ref);
    setActiveSection("chat");
    textareaRef.current?.focus();
  };

  // ── Voice input ───────────────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported. Please use Chrome or Edge.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = voiceLang === "auto" ? "" : voiceLang;
    rec.onstart = () => setVoiceStatus("listening");
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join("");
      setVoiceTranscript(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        setVoiceTranscript("");
        setVoiceStatus("processing");
        setTimeout(() => setVoiceStatus("idle"), 600);
      }
    };
    rec.onerror = () => setVoiceStatus("idle");
    rec.onend   = () => { if (voiceStatus === "listening") setVoiceStatus("idle"); };
    recognitionRef.current = rec;
    rec.start();
  }, [voiceLang, voiceStatus]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setVoiceStatus("idle");
    setVoiceTranscript("");
  }, []);

  const toggleVoice = () => {
    if (voiceStatus === "listening") stopVoice(); else startVoice();
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    const uploadedUrls = attachments.filter(a => a.publicUrl && !a.uploading).map(a => a.publicUrl as string);
    const stillUploading = attachments.some(a => a.uploading);
    if ((!text && uploadedUrls.length === 0 && workspaceFiles.length === 0) || isGenerating || stillUploading) return;

    // Build file context from workspace files
    const readyFiles = workspaceFiles.filter(f => !f.uploading && !f.error);
    const fileContext = buildFileContextString(readyFiles);

    // Build prompt
    let fullPrompt = text;
    if (uploadedUrls.length > 0 && !text) {
      fullPrompt = `Analyze the attached image(s) and generate a matching UI application.`;
    } else if (uploadedUrls.length > 0) {
      fullPrompt = `${text}\n\n[Image references: ${uploadedUrls.join(", ")}]`;
    }

    onSend(fullPrompt, uploadedUrls.length > 0 ? uploadedUrls : undefined, fileContext || undefined);
    setInput("");
    setAttachments([]);
    setVoiceStatus("generating");
    setTimeout(() => setVoiceStatus("idle"), 2000);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, attachments, workspaceFiles, isGenerating, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const t = e.target;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 120) + "px";
  };

  const activeStepCount = taskSteps.filter(s => s.status === "done").length;
  const hasActiveTasks  = taskSteps.some(s => s.status === "active");
  const stillUploading  = attachments.some(a => a.uploading);

  const voiceLabel: Record<VoiceStatus, string> = {
    idle: "",
    listening: "🎤 Listening…",
    processing: "⚙️ Processing…",
    generating: "🚀 Generating…",
  };

  const SECTION_TABS: { key: PanelSection; label: string; badge?: number }[] = [
    { key: "chat",  label: "chat" },
    { key: "tasks", label: "tasks", badge: hasActiveTasks ? 1 : 0 },
    { key: "logs",  label: "logs" },
    { key: "files", label: "files", badge: workspaceFiles.length },
  ];

  return (
    <div
      className="flex flex-col h-full bg-[#0D0D10] border-r border-slate-800 overflow-hidden relative"
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-blue-950/80 border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none"
          >
            <Files className="h-10 w-10 text-blue-400 animate-bounce" />
            <p className="text-blue-300 font-bold text-sm">Drop files here</p>
            <p className="text-blue-400/70 text-xs">Images, Docs, Code files, ZIPs</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Panel header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow shadow-blue-900/40">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs font-extrabold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">SC Workspace</span>
          {isGenerating && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400 font-mono animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Working...
            </span>
          )}
        </div>
        {/* Section tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 gap-0.5 text-[10px] font-bold">
          {SECTION_TABS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`relative px-2.5 py-1 rounded-md transition-colors cursor-pointer capitalize ${
                activeSection === s.key ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {s.key === "tasks" && hasActiveTasks ? (
                <span className="flex items-center gap-1">{s.label}<span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" /></span>
              ) : s.key === "files" && s.badge ? (
                <span className="flex items-center gap-1">{s.label}<span className="px-1 bg-blue-900/60 text-blue-300 rounded text-[9px]">{s.badge}</span></span>
              ) : s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Auto-fix banner ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {autoFixMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-950/30 border-b border-amber-800/40 px-4 py-2 flex items-center gap-2 text-[11px] text-amber-300 shrink-0 overflow-hidden"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>{autoFixMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Voice status banner ────────────────────────────────────────────── */}
      <AnimatePresence>
        {voiceStatus !== "idle" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`px-4 py-2 flex items-center gap-2 text-[11px] font-semibold shrink-0 overflow-hidden border-b ${
              voiceStatus === "listening"  ? "bg-red-950/30 border-red-800/40 text-red-300" :
              voiceStatus === "processing" ? "bg-amber-950/30 border-amber-800/40 text-amber-300" :
              "bg-blue-950/30 border-blue-800/40 text-blue-300"
            }`}
          >
            {voiceStatus === "listening"  && <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />}
            {voiceStatus === "processing" && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
            {voiceStatus === "generating" && <Sparkles className="h-3 w-3 text-blue-400 animate-pulse" />}
            <span>{voiceLabel[voiceStatus]}</span>
            {voiceTranscript && <span className="text-slate-400 font-normal truncate flex-1">"{voiceTranscript}"</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* CHAT TAB */}
        {activeSection === "chat" && (
          <div className="p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-blue-400" />
                </div>
                <p className="text-xs text-slate-500">Describe what to build, upload files (images, docs, code, ZIP), or use voice input.</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {[
                    { icon: <ImageIconLucide className="h-3 w-3" />, label: "Screenshot → UI" },
                    { icon: <FileText className="h-3 w-3" />, label: "PDF → Insights" },
                    { icon: <Code2 className="h-3 w-3" />, label: "Code → Fix" },
                    { icon: <Archive className="h-3 w-3" />, label: "ZIP → Inspect" },
                  ].map(cap => (
                    <span key={cap.label} className="flex items-center gap-1 px-2 py-1 bg-slate-900/60 border border-slate-800 rounded text-[10px] text-slate-400">
                      {cap.icon}{cap.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${
                  msg.role === "ai" ? "bg-gradient-to-br from-blue-600 to-indigo-600" : "bg-gradient-to-br from-slate-600 to-slate-700"
                }`}>
                  {msg.role === "ai" ? <Bot className="h-3.5 w-3.5 text-white" /> : <User className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className={`max-w-[85%] space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.images.map((url, i) => (
                        <img key={i} src={url} alt="attachment" className="h-20 w-20 object-cover rounded-lg border border-slate-700" />
                      ))}
                    </div>
                  )}
                  <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-100"
                      : "bg-slate-900 border border-slate-700/60 text-slate-200"
                  }`}>
                    {msg.isStreaming
                      ? <span>{msg.text}<span className="inline-block w-1.5 h-3 bg-blue-400 ml-0.5 animate-pulse rounded-sm" /></span>
                      : msg.text}
                  </div>
                </div>
              </motion.div>
            ))}
            {isGenerating && messages[messages.length - 1]?.role !== "ai" && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* TASKS TAB */}
        {activeSection === "tasks" && (
          <div className="p-3 space-y-2">
            {taskSteps.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">No active tasks. Submit a prompt to begin.</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-slate-400 font-mono">{activeStepCount} / {taskSteps.length} complete</span>
                  <div className="h-1.5 flex-1 mx-3 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      animate={{ width: `${(activeStepCount / taskSteps.length) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                {taskSteps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      step.status === "done"   ? "bg-emerald-950/20 border-emerald-800/30 text-emerald-300" :
                      step.status === "active" ? "bg-blue-950/30 border-blue-700/40 text-blue-200" :
                      step.status === "error"  ? "bg-red-950/20 border-red-800/30 text-red-300" :
                      "bg-slate-900/40 border-slate-800/40 text-slate-500"
                    }`}
                  >
                    {step.status === "done"    && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                    {step.status === "active"  && <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />}
                    {step.status === "error"   && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
                    {step.status === "pending" && <Circle className="h-4 w-4 text-slate-600 shrink-0" />}
                    <span className="flex-1">{step.label}</span>
                    {step.status === "active" && <span className="text-[10px] text-blue-400 font-mono animate-pulse">running</span>}
                  </motion.div>
                ))}
              </>
            )}
          </div>
        )}

        {/* LOGS TAB */}
        {activeSection === "logs" && (
          <div className="p-2 font-mono text-[10.5px] space-y-1">
            {buildLogs.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">No build logs yet.</p>
            ) : buildLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5 border-b border-slate-800/40">
                <span className="text-slate-600 shrink-0 select-none">{log.time}</span>
                <span className={`shrink-0 px-1 rounded text-[9px] font-bold uppercase border ${
                  log.level === "success" ? "bg-emerald-950/60 border-emerald-900/40 text-emerald-400" :
                  log.level === "warn"    ? "bg-amber-950/60 border-amber-900/40 text-amber-400" :
                  log.level === "error"   ? "bg-red-950/60 border-red-900/40 text-red-400" :
                  "bg-blue-950/60 border-blue-900/40 text-blue-400"
                }`}>{log.level}</span>
                <span className={`break-all leading-snug ${
                  log.level === "success" ? "text-emerald-300" :
                  log.level === "warn"    ? "text-amber-300" :
                  log.level === "error"   ? "text-red-300" : "text-slate-300"
                }`}>{log.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* FILES TAB */}
        {activeSection === "files" && (
          <WorkspaceFilesPanel
            files={workspaceFiles}
            onRemove={removeWorkspaceFile}
            onPreview={() => {}}
            onUseInChat={handleUseFileInChat}
          />
        )}
      </div>

      {/* ── Quick suggestions ──────────────────────────────────────────────── */}
      {activeSection === "chat" && !isGenerating && messages.length < 3 && (
        <div className="px-3 pb-2 shrink-0">
          <p className="text-[10px] text-slate-500 font-medium mb-1.5 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Quick suggestions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.slice(0, 4).map(s => (
              <button
                key={s}
                onClick={() => onSend(s)}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-700/50 text-slate-400 hover:text-blue-300 text-[10px] rounded-lg font-medium transition-all cursor-pointer"
              >
                <ChevronRight className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Attachment Preview Strip (images) ──────────────────────────────── */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2 shrink-0 overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachments.map(att => (
                <div key={att.id} className="relative shrink-0 group">
                  <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                    att.error ? "border-red-500/60" :
                    att.uploading ? "border-blue-500/60 animate-pulse" :
                    att.publicUrl ? "border-emerald-500/60" : "border-slate-700"
                  }`}>
                    <img src={att.previewUrl} alt="attachment" className="w-full h-full object-cover" />
                    {att.uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                        <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                      </div>
                    )}
                    {att.publicUrl && !att.uploading && (
                      <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-500 mt-1">
              {stillUploading ? "⏳ Uploading…" : `✅ ${attachments.filter(a => a.publicUrl).length} image(s) ready`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Non-image file context indicator ──────────────────────────────── */}
      {workspaceFiles.filter(f => f.type !== "image" && !f.uploading && !f.error).length > 0 && (
        <div className="px-3 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {workspaceFiles.filter(f => f.type !== "image" && !f.uploading && !f.error).map(f => (
              <div key={f.id} className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-700/60 rounded-lg text-[10px] text-slate-400">
                {f.type === "code"     && <Code2    className="h-3 w-3 text-blue-400"    />}
                {f.type === "document" && <FileText className="h-3 w-3 text-emerald-400" />}
                {f.type === "zip"      && <Archive  className="h-3 w-3 text-amber-400"   />}
                <span className="truncate max-w-[80px]">{f.name}</span>
                <button onClick={() => removeWorkspaceFile(f.id)} className="text-slate-600 hover:text-red-400 cursor-pointer ml-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-600 mt-1">📎 Files will be sent as context with your next message</p>
        </div>
      )}

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-800 shrink-0 space-y-2">
        {/* Voice language selector */}
        <div className="flex items-center gap-1.5">
          <Volume2 className="h-3 w-3 text-slate-500 shrink-0" />
          <span className="text-[9px] text-slate-500 font-mono">Voice:</span>
          {VOICE_LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setVoiceLang(l.code)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                voiceLang === l.code
                  ? "bg-red-950/50 border-red-700/60 text-red-300"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Text input + action buttons */}
        <div className={`flex items-end gap-1.5 bg-slate-900/80 border rounded-xl px-3 py-2 transition-colors ${
          voiceStatus === "listening" ? "border-red-600/60 ring-1 ring-red-600/20" :
          isGenerating ? "border-blue-700/50" :
          "border-slate-700 focus-within:border-blue-600/60"
        }`}>
          {/* Image attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            title="Attach image"
            className="shrink-0 p-1 text-slate-500 hover:text-violet-400 transition-colors cursor-pointer disabled:opacity-40 rounded-lg hover:bg-violet-950/30"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />

          {/* Any file attach */}
          <button
            type="button"
            onClick={() => anyFileInputRef.current?.click()}
            disabled={isGenerating}
            title="Upload any file (PDF, DOCX, TXT, code, ZIP)"
            className="shrink-0 p-1 text-slate-500 hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-40 rounded-lg hover:bg-blue-950/30"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <input
            ref={anyFileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.js,.ts,.tsx,.jsx,.py,.java,.go,.rs,.css,.html,.json,.md,.yaml,.yml,.sh,.zip,.env"
            multiple
            className="hidden"
            onChange={handleAnyFileChange}
          />

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextInput}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            rows={1}
            placeholder={
              voiceStatus === "listening" ? "🎤 Speak now…" :
              isGenerating ? "AI is working…" :
              "Describe changes, upload files, or use voice…"
            }
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none resize-none min-h-[24px] max-h-[120px] leading-relaxed"
          />

          {/* Mic button */}
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isGenerating}
            title={voiceStatus === "listening" ? "Stop recording" : "Voice input"}
            className={`shrink-0 p-1 rounded-lg transition-all cursor-pointer disabled:opacity-40 ${
              voiceStatus === "listening" ? "text-red-400 bg-red-950/40 animate-pulse" : "text-slate-500 hover:text-red-400 hover:bg-red-950/20"
            }`}
          >
            {voiceStatus === "listening" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0 && workspaceFiles.length === 0) || isGenerating || stillUploading}
            className="shrink-0 w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors cursor-pointer"
          >
            {isGenerating || stillUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>

        <p className="text-[9px] text-slate-600 px-1 flex items-center gap-2">
          <span>Enter to send · Shift+Enter newline · Drop files anywhere</span>
        </p>
      </div>
    </div>
  );
}

