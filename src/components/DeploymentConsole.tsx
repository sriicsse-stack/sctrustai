import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Rocket,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Zap,
  Copy,
  Globe,
  Monitor,
} from "lucide-react";
import { ProjectDetails } from "../types";

interface DeploymentConsoleProps {
  currentProject: ProjectDetails;
  isDeploying: boolean;
  onDeploy: (platform: string) => void;
  deployLogs: string[];
  onLaunchSimulator?: () => void;
}

export default function DeploymentConsole({
  currentProject,
  isDeploying,
  onDeploy,
  deployLogs,
  onLaunchSimulator,
}: DeploymentConsoleProps) {
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [deployLogs]);

  const liveUrl = currentProject.deployments?.length
    ? currentProject.deployments[0]?.liveUrl
    : currentProject.publishedUrl ?? null;

  const isAlreadyDeployed = !!liveUrl;

  const handleCopy = () => {
    if (!liveUrl) return;
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full gap-6">

      {/* ── Left panel: publish action ─────────────────────────────────────── */}
      <div className="w-full lg:w-80 flex flex-col gap-5 select-none">

        {/* Publish card */}
        <div className="bg-[#0F0F11] p-5 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-400" />
            Publish to Web
          </h3>
          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
            Uploads your app to public storage and returns a shareable URL accessible by anyone without sign-in.
          </p>

          <div className="space-y-2">
            <button
              id="trigger-deploy-btn"
              onClick={() => onDeploy("Vercel")}
              disabled={isDeploying}
              className={`w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20 cursor-pointer ${
                isDeploying ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isDeploying ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Deploying…</>
              ) : (
                <><Rocket className="h-4 w-4 -rotate-45" />{isAlreadyDeployed ? "Deploy New Version" : "Deploy to Vercel"}</>
              )}
            </button>

            {isAlreadyDeployed && (
              <button
                id="redeploy-btn"
                onClick={() => onDeploy("Vercel")}
                disabled={isDeploying}
                className={`w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 cursor-pointer ${
                  isDeploying ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isDeploying ? (
                  <><RotateCcw className="h-4 w-4 animate-spin" />Re-deploying…</>
                ) : (
                  <><Zap className="h-4 w-4" />Re-deploy (Overwrite)</>
                )}
              </button>
            )}

            {isAlreadyDeployed && !isDeploying && (
              <p className="text-[10px] text-slate-500 text-center px-1">
                Re-publish overwrites the live URL with your latest changes
              </p>
            )}
          </div>
        </div>

        {/* Live URL card — only when deployed */}
        {isAlreadyDeployed && liveUrl && (
          <div className="bg-[#0F0F11] p-5 border border-emerald-900/50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
                Live App URL
              </span>
            </div>

            {/* Copyable URL field */}
            <div className="flex items-center gap-2 bg-[#0A0A0B] border border-slate-700 rounded-lg px-3 py-2 mb-3">
              <span className="flex-1 text-[11px] font-mono text-slate-300 truncate min-w-0" title={liveUrl}>
                {liveUrl}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                title="Copy URL"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex gap-2">
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open App
              </a>
              {onLaunchSimulator && (
                <button
                  onClick={onLaunchSimulator}
                  className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Preview in-app"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Preview
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: terminal output ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#0F0F11] border border-slate-800 rounded-xl overflow-hidden min-h-[380px] shadow-2xl">
        <div className="bg-[#16161A] px-4 py-3 border-b border-slate-800 flex items-center justify-between select-none">
          <span className="text-xs font-bold text-slate-400 font-mono flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            Publish Log
          </span>
          <span className="text-[10px] bg-emerald-950/40 border border-emerald-900/60 font-mono text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" />
            ACTIVE CONSOLE
          </span>
        </div>

        <div className="flex-1 p-5 bg-[#0A0A0B] font-mono text-xs text-slate-300 overflow-y-auto space-y-1.5 leading-relaxed min-h-[220px]">
          {deployLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 font-mono py-16">
              <Terminal className="h-10 w-10 text-slate-800 mb-3" />
              <span>TERMINAL READY — CLICK PUBLISH APP TO START.</span>
            </div>
          ) : (
            deployLogs.map((log, idx) => {
              const isSuccess = log.includes("✅") || log.includes("verified") || log.includes("live") || log.includes("SUCCESSFUL");
              const isError = log.includes("❌") || log.includes("Error") || log.includes("failed");
              return (
                <div
                  key={idx}
                  className={isSuccess ? "text-emerald-400 font-semibold" : isError ? "text-red-400" : "text-slate-300"}
                >
                  <span className="text-blue-500 mr-2">&gt;</span>
                  {log}
                </div>
              );
            })
          )}
          <div ref={terminalBottomRef} />
        </div>
      </div>
    </div>
  );
}

