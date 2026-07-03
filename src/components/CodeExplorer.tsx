import React, { useState, useEffect } from "react";
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  Play, 
  Save, 
  Check, 
  Copy, 
  Terminal,
  Loader2,
  FileJson,
  Database,
  RefreshCw,
  Search,
  BookOpen,
  Sparkles
} from "lucide-react";
import { ProjectDetails, FileItem } from "../types";

interface CodeExplorerProps {
  currentProject: ProjectDetails;
  onCodeUpdated: (updatedFiles: FileItem[]) => void;
  isApplyingEdits: boolean;
  onApplyManualEdit: (filePath: string, editingContent: string) => void;
  onAnalyzeFileInSriAI?: (filePath: string, content: string) => void;
}

export default function CodeExplorer({
  currentProject,
  onCodeUpdated,
  isApplyingEdits,
  onApplyManualEdit,
  onAnalyzeFileInSriAI
}: CodeExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [copiedFile, setCopiedFile] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success">("idle");

  // Automatically select the first file (e.g. page.tsx or index.js) on load
  useEffect(() => {
    if (currentProject?.files && currentProject.files.length > 0) {
      const defaultFile = currentProject.files.find(f => f && f.path && (f.path.includes("page") || f.path.includes("App"))) || currentProject.files[0];
      if (defaultFile) {
        setSelectedFile(defaultFile);
        setEditorValue(defaultFile.content || "");
      }
    }
  }, [currentProject]);

  const handleSelectFile = (file: FileItem) => {
    setSelectedFile(file);
    setEditorValue(file.content);
    setSaveStatus("idle");
  };

  const handleCopyCode = async () => {
    if (!selectedFile) return;
    try {
      await navigator.clipboard.writeText(editorValue);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    } catch (e) {}
  };

  const handleSaveAndCompile = () => {
    if (!selectedFile) return;
    setSaveStatus("saving");
    
    // Call parents trigger to update state and compile updated browser HTML
    onApplyManualEdit(selectedFile.path, editorValue);
    
    setTimeout(() => {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }, 1200);
  };

  // Icon chooser helper
  const getFileIcon = (path: string) => {
    const ext = path.split(".").pop();
    if (ext === "json") return <FileJson className="h-4 w-4 text-amber-500" />;
    if (ext === "sql") return <Database className="h-4 w-4 text-emerald-500" />;
    if (ext === "css") return <FileCode className="h-4 w-4 text-blue-400" />;
    if (ext === "md") return <BookOpen className="h-4 w-4 text-zinc-400" />;
    return <FileCode className="h-4 w-4 text-purple-400" />;
  };

  const lineCount = editorValue.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div id="code-explorer-container" className="flex-1 flex flex-col md:flex-row h-full bg-[#0A0A0B] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* File Tree Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-[#0F0F11] flex flex-col select-none">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
            Project Tree
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-[#16161A] border border-slate-800 px-1.5 py-0.5 rounded">
            {currentProject.files?.length || 0} files
          </span>
        </div>

        <div id="file-list-tree" className="p-2 overflow-y-auto flex-1 space-y-0.5">
          {/* Root directory headers */}
          <div className="px-2 py-1 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <Folder className="h-3.5 w-3.5" />
            <span>root/</span>
          </div>
          
          <div className="pl-3 space-y-0.5">
            {currentProject.files?.map((file, i) => {
              const isSelected = selectedFile?.path === file.path;
              return (
                <button
                   key={i}
                  id={`file-item-${i}`}
                  onClick={() => handleSelectFile(file)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs font-mono transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-blue-950/40 border border-blue-900/60 text-blue-400 font-semibold" 
                      : "text-slate-400 hover:text-white hover:bg-[#16161A] border border-transparent"
                  }`}
                >
                  {getFileIcon(file.path)}
                  <span className="truncate flex-1">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor Main Surface */}
      <div className="flex-1 flex flex-col bg-[#0A0A0B] overflow-hidden">
        {selectedFile ? (
          <React.Fragment>
            {/* Editor Action Header */}
            <div className="px-5 py-3 border-b border-slate-800 bg-[#0F0F11]/90 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Editing:
                </span>
                <span className="text-xs text-blue-400 font-mono bg-blue-950/45 border border-blue-900/50 px-2.5 py-0.5 rounded font-semibold">
                  {selectedFile.path}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 bg-[#16161A] hover:bg-slate-800 text-slate-300 hover:text-white rounded text-xs px-2.5 py-1 font-mono hover:border-slate-600 transition-colors cursor-pointer"
                >
                  {copiedFile ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>

                {onAnalyzeFileInSriAI && (
                  <button
                    id="analyze-file-sri-btn"
                    onClick={() => onAnalyzeFileInSriAI(selectedFile.path, editorValue)}
                    className="flex items-center gap-1.5 border border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40 text-purple-300 hover:text-white rounded text-xs px-3 py-1.5 font-mono cursor-pointer transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                    <span>Analyze in Sri AI</span>
                  </button>
                )}

                <button
                  id="save-and-compile-btn"
                  onClick={handleSaveAndCompile}
                  disabled={saveStatus === "saving" || isApplyingEdits}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer shadow-md shadow-blue-900/20 transition-all"
                >
                  {saveStatus === "saving" || isApplyingEdits ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Applying...
                    </>
                  ) : saveStatus === "success" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      Compiled!
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Apply & Compile
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code Text Arena with Custom Line column pairing */}
            <div id="editor-viewport" className="flex-1 flex overflow-hidden font-mono text-xs leading-relaxed max-h-[500px]">
              {/* Line indicator panel */}
              <div className="w-10 bg-[#0F0F11]/60 border-r border-slate-800 text-slate-600 select-none py-4 text-right pr-3">
                {lineNumbers.map(n => (
                  <div key={n} className="h-5">
                    {n}
                  </div>
                ))}
              </div>

              <textarea
                id="code-editor-textarea"
                value={editorValue}
                onChange={(e) => {
                  setEditorValue(e.target.value);
                  setSaveStatus("idle");
                }}
                className="flex-1 p-4 bg-[#0A0A0B] text-slate-200 caret-blue-500 border-0 focus:ring-0 outline-none resize-none font-mono overflow-auto h-full"
                spellCheck={false}
              />
            </div>
          </React.Fragment>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 font-sans">
            <FileCode className="h-10 w-10 text-zinc-800 mb-3 animate-spin" />
            <p className="text-xs">
              No files available in project folder tree. Generate an app to populate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
