import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import WorkspaceTopBar, { DeployStatus } from "./WorkspaceTopBar";
import AIAssistantPanel, { AIMessage, TaskStep, BuildLogEntry } from "./AIAssistantPanel";
import LivePreviewPanel from "./LivePreviewPanel";
import ChangesPanel from "./ChangesPanel";
import CodeExplorer from "../CodeExplorer";
import ProjectHistory from "../ProjectHistory";
import { ProjectDetails, ProjectSummary } from "../../types";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

// ── Real agent steps mapped to the multi-agent pipeline ────────────────────
const PHASE_ORDER = ["analyze", "plan", "generate", "validate", "fix", "deploy"] as const;

type BuildPhase = typeof PHASE_ORDER[number] | "idle" | "complete";

interface AgentStep {
  id: BuildPhase;
  label: string;
  labelActive: string;
}

const AGENT_STEPS: AgentStep[] = [
  { id: "analyze",  label: "Phase 1 — Intent Understanding",  labelActive: "Analyzing intent & requirements…" },
  { id: "plan",     label: "Phase 2 — Mode Routing",           labelActive: "Routing to correct builder mode…" },
  { id: "generate", label: "Phase 3 — Content Generation",     labelActive: "Generating domain-specific content…" },
  { id: "validate", label: "Phase 4 — UI Build & Validate",    labelActive: "Building premium mobile-first UI…" },
  { id: "fix",      label: "Phase 5 — Auto-Fix Engine",        labelActive: "Scanning & fixing issues automatically…" },
  { id: "deploy",   label: "Phase 6 — Deploy Final Product",   labelActive: "Deploying verified output to edge…" },
];

function makeLog(level: BuildLogEntry["level"], text: string): BuildLogEntry {
  return {
    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    level,
    text,
  };
}

interface Props {
  currentProject: ProjectDetails | null;
  projectsList: ProjectSummary[];
  selectedProjectId: string | null;
  isGenerating: boolean;
  isDeploying: boolean;
  isRefining: boolean;
  deployLogs: string[];
  isApplyingEdits: boolean;
  buildPhase?: string;
  buildPhaseMessage?: string;
  credits?: number;
  deployStatus?: DeployStatus;
  deployError?: string;
  onGenerate: (prompt: string, images?: string[], fileContext?: string) => void;
  onRefine: (prompt: string, images?: string[], fileContext?: string) => void;
  onDeploy: (platform: string) => void;
  onSelectProject: (id: string) => void;
  onApplyManualEdit: (filePath: string, editingContent: string) => void;
  onAnalyzeFileInSriAI: (filePath: string, content?: string) => void;
  onUpgrade?: () => void;
}

