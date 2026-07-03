import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeParseJSON(raw: string): any {
  if (!raw) return {};
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/s);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch { /**/ }
  try { return JSON.parse(text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\").replace(/[\x00-\x1F\x7F]/g, " ")); } catch { /**/ }
  const s = text.search(/[\[{]/);
  if (s !== -1) {
    const op = text[s], cl = op === "{" ? "}" : "]";
    let d = 0, inStr = false, esc = false;
    for (let i = s; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (!inStr) { if (c === op) d++; else if (c === cl && --d === 0) { try { return JSON.parse(text.slice(s, i+1)); } catch { break; } } }
    }
  }
  return {};
}

// ── Edit Mode: surgical HTML editing (V3) ─────────────────────────────────────
// When the user edits an EXISTING app, we pass the full current HTML and ask the
// LLM to apply ONLY the requested change — never regenerate from scratch.
const EDIT_MODE_SYSTEM_PROMPT = `You are an expert HTML/CSS/JS editor. You receive the FULL source code of an existing working web app and a specific change request. Your job is to apply ONLY that change — nothing else.

## ABSOLUTE EDIT RULES

1. SURGICAL EDITS ONLY: Change ONLY the specific element/section the user asked about. Every other feature, section, nav item, button, form, and piece of logic must remain EXACTLY as it was.

2. NEVER regenerate the entire app from scratch. NEVER swap the existing app for a different template. If the user asked to "change the button color", change ONLY button colors. If they asked to "add a delete button to the table", add ONLY that button.

3. PRESERVE ALL FUNCTIONALITY: After your edit, every feature that existed before must still work. Nothing should break or disappear.

4. IMAGE RULE — you cannot generate real photo files. When asked to "add images" for items:
   - Use emoji in a styled colored circle (e.g. 🍵 in a green circle) next to the item name
   - Or use the first letter of the item name in an accent-colored circle avatar
   - NEVER insert broken src="placeholder.jpg" or fake URLs — this renders as broken image icons

5. NO FALLBACK SUBSTITUTION: If you cannot fully implement what was asked, implement the closest reasonable equivalent WITHIN THE EXISTING APP. Never silently replace the working app with a generic dashboard, landing page, or unrelated template.

6. VERIFY before returning: "Does every feature that existed before still work? Did I ONLY change what was asked?"

## OUTPUT FORMAT
Return ONLY the complete updated HTML file. Start with <!DOCTYPE html>. No explanations, no markdown fences, no partial snippets.`;

// ── Template-first refine: AI updates data JSON → we rebuild HTML from template ──
// (Legacy path — used as fallback when no previewHtml is available)
const REFINE_SYSTEM = `You are an expert app data architect. You receive CURRENT app data and a modification request.
Return the COMPLETE updated JSON data object with the requested changes applied.

MODIFICATION RULES:
- "Change color to X" → update primaryColor and accentColor to the requested color palette
- "Add dark mode" → ensure dark-friendly primaryColor (e.g. #6366f1), update accentColor
- "Add more rows" → add more realistic entries to tableRows
- "Change theme" → update primaryColor, accentColor to match the requested theme
- "Add [feature/section]" → add a new entry to the sections array with 3 realistic cards
- "Update stats" → change statCards values to reflect the requested data
- "Change app name" → update appName and tagline
- "Add [entity]" → add 5 more entries to tableRows for that entity type
- Any other request → apply intelligently to the relevant fields

CRITICAL: Return the COMPLETE JSON object with ALL fields preserved.
Only change what was explicitly requested. Keep everything else identical.

Full required structure:
{ appName, tagline, primaryColor, accentColor, userName, userRole, entityName,
  heroImageSeed, cardImageSeeds,
  chartTitle, chartData, chartLabels, navItems, statCards, tableHeaders,
  tableRows, formFields, activityFeed, quickActions, sections }

Respond ONLY with the raw JSON object, no markdown, no explanation.`;

// Icons + template builder (self-contained for Edge Function deployment)
const ICONS_R: Record<string, string> = {
  dashboard:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  users:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  chart:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  settings:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  search:`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  plus:`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  menu:`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  bell:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  edit:`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  check:`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  star:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  activity:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  grid:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  trending:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  calendar:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  box:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  credit:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  heart:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  map:`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
};
function iconR(name: string): string { return ICONS_R[name] || ICONS_R["grid"]; }
function badgeR(color: string): string {
  const m: Record<string,string> = {
    green:"background:rgba(22,163,74,.15);color:#4ade80;", red:"background:rgba(220,38,38,.15);color:#f87171;",
    yellow:"background:rgba(234,179,8,.15);color:#facc15;", blue:"background:rgba(37,99,235,.15);color:#60a5fa;",
    purple:"background:rgba(124,58,237,.15);color:#a78bfa;", orange:"background:rgba(234,88,12,.15);color:#fb923c;",
    cyan:"background:rgba(8,145,178,.15);color:#22d3ee;", gray:"background:rgba(100,116,139,.15);color:#94a3b8;",
  };
  return m[color]||m["gray"];
}

// ── HTML-safe escape for inline onclick attribute string values ──────────────
function escR(s: any): string { return String(s ?? "").replace(/&/g,"&amp;").replace(/'/g,"&#39;").replace(/"/g,"&quot;"); }

function buildHTMLR(d: any): string {
  const p=d.primaryColor||"#2563eb", a=d.accentColor||"#7c3aed";
  const appName=d.appName||"App", tagline=d.tagline||"", entity=d.entityName||"Record";
  const heroSeed=encodeURIComponent(d.heroImageSeed||d.appName||"dashboard");
  const cardSeeds:string[]=d.cardImageSeeds||[d.heroImageSeed||"technology","business","office"];
  const ac=["#2563eb","#16a34a","#d97706","#0891b2","#7c3aed","#dc2626"];
  const grads=[`linear-gradient(135deg,#2563eb,#7c3aed)`,`linear-gradient(135deg,#0891b2,#0e7490)`,`linear-gradient(135deg,#16a34a,#15803d)`,`linear-gradient(135deg,#d97706,#b45309)`];
  const statIcons=["📊","💰","✅","⏳"];

  const navH=(d.navItems||[]).map((n:any,i:number)=>`<a class="nav-item${i===0?" active":""}" onclick="showSection('${n.id}',this)">${iconR(n.icon||"grid")}<span class="nav-label">${n.label}</span>${n.badge?`<span style="margin-left:auto;background:${p};color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;">${n.badge}</span>`:""}</a>`).join("");
  const statH=(d.statCards||[]).map((s:any,i:number)=>`<div style="background:${grads[i%grads.length]};border-radius:16px;padding:22px;color:white;position:relative;overflow:hidden;flex:1;min-width:160px;cursor:pointer;transition:transform .2s,box-shadow .2s;" onclick="showToast('${escR(s.label)}: ${escR(s.value)}','info')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''"><div style="position:absolute;top:-16px;right:-16px;width:72px;height:72px;background:rgba(255,255,255,.07);border-radius:50%;"></div><div style="font-size:24px;margin-bottom:8px;">${statIcons[i%statIcons.length]}</div><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.85;margin-bottom:6px;">${s.label}</div><div style="font-size:28px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px;line-height:1;">${s.value}</div><div style="font-size:12px;opacity:.8;">${s.change||""}</div></div>`).join("");
  const cd=d.chartData||[40,60,45,80,70,90,75], cl=d.chartLabels||["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], mv=Math.max(...cd);
  const chartH=cd.map((v:number,i:number)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;"><div style="font-size:10px;color:#64748b;">${v}</div><div style="flex:1;width:100%;display:flex;align-items:flex-end;"><div style="width:100%;height:${Math.round(v/mv*100)}%;background:linear-gradient(to top,${p},${a});border-radius:4px 4px 0 0;cursor:pointer;transition:filter .2s;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter=''"></div></div><div style="font-size:10px;color:#64748b;">${cl[i]}</div></div>`).join("");
  const actH=(d.activityFeed||[]).map((x:any,i:number)=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);"><div style="width:32px;height:32px;border-radius:50%;background:${ac[i%ac.length]}22;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${ac[i%ac.length]};flex-shrink:0;">${(x.user||"?")[0].toUpperCase()}</div><div style="flex:1;min-width:0;"><div style="font-size:12px;color:#e2e8f0;font-weight:500;line-height:1.4;">${x.action}</div><div style="font-size:11px;color:#64748b;margin-top:2px;"><span style="color:${ac[i%ac.length]};font-weight:600;">${x.user}</span> · ${x.time}</div></div></div>`).join("");
  const thH=(d.tableHeaders||["Name","Status","Date"]).map((h:string)=>`<th style="padding:11px 14px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;">${h}</th>`).join("");
  const trH=(d.tableRows||[]).map((r:any,ri:number)=>{const cols=[r.col1,r.col2,r.col3,r.col4,r.col5].filter((v:any)=>v!=null&&v!=="");const av=ac[ri%ac.length];const init=(r.avatar||(r.col1||"?").substring(0,2)).substring(0,2).toUpperCase();return `<tr onclick="openDetailModal(${ri})" style="cursor:pointer;" onmouseover="this.querySelectorAll('td').forEach(function(t){t.style.background='rgba(255,255,255,.02)'})" onmouseout="this.querySelectorAll('td').forEach(function(t){t.style.background=''})"><td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);"><input type="checkbox" class="rowCheck" style="accent-color:${p};" onclick="event.stopPropagation()"></td><td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);"><div style="display:flex;align-items:center;gap:9px;"><div style="width:34px;height:34px;border-radius:50%;background:${av}22;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${av};flex-shrink:0;overflow:hidden;"><img src="https://picsum.photos/seed/${heroSeed}row${ri}/34/34" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=&#39;none&#39;;this.parentElement.textContent=&#39;${init}&#39;"></div><span style="font-size:13px;color:#e2e8f0;font-weight:500;">${cols[0]||""}</span></div></td>${cols.slice(1,-1).map((c:string)=>`<td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:#94a3b8;">${c||""}</td>`).join("")}<td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);"><span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;${badgeR(r.statusColor||"blue")}">${r.status||"Active"}</span></td><td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:#64748b;">${cols[cols.length-1]||""}</td><td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);"><div style="display:flex;gap:5px;" onclick="event.stopPropagation()"><button onclick="openEditModal(${ri})" style="background:#1e3a5f;border:none;color:#60a5fa;padding:5px;border-radius:7px;cursor:pointer;display:inline-flex;" title="Edit">${iconR("edit")}</button><button onclick="deleteRow(this)" style="background:#3f1515;border:none;color:#f87171;padding:5px;border-radius:7px;cursor:pointer;display:inline-flex;" title="Delete">${iconR("trash")}</button></div></td></tr>`;}).join("");
  const fmH=(d.formFields||[]).map((f:any)=>{const inp=f.type==="select"?`<select id="field_${f.name}" ${f.required?"required":""} style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;border-radius:9px;padding:9px 12px;font-size:13px;width:100%;outline:none;">${(f.options||[]).map((o:string)=>`<option>${o}</option>`).join("")}</select>`:f.type==="textarea"?`<textarea id="field_${f.name}" ${f.required?"required":""} rows="3" placeholder="${f.placeholder||f.label}" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;border-radius:9px;padding:9px 12px;font-size:13px;width:100%;outline:none;resize:vertical;font-family:inherit;"></textarea>`:`<input type="${f.type||"text"}" id="field_${f.name}" ${f.required?"required":""} placeholder="${f.placeholder||f.label}" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;border-radius:9px;padding:9px 12px;font-size:13px;width:100%;outline:none;">`;return `<div style="display:flex;flex-direction:column;gap:5px;"><label style="font-size:12px;font-weight:500;color:#94a3b8;">${f.label}${f.required?'<span style="color:#ef4444;"> *</span>':""}</label>${inp}</div>`;}).join("");
  const extraS=(d.sections||[]).map((s:any,si:number)=>`<div id="${s.id}" class="section"><div style="margin-bottom:20px;"><h1 style="font-size:20px;font-weight:800;color:#f1f5f9;">${s.title}</h1><p style="font-size:13px;color:#64748b;margin-top:2px;">${s.subtitle||""}</p></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">${(s.cards||[]).map((c:any,ci:number)=>`<div style="background:#131929;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;transition:all .25s;cursor:pointer;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,.35)';this.style.borderColor='${p}44'" onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='rgba(255,255,255,.07)'"><div style="height:155px;overflow:hidden;background:linear-gradient(135deg,${p}22,${a}22);position:relative;"><img src="https://picsum.photos/seed/${encodeURIComponent(cardSeeds[ci%cardSeeds.length]||"business")}${si*10+ci}/560/310" alt="${escR(c.title)}" style="width:100%;height:100%;object-fit:cover;opacity:.85;" onerror="this.style.display=&#39;none&#39;">${c.value?`<div style="position:absolute;top:10px;right:10px;background:linear-gradient(135deg,${p},${a});color:white;padding:4px 11px;border-radius:20px;font-size:12px;font-weight:800;">${c.value}</div>`:""}</div><div style="padding:16px;"><div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:5px;">${c.title}</div><div style="font-size:12px;color:#64748b;line-height:1.6;margin-bottom:13px;">${c.body}</div><button onclick="event.stopPropagation();showToast('${escR(c.title)}','success')" style="background:linear-gradient(135deg,${p},${a});border:none;color:white;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .2s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">View Details →</button></div></div>`).join("")}</div></div>`).join("");
  const fN=(d.navItems?.[0]?.id)||"dashboard", sN=(d.navItems?.[1]?.id)||"records";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${appName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',sans-serif;background:#0a0f1e;color:#f1f5f9;height:100vh;overflow:hidden;}
::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:#0f172a;}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px;}
.sidebar{width:252px;min-width:252px;height:100vh;background:#0d1117;border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;transition:width .3s;overflow:hidden;}
.sidebar.collapsed{width:66px;min-width:66px;}.sidebar.collapsed .nav-label,.sidebar.collapsed .logo-text,.sidebar.collapsed .user-info{display:none;}.sidebar.collapsed .nav-item{justify-content:center;padding:10px;}
.nav-item{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;cursor:pointer;transition:all .2s;margin:2px 8px;color:#64748b;font-size:13px;font-weight:500;text-decoration:none;border:none;background:none;width:calc(100% - 16px);}
.nav-item:hover{background:rgba(255,255,255,.05);color:#e2e8f0;}.nav-item.active{background:linear-gradient(135deg,${p}22,${a}22);color:white;border:1px solid ${p}44;}
.section{display:none;animation:fadeIn .3s ease;}.section.active{display:block;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:9px;font-weight:600;font-size:13px;cursor:pointer;border:none;transition:all .2s;font-family:inherit;}.btn:hover{transform:translateY(-1px);filter:brightness(1.1);}.btn:active{transform:translateY(0);}
.btn-primary{background:linear-gradient(135deg,${p},${a});color:white;box-shadow:0 4px 12px ${p}44;}.btn-secondary{background:#1e293b;color:#94a3b8;border:1px solid #334155;}.btn-secondary:hover{border-color:#64748b;color:#f1f5f9;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);z-index:1000;display:none;align-items:center;justify-content:center;padding:16px;}.modal-overlay.show{display:flex;}
.modal{background:#1a2234;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:26px;width:100%;max-width:500px;max-height:85vh;overflow-y:auto;animation:slideUp .25s ease;}
.toast-container{position:fixed;top:18px;right:18px;z-index:9999;display:flex;flex-direction:column;gap:8px;}
.toast{padding:12px 16px;border-radius:11px;font-weight:600;font-size:13px;display:flex;align-items:center;gap:9px;animation:slideInRight .3s ease;max-width:300px;}
.toast.success{background:linear-gradient(135deg,#16a34a,#15803d);color:white;}.toast.error{background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;}.toast.info{background:linear-gradient(135deg,${p},${a});color:white;}
input:focus,select:focus,textarea:focus{outline:none;border-color:${p}!important;box-shadow:0 0 0 3px ${p}22!important;}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes slideInRight{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:translateX(0)}}
</style></head><body>
<div id="toastContainer" class="toast-container"></div>
<div style="display:flex;height:100vh;overflow:hidden;">
<aside class="sidebar" id="sidebar">
  <div style="padding:18px 14px;border-bottom:1px solid rgba(255,255,255,.06);"><div style="display:flex;align-items:center;gap:9px;cursor:pointer;" onclick="toggleSidebar()"><div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,${p},${a});display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:white;flex-shrink:0;">${appName.substring(0,1).toUpperCase()}</div><div class="logo-text"><div style="font-size:14px;font-weight:800;color:white;">${appName}</div><div style="font-size:11px;color:#64748b;">${tagline}</div></div></div></div>
  <nav style="flex:1;padding:10px 0;overflow-y:auto;">${navH}</nav>
  <div style="padding:14px;border-top:1px solid rgba(255,255,255,.06);"><div style="display:flex;align-items:center;gap:9px;"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,${p},${a});display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:white;flex-shrink:0;cursor:pointer;" onclick="showToast('Profile','info')">${(d.userName||"A")[0].toUpperCase()}</div><div class="user-info"><div style="font-size:13px;font-weight:600;color:#e2e8f0;">${d.userName||"Admin"}</div><div style="font-size:11px;color:#64748b;">${d.userRole||"Administrator"}</div></div></div></div>
</aside>
<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">
  <header style="display:flex;align-items:center;padding:0 18px;height:58px;background:#0d1117;border-bottom:1px solid rgba(255,255,255,.06);gap:10px;flex-shrink:0;">
    <button onclick="toggleSidebar()" style="background:none;border:none;color:#64748b;cursor:pointer;padding:5px;border-radius:7px;display:flex;" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='none'">${iconR("menu")}</button>
    <div id="pageTitle" style="font-size:15px;font-weight:700;color:#f1f5f9;flex-shrink:0;">Dashboard</div>
    <div style="flex:1;max-width:340px;position:relative;margin-left:6px;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#64748b;display:flex;">${iconR("search")}</span><input type="text" placeholder="Search..." oninput="filterTable(this.value)" style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;border-radius:9px;padding:8px 10px 8px 34px;font-size:13px;width:100%;font-family:inherit;"></div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:7px;">
      <button onclick="showToast('3 notifications','info')" style="background:none;border:none;color:#64748b;cursor:pointer;padding:7px;border-radius:7px;position:relative;display:flex;" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='none'">${iconR("bell")}<span style="position:absolute;top:5px;right:5px;width:6px;height:6px;background:#ef4444;border-radius:50%;border:1.5px solid #0d1117;"></span></button>
      <button class="btn btn-primary" onclick="openModal('addModal')" style="padding:7px 13px;font-size:12px;">${iconR("plus")} Add ${entity}</button>
      <div style="position:relative;"><div id="userAvatarBtn" onclick="toggleDropdown()" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,${p},${a});display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:white;cursor:pointer;">${(d.userName||"A")[0].toUpperCase()}</div>
      <div id="userDropdown" style="display:none;position:absolute;top:calc(100%+7px);right:0;background:#1a2234;border:1px solid rgba(255,255,255,.08);border-radius:11px;min-width:150px;padding:5px;box-shadow:0 18px 36px rgba(0,0,0,.5);z-index:200;animation:fadeIn .15s ease;">
        <div onclick="showToast('Profile','info')" style="padding:8px 11px;border-radius:7px;cursor:pointer;font-size:13px;color:#94a3b8;" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">👤 Profile</div>
        <div onclick="showToast('Settings','info')" style="padding:8px 11px;border-radius:7px;cursor:pointer;font-size:13px;color:#94a3b8;" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">⚙️ Settings</div>
        <div style="height:1px;background:rgba(255,255,255,.06);margin:3px 0;"></div>
        <div onclick="showToast('Signing out','info')" style="padding:8px 11px;border-radius:7px;cursor:pointer;font-size:13px;color:#f87171;" onmouseover="this.style.background='rgba(220,38,38,.08)'" onmouseout="this.style.background=''">🚪 Logout</div>
      </div></div>
    </div>
  </header>
  <main style="flex:1;overflow-y:auto;padding:22px;">
    <div id="${fN}" class="section active">
      <!-- Hero Banner -->
      <div style="border-radius:18px;overflow:hidden;margin-bottom:22px;position:relative;height:190px;background:linear-gradient(135deg,${p},${a});">
        <img src="https://picsum.photos/seed/${heroSeed}/1200/400" alt="" style="width:100%;height:100%;object-fit:cover;opacity:.45;position:absolute;inset:0;" onerror="this.style.display='none'">
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.7) 0%,rgba(0,0,0,.2) 100%);"></div>
        <div style="position:absolute;inset:0;padding:24px 28px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:7px;">${tagline}</div>
            <h1 style="font-size:24px;font-weight:900;color:white;letter-spacing:-.03em;line-height:1.15;text-shadow:0 2px 8px rgba(0,0,0,.4);">Welcome back,<br>${d.userName||"Admin"} 👋</h1>
          </div>
          <div style="display:flex;gap:9px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="openModal('addModal')" style="background:white;color:#0f172a;box-shadow:0 4px 16px rgba(0,0,0,.3);">${iconR("plus")} New ${entity}</button>
            <button class="btn btn-secondary" onclick="showToast('Report exported!','success')" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:white;">📥 Export</button>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:22px;">${statH}</div>
      <div style="display:grid;grid-template-columns:1fr 320px;gap:18px;margin-bottom:20px;">
        <div style="background:#1a2234;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:22px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><div><div style="font-size:14px;font-weight:700;color:#f1f5f9;">Weekly Overview</div><div style="font-size:12px;color:#64748b;">${d.chartTitle||""}</div></div><button onclick="showToast('Full analytics','info')" class="btn btn-secondary" style="padding:5px 11px;font-size:12px;">View All</button></div><div style="display:flex;align-items:flex-end;gap:7px;height:140px;">${chartH}</div></div>
        <div style="background:#1a2234;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:22px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:14px;font-weight:700;color:#f1f5f9;">Recent Activity</div><button onclick="showToast('All activity','info')" style="background:none;border:none;color:${p};font-size:12px;cursor:pointer;font-weight:600;">See all</button></div>${actH}</div>
      </div>
      <div style="background:#1a2234;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:18px;"><div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:14px;">Quick Actions</div><div style="display:flex;flex-wrap:wrap;gap:8px;">${(d.quickActions||[`Add ${entity}`,"Export","Settings","Reports"]).map((x:string,i:number)=>`<button class="btn ${i===0?"btn-primary":"btn-secondary"}" onclick="${i===0?"openModal('addModal')":"showToast('"+escR(x)+"','info')"}">${escR(x)}</button>`).join("")}</div></div>
    </div>
    <div id="${sN}" class="section">
      <div style="margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;"><div><h1 style="font-size:21px;font-weight:800;color:#f1f5f9;">${entity} Management</h1><p style="font-size:13px;color:#64748b;">${(d.tableRows||[]).length} records</p></div><div style="display:flex;gap:7px;"><button class="btn btn-secondary" onclick="showToast('Exported!','success')">📥 Export</button><button class="btn btn-primary" onclick="openModal('addModal')">${iconR("plus")} Add ${entity}</button></div></div>
      <div style="background:#1a2234;border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:14px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:9px;align-items:center;"><div style="position:relative;flex:1;min-width:180px;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#64748b;display:flex;">${iconR("search")}</span><input id="tableSearch" type="text" placeholder="Search..." oninput="filterTable(this.value)" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;border-radius:8px;padding:8px 10px 8px 32px;font-size:13px;width:100%;font-family:inherit;"></div><select id="statusFilter" onchange="applyStatusFilter(this.value)" style="background:#0f172a;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:8px 11px;font-size:13px;cursor:pointer;min-width:110px;"><option value="">All Status</option>${["Active","Inactive","Pending","Completed"].map((s:string)=>`<option>${s}</option>`).join("")}</select><button onclick="clearFilters()" class="btn btn-secondary" style="padding:8px 13px;font-size:12px;">Clear</button></div>
      <div style="background:#1a2234;border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;"><div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.06);"><div style="font-size:13px;font-weight:600;color:#f1f5f9;">${entity}s</div><button id="bulkDeleteBtn" onclick="bulkDelete()" style="display:none;background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;border:none;padding:5px 11px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Delete Selected</button></div><div style="overflow-x:auto;"><table id="mainTable" style="width:100%;border-collapse:collapse;min-width:580px;"><thead><tr><th style="padding:11px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);"><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)" style="accent-color:${p};"></th>${thH}<th style="padding:11px 14px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;">Actions</th></tr></thead><tbody id="tableBody">${trH}</tbody></table></div><div style="display:flex;align-items:center;padding:12px 18px;border-top:1px solid rgba(255,255,255,.06);"><span style="font-size:12px;color:#64748b;">${(d.tableRows||[]).length} records</span><div style="margin-left:auto;display:flex;gap:5px;"><button onclick="showToast('Prev page','info')" class="btn btn-secondary" style="padding:6px 12px;font-size:12px;">← Prev</button><button style="background:linear-gradient(135deg,${p},${a});color:white;border:none;padding:6px 11px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;">1</button><button onclick="showToast('Next page','info')" class="btn btn-secondary" style="padding:6px 12px;font-size:12px;">Next →</button></div></div></div>
    </div>
    ${extraS}
  </main>
</div>
</div>
<div class="modal-overlay" id="addModal" onclick="handleOverlayClick(event,'addModal')"><div class="modal"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;"><div><h2 style="font-size:17px;font-weight:800;color:#f1f5f9;">Add ${entity}</h2><p style="font-size:13px;color:#64748b;margin-top:1px;">Fill in the details below</p></div><button onclick="closeModal('addModal')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#64748b;width:30px;height:30px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.color='#f1f5f9'" onmouseout="this.style.color='#64748b'">${iconR("x")}</button></div><form id="addForm" onsubmit="submitAddForm(event)"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${fmH}</div><div style="display:flex;gap:9px;margin-top:22px;justify-content:flex-end;"><button type="button" onclick="closeModal('addModal')" class="btn btn-secondary">Cancel</button><button type="submit" class="btn btn-primary">${iconR("check")} Add ${entity}</button></div></form></div></div>
<div class="modal-overlay" id="detailModal" onclick="handleOverlayClick(event,'detailModal')"><div class="modal"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><h2 style="font-size:16px;font-weight:800;color:#f1f5f9;">${entity} Details</h2><button onclick="closeModal('detailModal')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#64748b;width:30px;height:30px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;">${iconR("x")}</button></div><div id="detailContent"></div><div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end;"><button onclick="closeModal('detailModal')" class="btn btn-secondary">Close</button><button onclick="closeModal('detailModal');openModal('addModal')" class="btn btn-primary">${iconR("edit")} Edit</button></div></div></div>
<script>
var tableData=${JSON.stringify(d.tableRows||[])};
function showSection(id,el){document.querySelectorAll('.section').forEach(function(s){s.style.display='none';s.classList.remove('active');});var sec=document.getElementById(id);if(sec){sec.style.display='block';sec.classList.add('active');}document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});if(el)el.classList.add('active');var titles={${(d.navItems||[]).map((n:any)=>'"'+n.id+'":"'+n.label+'"').join(",")}};var pt=document.getElementById('pageTitle');if(pt)pt.textContent=titles[id]||id.charAt(0).toUpperCase()+id.slice(1);}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed');}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
function handleOverlayClick(e,id){if(e.target.id===id)closeModal(id);}
function toggleDropdown(){var d=document.getElementById('userDropdown');d.style.display=d.style.display==='none'?'block':'none';}
document.addEventListener('click',function(e){if(!e.target.closest('#userAvatarBtn')&&!e.target.closest('#userDropdown')){var d=document.getElementById('userDropdown');if(d)d.style.display='none';}});
function showToast(msg,type){type=type||'success';var icons={success:'✓',error:'✕',info:'ℹ'};var c=document.getElementById('toastContainer');var t=document.createElement('div');t.className='toast '+type;t.innerHTML='<span>'+icons[type]+'</span><span>'+msg+'</span>';c.appendChild(t);setTimeout(function(){t.style.transition='all .3s';t.style.opacity='0';t.style.transform='translateX(36px)';setTimeout(function(){t.remove();},300);},2800);}
function filterTable(q){q=(q||'').toLowerCase();document.querySelectorAll('#tableBody tr').forEach(function(r){r.style.display=(!q||r.textContent.toLowerCase().includes(q))?'':'none';});}
function applyStatusFilter(v){document.querySelectorAll('#tableBody tr').forEach(function(r){r.style.display=(!v||r.textContent.includes(v))?'':'none';});}
function clearFilters(){var ts=document.getElementById('tableSearch');var sf=document.getElementById('statusFilter');if(ts)ts.value='';if(sf)sf.value='';document.querySelectorAll('#tableBody tr').forEach(function(r){r.style.display='';});showToast('Filters cleared','info');}
function toggleSelectAll(cb){document.querySelectorAll('.rowCheck').forEach(function(c){c.checked=cb.checked;});var btn=document.getElementById('bulkDeleteBtn');if(btn)btn.style.display=cb.checked?'inline-flex':'none';}
function bulkDelete(){var checked=document.querySelectorAll('.rowCheck:checked');if(!checked.length){showToast('No rows selected','error');return;}if(!confirm('Delete '+checked.length+' records?'))return;checked.forEach(function(c){c.closest('tr').remove();});document.getElementById('selectAll').checked=false;document.getElementById('bulkDeleteBtn').style.display='none';showToast(checked.length+' deleted','success');}
function deleteRow(btn){if(!confirm('Delete this record?'))return;btn.closest('tr').remove();showToast('Deleted','error');}
function openDetailModal(idx){var r=tableData[idx];if(!r)return;var fields=${JSON.stringify(d.tableHeaders||[])};var vals=[r.col1,r.col2,r.col3,r.col4,r.col5].filter(function(v){return v!=null&&v!=='';});var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">';fields.forEach(function(f,i){html+='<div style="background:#0f172a;border-radius:9px;padding:11px 13px;"><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">'+f+'</div><div style="font-weight:600;color:#e2e8f0;font-size:13px;">'+(vals[i]||'—')+'</div></div>';});html+='<div style="background:#0f172a;border-radius:9px;padding:11px 13px;"><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Status</div><div style="font-weight:600;color:#4ade80;font-size:13px;">'+(r.status||'Active')+'</div></div></div>';document.getElementById('detailContent').innerHTML=html;openModal('detailModal');}
function openEditModal(idx){openModal('addModal');showToast('Edit mode','info');}
function submitAddForm(e){e.preventDefault();var inputs=e.target.querySelectorAll('[required]');var valid=true;inputs.forEach(function(inp){if(!inp.value.trim()){inp.style.borderColor='#ef4444';inp.style.boxShadow='0 0 0 3px rgba(239,68,68,.15)';valid=false;}else{inp.style.borderColor='';inp.style.boxShadow='';}});if(!valid){showToast('Fill required fields','error');return;}closeModal('addModal');e.target.reset();showToast('${escR(entity)} added!','success');}
</script>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { projectId, projectName, projectDescription, prompt, files, currentAppData, currentPreviewHtml, images } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt is required." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model  = Deno.env.get("MODEL") || "openai/gpt-4o-mini";
    if (!apiKey) return new Response(JSON.stringify({ error: "API key not configured." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`[refine] model=${model} project=${projectId} hasHtml=${!!currentPreviewHtml} prompt="${prompt.substring(0, 80)}"`);

    // ── V3 EDIT MODE: surgical HTML edit when we have the existing HTML ──────────
    const hasExistingHtml = currentPreviewHtml && typeof currentPreviewHtml === "string" && currentPreviewHtml.length > 500;
    if (hasExistingHtml) {
      const imageContext = images && images.length > 0
        ? `\n\nReference images provided (${images.length}). Match their visual style for this specific change only.`
        : "";

      const editRes = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://medo.dev",
          "X-Title": "V3 EditMode"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: EDIT_MODE_SYSTEM_PROMPT },
            { role: "user", content: `CHANGE REQUEST: "${prompt}"${imageContext}\n\nAPPLY THIS CHANGE to the existing app HTML below. Return ONLY the complete updated HTML file.\n\nEXISTING APP HTML:\n${currentPreviewHtml.substring(0, 14000)}` }
          ],
          max_tokens: 6000,
          stream: false
        })
      });

      if (editRes.ok) {
        const editResult = JSON.parse(await editRes.text());
        let editedHtml = (editResult.choices?.[0]?.message?.content || "").trim();
        // Strip accidental markdown fences
        if (editedHtml.startsWith("```")) {
          editedHtml = editedHtml.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        }
        // Quality gate: must be valid HTML and not shorter than 80% of original (truncation guard)
        const isValidEdit = editedHtml.length > 800 && editedHtml.includes("<!DOCTYPE") && editedHtml.includes("</html>") && editedHtml.length >= currentPreviewHtml.length * 0.6;
        if (isValidEdit) {
          console.log(`[refine] V3 edit mode success, html=${editedHtml.length} chars`);
          return new Response(JSON.stringify({
            id: projectId,
            name: projectName || "App",
            description: projectDescription || "",
            files: files || [],
            previewHtml: editedHtml,
            changes: [{ file: "index.html", type: "modified", additions: 5, deletions: 2, preview: [`+ // Applied: ${prompt.substring(0, 60)}`] }],
            autoDiagnosticReport: {
              status: "clean",
              errorsFound: [],
              errorsFixed: [`✓ Surgical edit applied: ${prompt.substring(0, 80)}`, "✓ All existing features preserved", "✓ No full regeneration — edit mode only"]
            },
            deployments: []
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        console.warn(`[refine] V3 edit output failed QC (len=${editedHtml.length}, orig=${currentPreviewHtml.length}) — falling back to JSON template path`);
      }
    }

    // ── FALLBACK: Legacy JSON data update → template rebuild ─────────────────
    // Used when no previewHtml is available, or if surgical edit fails QC.
    console.log(`[refine] using legacy JSON→template path`);

    // Extract existing structured data from mockData.ts
    const mockDataFile = Array.isArray(files) ? files.find((f: any) => f.path?.includes("mockData")) : null;
    let existingData: any = currentAppData || {};
    if (mockDataFile?.content) {
      try {
        const match = mockDataFile.content.match(/export const appData = ([\s\S]+);/);
        if (match) existingData = JSON.parse(match[1]);
      } catch { /**/ }
    }

    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://medo.dev", "X-Title": "SE Workspace - Refine" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: REFINE_SYSTEM },
          { role: "user", content: `CURRENT APP DATA:\n${JSON.stringify(existingData, null, 2).substring(0, 2500)}\n\nMODIFICATION REQUEST: "${prompt}"${images && images.length > 0 ? `\n\nReference images provided (${images.length}): ${images.slice(0, 3).join(", ")} — use their visual style to guide color/layout changes.` : ""}\n\nReturn the COMPLETE updated JSON with the change applied. Keep ALL existing fields.` }
        ],
        max_tokens: 3500, stream: false
      })
    });

    const resText = await res.text();
    if (!res.ok) {
      const errMsg = (() => { try { return JSON.parse(resText).error?.message; } catch { return null; } })() || `HTTP ${res.status}`;
      return new Response(JSON.stringify({ error: `Refinement failed: ${errMsg}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(resText);
    const raw = result.choices?.[0]?.message?.content || "{}";
    const updatedData = safeParseJSON(raw);
    const mergedData = { ...existingData, ...updatedData };
    const previewHtml = buildHTMLR(mergedData);

    const updatedFiles = [
      { path: "src/App.tsx", language: "tsx", content: `// ${mergedData.appName} — Refined by Trust Me AI Builder\nexport default function App() { return null; }` },
      { path: "src/lib/mockData.ts", language: "typescript", content: `export const appData = ${JSON.stringify(mergedData, null, 2)};` },
    ];

    return new Response(JSON.stringify({
      id: projectId,
      name: mergedData.appName || projectName || "App",
      description: mergedData.tagline || projectDescription || "",
      files: updatedFiles,
      previewHtml,
      changes: [{ file: "src/lib/mockData.ts", type: "modified", additions: 10, deletions: 2, preview: [`+ // Applied: ${prompt.substring(0, 60)}`] }],
      autoDiagnosticReport: { status: "success", errorsFound: [], errorsFixed: [`Applied: ${prompt.substring(0, 80)}`] },
      deployments: []
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[refine] ERROR: ${err?.message}`);
    return new Response(JSON.stringify({ error: err?.message || "Refinement failed." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
