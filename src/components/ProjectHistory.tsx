import React from "react";
import { 
  History, 
  Sparkles, 
  ChevronRight, 
  Trash2, 
  Clock, 
  Monitor, 
  Activity,
  Layers
} from "lucide-react";
import { ProjectSummary } from "../types";

interface ProjectHistoryProps {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  isGenerating: boolean;
}

export default function ProjectHistory({
  projects,
  selectedProjectId,
  onSelectProject,
  isGenerating
}: ProjectHistoryProps) {
  return (
    <div className="bg-[#0F0F11] p-5 border border-slate-800 rounded-xl h-full flex flex-col select-none shadow-md">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
          <History className="h-4 w-4 text-blue-400" />
          Creations History
        </h3>
        <span className="text-[10px] bg-blue-950/40 border border-blue-900/40 text-blue-400 px-2.5 py-0.5 rounded font-mono">
          {projects.length} Saved
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 h-52">
          <Activity className="h-8 w-8 text-slate-700 mb-2" />
          <p className="text-[11px] font-mono leading-relaxed uppercase tracking-wider">
            SYSTEM CACHE CLEAN. NO PROJECTS COMPILED YET.
          </p>
        </div>
      ) : (
        <div id="projects-history-scroller" className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px]">
          {projects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            const timeFormatted = new Date(project.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            return (
              <button
                key={project.id}
                id={`project-history-link-${project.id}`}
                disabled={isGenerating}
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left p-3 rounded border text-xs transition-all flex items-start gap-2.5 cursor-pointer relative group ${
                  isSelected
                    ? "bg-blue-950/40 border-blue-500 text-white"
                    : "bg-[#16161A]/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-[#16161A]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold truncate text-slate-200 group-hover:text-white transition-colors">
                      {project.name}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mb-1.5 leading-normal">
                    {project.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono leading-none">
                    <Clock className="h-3 w-3" />
                    <span>{timeFormatted}</span>
                    {project.deploymentsCount > 0 && (
                      <span className="bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 px-1 py-0.5 rounded leading-none font-bold">
                        LIVE
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