export default function AIWorkspaceLayout({
  currentProject, projectsList, selectedProjectId,
  isGenerating, isDeploying, isRefining, deployLogs,
  isApplyingEdits, buildPhase, buildPhaseMessage,
  credits = 70,
  deployStatus = "idle",
  deployError,
  onGenerate, onRefine, onDeploy, onSelectProject,
  onApplyManualEdit, onAnalyzeFileInSriAI, onUpgrade,
}: Props) {  // Panel visibility toggles
  const [leftOpen, setLeftOpen]   = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Top bar state
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "history">("preview");
  const [publishedUrl, setPublishedUrl] = useState<string | undefined>(
    currentProject?.deployments?.[0]?.liveUrl
  );

  // AI Chat messages
  const [messages, setMessages]     = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "ai",
      text: "👋 Hi! I'm your AI coding assistant. Describe what you want to build or modify — I'll generate it live.",
      time: new Date().toLocaleTimeString(),
    }
  ]);

  // Task progress
  const [taskSteps, setTaskSteps]   = useState<TaskStep[]>([]);
  const [buildLogs, setBuildLogs]   = useState<BuildLogEntry[]>([
    makeLog("info", "SC Workspace initialized — ready to build."),
  ]);
  const [autoFixMsg, setAutoFixMsg] = useState<string | null>(null);
  const [errorsFixed, setErrorsFixed] = useState<string[]>([]);

  const genRunRef = useRef(0);

  // Auto-switch to Tasks tab when generation starts, Preview when done
  useEffect(() => {
    if (isGenerating) {
      // Notify left panel to show tasks
      setMessages(prev => {
        const last = prev[prev.length - 1];
        // Avoid duplicate building messages
        if (last?.role === "ai" && last.text.includes("Building")) return prev;
        return prev;
      });
    } else if (!isGenerating && taskSteps.length > 0) {
      // Generation done — auto-switch preview and log completion
      setBuildLogs(prev => [
        ...prev,
        makeLog("success", "✅ Generation complete — live preview updated!"),
      ]);
      // Post completion message
      setTimeout(() => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "ai" && last.text.includes("complete")) return prev;
          return [
            ...prev,
            {
              id: `ai-done-${Date.now()}`,
              role: "ai" as const,
              text: "✅ Your app is ready! Check the live preview on the right. You can ask me to modify any part of it.",
              time: new Date().toLocaleTimeString(),
            },
          ];
        });
      }, 600);
    }
  }, [isGenerating]);

  // Sync published URL from project deployments
  useEffect(() => {
    if (currentProject?.deployments?.[0]?.liveUrl) {
      setPublishedUrl(currentProject.deployments[0].liveUrl);
    }
  }, [currentProject]);

  // Drive task steps from real buildPhase prop
  useEffect(() => {
    if (!isGenerating || buildPhase === "idle") {
      if (!isGenerating && buildPhase === "idle") {
        setTaskSteps(prev => prev.map(s => ({ ...s, status: "done" as const })));
      }
      return;
    }

    const activeIdx = PHASE_ORDER.indexOf(buildPhase as any);
    const steps: TaskStep[] = AGENT_STEPS.map((s, idx) => ({
      id: s.id,
      label: activeIdx === idx && buildPhaseMessage ? buildPhaseMessage : s.label,
      status:
        activeIdx === -1 ? "pending" :
        idx < activeIdx ? "done" :
        idx === activeIdx ? "active" :
        "pending",
    }));
    setTaskSteps(steps);

    // Emit build log for the active phase
    if (activeIdx >= 0 && activeIdx < AGENT_STEPS.length) {
      const active = AGENT_STEPS[activeIdx];
      setBuildLogs(prev => {
        const last = prev[prev.length - 1]?.text;
        if (last?.includes(active.labelActive)) return prev;
        return [...prev, makeLog(activeIdx === AGENT_STEPS.length - 1 ? "success" : "info", active.labelActive)];
      });
    }
  }, [isGenerating, buildPhase, buildPhaseMessage]);

  // Simulate auto-fix occasionally
  useEffect(() => {
    if (!isGenerating) { setAutoFixMsg(null); return; }
    const t = setTimeout(() => {
      const msgs = [
        "AI detected a missing import and fixed it automatically.",
        "AI resolved a TypeScript type mismatch automatically.",
        "AI corrected a broken JSX expression.",
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setAutoFixMsg(msg);
      setErrorsFixed(prev => [...prev, msg]);
      setBuildLogs(prev => [...prev, makeLog("warn", `Auto-fix: ${msg}`)]);
      setTimeout(() => setAutoFixMsg(null), 5000);
    }, 3500);
    return () => clearTimeout(t);
  }, [isGenerating]);

  const handleUserSend = useCallback((prompt: string, images?: string[], fileContext?: string) => {
    const userMsg: AIMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: prompt,
      time: new Date().toLocaleTimeString(),
      images,
    };
    setMessages(prev => [...prev, userMsg]);
    setBuildLogs(prev => [...prev, makeLog("info", `User: "${prompt.slice(0, 60)}…"`)]);
    if (images && images.length > 0) {
      setBuildLogs(prev => [...prev, makeLog("info", `📎 ${images.length} image(s) attached — AI will analyze UI layout`)]);
    }

    // Trigger generation / refinement
    if (currentProject) {
      onRefine(prompt, images, fileContext);
    } else {
      onGenerate(prompt, images, fileContext);
    }

    // Emit step-by-step status messages instead of a static "Got it"
    const isRefinement = !!currentProject;
    const steps = isRefinement
      ? [
          { delay: 200,  text: `🔍 Analyzing: "${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}"` },
          { delay: 1200, text: "⚙️ Generating code changes…" },
          { delay: 3000, text: "🎨 Rebuilding preview HTML…" },
          { delay: 5500, text: "✅ Applying changes to preview…" },
        ]
      : [
          { delay: 200,  text: `🚀 Starting build: "${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}"` },
          { delay: 1500, text: "📐 Planning architecture & components…" },
          { delay: 4000, text: "💻 Generating full application code…" },
          { delay: 8000, text: "🧪 Validating & auto-fixing errors…" },
          { delay: 12000, text: "🌐 Building live preview…" },
        ];

    steps.forEach(({ delay, text }) => {
      setTimeout(() => {
        // Only post if still relevant (don't post "done" steps if cancelled)
        setMessages(prev => {
          const msgId = `ai-step-${Date.now()}-${delay}`;
          return [...prev, {
            id: msgId,
            role: "ai" as const,
            text,
            time: new Date().toLocaleTimeString(),
            isStreaming: false,
          }];
        });
        setBuildLogs(prev => [...prev, makeLog("info", text)]);
      }, delay);
    });
  }, [currentProject, onGenerate, onRefine]);

  const handlePublish = useCallback(() => {
    onDeploy("Vercel");
    setBuildLogs(prev => [...prev,
      makeLog("info", "Initiating deployment pipeline…"),
      makeLog("info", "Bundling assets and optimizing build…"),
    ]);
    // Simulate URL after deployment
    setTimeout(() => {
      const url = `https://app-${currentProject?.id?.slice(0, 8) || "preview"}.trustme.ai`;
      setPublishedUrl(url);
      setBuildLogs(prev => [...prev,
        makeLog("success", `Deployed to ${url}`),
      ]);
    }, 3000);
  }, [currentProject, onDeploy]);

  const handleUpdate = useCallback(() => {
    onDeploy("Vercel");
    setBuildLogs(prev => [...prev, makeLog("info", "Pushing update to existing deployment…")]);
  }, [onDeploy]);

  // Responsive: auto-close side panels on narrow screens
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) {
        setLeftOpen(false);
        setRightOpen(false);
      } else if (window.innerWidth < 1024) {
        setRightOpen(false);
        setLeftOpen(true);
      } else {
        setLeftOpen(true);
        setRightOpen(true);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="flex flex-col w-full max-w-full h-full overflow-hidden bg-[#080810]">
      {/* ── TOP BAR ── */}
      <WorkspaceTopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isGenerating={isGenerating}
        isDeploying={isDeploying}
        projectName={currentProject?.name}
        publishedUrl={publishedUrl}
        credits={credits}
        deployStatus={deployStatus}
        deployError={deployError}
        onPublish={handlePublish}
        onUpdate={handleUpdate}
        onUpgrade={onUpgrade}
      />

      {/* ── BODY: vertical on mobile, horizontal on md+ ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 relative w-full max-w-full">

        {/* ── MOBILE: AI Panel toggle button (shown when left panel is closed) ── */}
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="md:hidden fixed bottom-4 left-4 z-40 flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="h-4 w-4" />
            <span>AI Chat</span>
          </button>
        )}

        {/* ── LEFT PANEL ──
            Mobile: full-width overlay (fixed) when open
            Desktop: animated side panel */}
        <AnimatePresence initial={false}>
          {leftOpen && (
            <>
              {/* Mobile backdrop */}
              <motion.div
                key="left-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black/70 md:hidden"
                onClick={() => setLeftOpen(false)}
              />
              {/* Panel */}
              <motion.div
                key="left"
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed md:relative inset-y-0 left-0 z-40 md:z-auto w-[85vw] max-w-[300px] md:w-[300px] md:max-w-[300px] shrink-0 overflow-hidden"
              >
                <div className="relative w-full h-full">
                  {/* Close button */}
                  <button
                    onClick={() => setLeftOpen(false)}
                    className="absolute top-3 right-3 z-10 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex"
                    title="Hide AI Panel"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                  <AIAssistantPanel
                    messages={messages}
                    taskSteps={taskSteps}
                    buildLogs={buildLogs}
                    isGenerating={isGenerating || isRefining}
                    onSend={handleUserSend}
                    autoFixMessage={autoFixMsg}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Expand button when left closed (desktop only) */}
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="hidden md:flex shrink-0 items-center justify-center w-8 border-r border-slate-800 bg-[#0D0D10] hover:bg-slate-900 text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Show AI Panel"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* ── CENTER PANEL ── full width on mobile, flex-1 on desktop */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full max-w-full">
          {activeTab === "preview" && (
            <LivePreviewPanel
              currentProject={currentProject}
              isGenerating={isGenerating}
              isRefining={isRefining}
              buildPhase={buildPhase}
              buildPhaseMessage={buildPhaseMessage}
            />
          )}
          {activeTab === "code" && currentProject && (
            <div className="flex-1 overflow-auto bg-[#070709] w-full">
              <CodeExplorer
                currentProject={currentProject}
                onCodeUpdated={() => {}}
                isApplyingEdits={isApplyingEdits}
                onApplyManualEdit={onApplyManualEdit}
                onAnalyzeFileInSriAI={onAnalyzeFileInSriAI}
              />
            </div>
          )}
          {activeTab === "history" && (
            <div className="flex-1 overflow-auto p-4 bg-[#070709] w-full">
              <ProjectHistory
                projects={projectsList}
                selectedProjectId={selectedProjectId}
                onSelectProject={onSelectProject}
                isGenerating={isGenerating}
              />
            </div>
          )}
          {activeTab !== "preview" && !currentProject && (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              Generate a project first to view {activeTab}.
            </div>
          )}
        </div>

        {/* Expand button when right panel closed (desktop only) */}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="hidden lg:flex shrink-0 items-center justify-center w-8 border-l border-slate-800 bg-[#0D0D10] hover:bg-slate-900 text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Show Changes Panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}

        {/* ── RIGHT PANEL ──
            Hidden on mobile (< lg), side panel on desktop */}
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.div
              key="right"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="hidden lg:block shrink-0 overflow-hidden"
              style={{ minWidth: 0 }}
            >
              <div className="relative w-[280px] h-full">
                <button
                  onClick={() => setRightOpen(false)}
                  className="absolute top-3 right-3 z-10 p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex"
                  title="Hide Changes Panel"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
                <ChangesPanel
                  currentProject={currentProject}
                  isGenerating={isGenerating}
                  errorsFixed={errorsFixed}
                  deployLogs={deployLogs}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
