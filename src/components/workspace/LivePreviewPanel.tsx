import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Monitor, Tablet, Smartphone, RotateCw, ExternalLink,
  Loader2, Globe, CheckCircle2, AlertCircle, Wrench,
  Cpu, FileCode2, Zap, Package
} from "lucide-react";import { ProjectDetails } from "../../types";

interface Props {
  currentProject: ProjectDetails | null;
  isGenerating: boolean;
  isRefining?: boolean;
  buildPhase?: string;
  buildPhaseMessage?: string;
}

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_CONFIG: Record<Device, { maxW: string; label: string; icon: React.ReactNode }> = {
  desktop: { maxW: "w-full",       label: "Desktop", icon: <Monitor className="h-3.5 w-3.5" /> },
  tablet:  { maxW: "max-w-[768px]", label: "Tablet",  icon: <Tablet className="h-3.5 w-3.5" /> },
  mobile:  { maxW: "max-w-[390px]", label: "Mobile",  icon: <Smartphone className="h-3.5 w-3.5" /> },
};

/** Build phases displayed in the generating overlay */
const BUILD_PHASES = [
  { id: "analyze",  label: "Analyzing Requirements",  icon: Cpu,       color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  { id: "plan",     label: "Creating Architecture",    icon: Package,   color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  { id: "generate", label: "Generating Code",          icon: FileCode2, color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
  { id: "validate", label: "Validating Code",          icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { id: "fix",      label: "Auto-Fixing Errors",       icon: Wrench,    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  { id: "deploy",   label: "Building Preview",         icon: Zap,       color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

/**
 * Post-processes generated HTML before injecting into the iframe.
 * Fixes common AI-generated HTML bugs: missing event listeners, broken onclick
 * attributes referencing undefined functions, missing DOMContentLoaded wrappers,
 * and injects a global error safety net.
 */
function enhancePreviewHtml(html: string): string {
  if (!html) return html;

  // 1. Add global error catcher so iframe never shows white screen
  const errorCatcher = `
<script>
window.onerror = function(msg, src, line, col, err) {
  var el = document.getElementById('__err_banner');
  if (el) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
  return true;
};
</script>
<div id="__err_banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#7f1d1d;color:#fca5a5;padding:8px 16px;font-size:12px;font-family:monospace;"></div>`;

  // 2. Ensure all onclick="fn()" references have a safe fallback if fn is not defined
  const safeOnclickWrapper = `
<script>
(function(){
  var _origCall = Function.prototype.call;
  // Wrap each onclick attr with a try-catch after DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    // Re-bind any onclick attributes that reference undefined functions
    document.querySelectorAll('[onclick]').forEach(function(el) {
      var orig = el.getAttribute('onclick');
      el.removeAttribute('onclick');
      el.addEventListener('click', function(e) {
        try { (new Function('event', orig))(e); }
        catch(err) { console.warn('onclick error:', err.message, '| handler:', orig); }
      });
    });

    // Ensure showSection exists if referenced
    if (typeof showSection === 'undefined') {
      window.showSection = function(id) {
        document.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
        var el = document.getElementById(id);
        if (el) el.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
        var nav = document.querySelector('[data-section="'+id+'"]');
        if (nav) nav.classList.add('active');
      };
    }
    // Ensure openModal / closeModal exist
    if (typeof openModal === 'undefined') {
      window.openModal = function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.display='flex'; el.classList.add('show'); }
      };
    }
    if (typeof closeModal === 'undefined') {
      window.closeModal = function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.display='none'; el.classList.remove('show'); }
      };
    }
    // Ensure showToast exists
    if (typeof showToast === 'undefined') {
      window.showToast = function(msg, type) {
        type = type || 'success';
        var colors = { success:'#16a34a', error:'#dc2626', info:'#2563eb', warning:'#d97706' };
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99998;padding:12px 20px;border-radius:10px;color:white;font-size:14px;font-weight:600;font-family:Inter,sans-serif;box-shadow:0 8px 25px rgba(0,0,0,0.4);background:' + (colors[type]||colors.success);
        document.body.appendChild(t);
        setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 3500);
      };
    }
    // Ensure deleteRow exists
    if (typeof deleteRow === 'undefined') {
      window.deleteRow = function(btn) {
        if (confirm('Delete this record?')) {
          var tr = btn.closest('tr');
          if (tr) tr.remove();
          if (typeof showToast !== 'undefined') showToast('Record deleted', 'error');
        }
      };
    }
    // Ensure filterTable exists
    if (typeof filterTable === 'undefined') {
      window.filterTable = function(query) {
        document.querySelectorAll('table tbody tr').forEach(function(r) {
          r.style.display = r.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
        });
      };
    }
    // Wire search inputs that aren't already wired
    document.querySelectorAll('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').forEach(function(inp) {
      if (!inp.dataset.wired) {
        inp.dataset.wired = '1';
        inp.addEventListener('input', function(e) {
          if (typeof filterTable !== 'undefined') filterTable(e.target.value);
        });
      }
    });
    // Wire modal-close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
      if (!overlay.dataset.wired) {
        overlay.dataset.wired = '1';
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) {
            overlay.classList.remove('show');
            overlay.style.display = 'none';
          }
        });
      }
    });
  });
})();
</script>`;

  // 3. Inject before </body>
  if (html.includes("</body>")) {
    html = html.replace("</body>", errorCatcher + safeOnclickWrapper + "\n</body>");
  } else {
    html = html + errorCatcher + safeOnclickWrapper;
  }

  // 4. Ensure sandbox has allow-forms for form submissions
  // (handled in iframe props, not here)

  return html;
}

export default function LivePreviewPanel({ currentProject, isGenerating, isRefining = false, buildPhase, buildPhaseMessage }: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey(k => k + 1);
    setTimeout(() => setLoading(false), 600);
  };

  const handleOpenNew = () => {
    if (currentProject?.previewHtml) {
      const blob = new Blob([currentProject.previewHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  // Post-process the HTML to fix common broken-button patterns
  const enhancedHtml = useMemo(() => {
    if (!currentProject?.previewHtml) return null;
    return enhancePreviewHtml(currentProject.previewHtml);
  }, [currentProject?.previewHtml]);

  const currentPhaseIndex = BUILD_PHASES.findIndex(p => p.id === buildPhase);

  return (
    <div className="flex flex-col h-full w-full max-w-full bg-[#080810] overflow-hidden">
      {/* Device toolbar */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5 border-b border-slate-800 bg-[#0D0D10] shrink-0 w-full max-w-full overflow-hidden">
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 gap-0.5">
          {(Object.keys(DEVICE_CONFIG) as Device[]).map(d => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              title={DEVICE_CONFIG[d].label}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                device === d ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {device === d && (
                <motion.span
                  layoutId="deviceTabBg"
                  className="absolute inset-0 bg-slate-700 rounded-md"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {DEVICE_CONFIG[d].icon}
                <span className="hidden md:inline">{DEVICE_CONFIG[d].label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
            isGenerating
              ? "bg-blue-950/40 border-blue-900/30 text-blue-400"
              : "bg-emerald-950/40 border-emerald-900/30 text-emerald-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isGenerating ? "bg-blue-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`} />
            {isGenerating ? (buildPhaseMessage || "Building…") : "Live"}
          </div>
          <button onClick={handleRefresh} title="Reload preview" className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer">
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleOpenNew} title="Open in new tab" disabled={!enhancedHtml} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-start justify-center p-2 md:p-4 overflow-auto min-h-0 w-full max-w-full bg-[#0A0A0D]">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full w-full max-w-sm gap-6 text-center"
            >
              {/* Animated AI brain icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center">
                  <Loader2 className="h-9 w-9 text-blue-400 animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-blue-500/10 animate-ping opacity-40" />
                <div className="absolute -inset-6 rounded-3xl border border-purple-500/5 animate-ping opacity-20" style={{ animationDelay: "0.5s" }} />
              </div>

              <div>
                <p className="text-base font-bold text-white">AI is building your app</p>
                <p className="text-xs text-slate-500 mt-1">
                  {buildPhaseMessage || "Initializing multi-agent pipeline…"}
                </p>
              </div>

              {/* Real phase steps */}
              <div className="w-full space-y-2">
                {BUILD_PHASES.map((phase, idx) => {
                  const Icon = phase.icon;
                  const isDone    = currentPhaseIndex > idx;
                  const isActive  = currentPhaseIndex === idx;
                  const isPending = currentPhaseIndex < idx;
                  return (
                    <div
                      key={phase.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                        isActive  ? `${phase.bg} scale-[1.02]` :
                        isDone    ? "bg-slate-900/40 border-slate-700/30 opacity-60" :
                                    "bg-slate-900/20 border-slate-800/20 opacity-30"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                        isDone ? "bg-emerald-500/20" : isActive ? phase.bg : "bg-slate-800"
                      }`}>
                        {isDone
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          : isActive
                            ? <Icon className={`h-3.5 w-3.5 ${phase.color} animate-pulse`} />
                            : <Icon className="h-3.5 w-3.5 text-slate-600" />
                        }
                      </div>
                      <span className={`text-xs font-medium ${
                        isDone ? "text-emerald-400" : isActive ? "text-white" : "text-slate-600"
                      }`}>
                        {phase.label}
                      </span>
                      {isActive && (
                        <div className="ml-auto flex gap-0.5">
                          {[0,1,2].map(i => (
                            <div key={i} className={`w-1 h-1 rounded-full ${phase.color.replace("text-","bg-")} animate-bounce`}
                              style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                      {isDone && <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : !currentProject ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full w-full gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                <Globe className="h-8 w-8 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400">No Preview Yet</p>
                <p className="text-xs text-slate-600 mt-1">Describe your app and hit Generate</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={device}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`h-full ${DEVICE_CONFIG[device].maxW} w-full max-w-full rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-slate-700/40 relative`}
              style={{ background: "#0f172a" }}
            >
              {loading && (
                <div className="absolute inset-0 bg-[#0A0A0D]/80 z-10 flex items-center justify-center rounded-xl">
                  <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                </div>
              )}
              {/* Refine overlay — shown while applying chat changes, preview still visible beneath */}
              {isRefining && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-xl"
                  style={{ background: "rgba(9,11,17,0.82)", backdropFilter: "blur(4px)" }}>
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/30 border border-violet-500/30 flex items-center justify-center">
                      <Wrench className="h-7 w-7 text-violet-400 animate-pulse" />
                    </div>
                    <div className="absolute -inset-2 rounded-3xl border border-violet-500/10 animate-ping opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">
                      {buildPhase === "analyze" ? "Analyzing request…" :
                       buildPhase === "generate" ? "Generating changes…" :
                       buildPhase === "fix" ? "Rebuilding preview…" :
                       buildPhase === "deploy" ? "Applying to preview…" :
                       buildPhase === "complete" ? "Preview updated! ✅" :
                       "Applying changes…"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{buildPhaseMessage || "Updating your app"}</p>
                  </div>
                  {/* Mini step dots */}
                  <div className="flex items-center gap-2">
                    {["analyze","generate","fix","deploy"].map((phase, i) => {
                      const phases = ["analyze","generate","fix","deploy"];
                      const currentIdx = phases.indexOf(buildPhase || "");
                      const isDone = currentIdx > i;
                      const isActive = currentIdx === i;
                      return (
                        <div key={phase} className={`h-2 rounded-full transition-all duration-300 ${
                          isDone ? "w-6 bg-emerald-400" :
                          isActive ? "w-6 bg-violet-400 animate-pulse" :
                          "w-2 bg-slate-700"
                        }`} />
                      );
                    })}
                  </div>
                </div>
              )}
              <iframe
                key={iframeKey}
                title="Live Preview"
                srcDoc={enhancedHtml ?? "<body style='background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:14px;'>Loading preview…</body>"}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                style={{ minHeight: "400px" }}
                onLoad={() => setLoading(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
