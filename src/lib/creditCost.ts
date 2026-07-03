// ─── Deep Prompt Intelligence: Credit Cost Estimator ─────────────────────────
// Analyzes prompt complexity, intent, and scope to assign a fair credit cost.
// Mirrors the same detectAppType logic used on the backend.

export interface CreditEstimate {
  cost: number;
  label: string;        // "Small" | "Medium" | "Large" | "Enterprise"
  breakdown: string;    // e.g. "Multi-page app · 8 components · full auth"
  appType: string;
}

// Keyword weight map — higher = more complex
const COMPLEXITY_SIGNALS: Array<{ pattern: RegExp; weight: number; reason: string }> = [
  // Enterprise / management systems
  { pattern: /\bhospital\b|\bclinic\b|\bhealthcare system\b/i,              weight: 18, reason: "Healthcare management system" },
  { pattern: /\berp\b|\benterprise resource\b/i,                            weight: 22, reason: "Enterprise ERP system" },
  { pattern: /\bhrms\b|\bhr management\b|\bhuman resource/i,               weight: 16, reason: "HR management platform" },
  { pattern: /\bschool management\b|\blms\b|\beducation platform\b/i,       weight: 15, reason: "Education management system" },
  { pattern: /\bcrm\b|\bcustomer relationship\b/i,                          weight: 14, reason: "CRM platform" },
  { pattern: /\binventory management\b|\bwarehouse\b/i,                     weight: 14, reason: "Inventory management system" },
  { pattern: /\bproject management\b|\bpm tool\b|\bjira clone\b/i,          weight: 14, reason: "Project management platform" },

  // Full-featured websites
  { pattern: /\be.?commerce\b|\bonline store\b|\bshopping (site|app)\b/i,   weight: 10, reason: "E-commerce store" },
  { pattern: /\bmarketplace\b/i,                                            weight: 12, reason: "Marketplace platform" },
  { pattern: /\bsocial (network|media|app)\b/i,                             weight: 13, reason: "Social platform" },
  { pattern: /\bbooking (system|app|platform)\b|\breservation\b/i,          weight: 11, reason: "Booking system" },
  { pattern: /\bportfolio\b|\bpersonal (website|site)\b/i,                  weight: 5,  reason: "Portfolio website" },
  { pattern: /\blanding page\b|\bone.?page\b|\bsales page\b/i,              weight: 4,  reason: "Landing page" },

  // Apps
  { pattern: /\bchat app\b|\bmessaging app\b/i,                             weight: 8,  reason: "Messaging app" },
  { pattern: /\bfitness (app|tracker)\b|\bworkout app\b/i,                  weight: 6,  reason: "Fitness app" },
  { pattern: /\bfinance (app|tracker)\b|\bbudget app\b/i,                   weight: 6,  reason: "Finance app" },
  { pattern: /\brecipe (app|website)\b|\bcooking app\b/i,                   weight: 5,  reason: "Recipe app" },
  { pattern: /\bmusic (player|app|stream)\b/i,                              weight: 5,  reason: "Music player app" },
  { pattern: /\btravel (app|planner)\b/i,                                   weight: 6,  reason: "Travel app" },
  { pattern: /\bnews (app|website|feed)\b|\bblog (app|platform)\b/i,        weight: 5,  reason: "News/blog app" },
  { pattern: /\btodo\b|\btask manager\b|\bchecklist\b/i,                    weight: 3,  reason: "Todo app" },
  { pattern: /\bnotes?\b|\bnotepad\b|\bjournal\b/i,                         weight: 3,  reason: "Notes app" },
  { pattern: /\bquiz\b|\btrivia\b|\bflashcard\b/i,                         weight: 3,  reason: "Quiz app" },
  { pattern: /\btimer\b|\bpomodoro\b|\bstopwatch\b/i,                      weight: 2,  reason: "Timer app" },
  { pattern: /\bcalculator\b|\bcalc\b/i,                                   weight: 2,  reason: "Calculator" },
  { pattern: /\bconverter\b|\bunit conv\b/i,                               weight: 2,  reason: "Converter tool" },
  { pattern: /\bcontact form\b|\bsurvey\b|\bquestionnaire\b/i,             weight: 2,  reason: "Form/survey" },
  { pattern: /\bweather (app)?\b/i,                                        weight: 3,  reason: "Weather app" },
  { pattern: /\bgame\b|\bshooter\b|\bracing\b|\bplatformer\b|\bpuzzle\b|\bsnake\b|\bbreakout\b|\btower defense\b|\bhtml5 game\b|\bcanvas game\b/i, weight: 12, reason: "HTML5 Canvas game" },

  // Explicit feature complexity adders
  { pattern: /\bwith auth\b|\bwith login\b|\bauthentication\b/i,           weight: 3,  reason: "+ auth system" },
  { pattern: /\bdashboard\b|\badmin panel\b/i,                              weight: 5,  reason: "+ admin dashboard" },
  { pattern: /\breal.?time\b|\blive (updates|data|feed)\b/i,               weight: 4,  reason: "+ real-time data" },
  { pattern: /\bpayment\b|\bcheckout\b|\bstripe\b/i,                       weight: 4,  reason: "+ payment system" },
  { pattern: /\bnotification\b|\bpush alert\b/i,                            weight: 2,  reason: "+ notifications" },
  { pattern: /\bai (powered|integrated|feature|chat)\b/i,                  weight: 5,  reason: "+ AI integration" },
  { pattern: /\bmap(s)?\b|\bgeo(location)?\b/i,                            weight: 3,  reason: "+ maps/geo" },
  { pattern: /\bfile upload\b|\bimage upload\b/i,                          weight: 2,  reason: "+ file upload" },
  { pattern: /\bsearch\b|\bfilter\b/i,                                     weight: 1,  reason: "+ search/filter" },
  { pattern: /\bmulti.?page\b|\bfull (website|app)\b/i,                    weight: 4,  reason: "Multi-page app" },
  { pattern: /\bfull[- ]?stack\b|\bbackend\b/i,                            weight: 5,  reason: "+ backend API" },
  { pattern: /\bresponsive\b|\bmobile.?first\b/i,                          weight: 1,  reason: "+ responsive design" },
  { pattern: /\bdark mode\b/i,                                             weight: 1,  reason: "+ dark mode" },
  { pattern: /\bwith api\b|\brest api\b|\bgraphql\b/i,                     weight: 3,  reason: "+ API integration" },
];

// Small refinements cost less
const REFINE_SIGNALS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\bchange (color|font|size|text|label)\b/i,   weight: 1 },
  { pattern: /\bupdate (text|title|heading|label)\b/i,     weight: 1 },
  { pattern: /\bfix (bug|error|issue|typo)\b/i,            weight: 1 },
  { pattern: /\badd (button|icon|link|badge)\b/i,          weight: 2 },
  { pattern: /\badd (page|section|feature|form)\b/i,       weight: 3 },
  { pattern: /\bremove\b|\bdelete\b|\bhide\b/i,            weight: 1 },
  { pattern: /\bredesign\b|\brebuild\b|\bcomplete(ly)?\b/i, weight: 5 },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function estimateCreditCost(
  prompt: string,
  action: "generate" | "refine" = "generate"
): CreditEstimate {
  const p = prompt.toLowerCase();

  if (action === "refine") {
    // Refinements: base 1, scale by scope
    let cost = 1;
    const reasons: string[] = [];
    for (const signal of REFINE_SIGNALS) {
      if (signal.pattern.test(p)) {
        cost = Math.max(cost, signal.weight);
        reasons.push(signal.weight >= 3 ? "Structural change" : "Minor edit");
      }
    }
    cost = clamp(cost, 1, 8);
    return {
      cost,
      label: cost <= 1 ? "Micro" : cost <= 3 ? "Small" : "Medium",
      breakdown: reasons.length > 0 ? reasons[0] : "UI refinement",
      appType: "refine",
    };
  }

  // Generation: accumulate matched weights
  let total = 0;
  const reasons: string[] = [];

  for (const signal of COMPLEXITY_SIGNALS) {
    if (signal.pattern.test(p)) {
      total += signal.weight;
      reasons.push(signal.reason);
    }
  }

  // Minimum cost based on prompt word count (longer = more complex)
  const wordCount = p.split(/\s+/).length;
  const wordBonus = wordCount > 30 ? 3 : wordCount > 15 ? 2 : wordCount > 8 ? 1 : 0;
  total += wordBonus;

  // Ensure minimum cost of 2 for any generation
  total = Math.max(2, total);

  // Cap at 30
  total = clamp(total, 2, 30);

  // Determine tier label
  let label: string;
  if (total <= 3)       label = "Simple";
  else if (total <= 7)  label = "Medium";
  else if (total <= 14) label = "Large";
  else if (total <= 22) label = "Complex";
  else                  label = "Enterprise";

  // Build human-readable breakdown from top reasons
  const topReasons = [...new Set(reasons)].slice(0, 3);
  const breakdown = topReasons.length > 0
    ? topReasons.join(" · ")
    : "Standard app";

  // Detect primary appType for display
  const appType = detectDisplayType(p);

  return { cost: total, label, breakdown, appType };
}

function detectDisplayType(p: string): string {
  if (/\bcalculator\b|\bcalc\b/i.test(p))                       return "Calculator";
  if (/\btimer\b|\bpomodoro\b/i.test(p))                         return "Timer App";
  if (/\btodo\b|\btask manager\b/i.test(p))                      return "Todo App";
  if (/\bnotes?\b|\bnotepad\b/i.test(p))                        return "Notes App";
  if (/\bquiz\b|\btrivia\b/i.test(p))                           return "Quiz App";
  if (/\bconverter\b/i.test(p))                                  return "Converter";
  if (/\bweather\b/i.test(p))                                    return "Weather App";
  if (/\bchat\b|\bmessaging\b/i.test(p))                         return "Chat App";
  if (/\be.?commerce\b|\bonline store\b/i.test(p))               return "E-Commerce";
  if (/\bportfolio\b/i.test(p))                                  return "Portfolio";
  if (/\blanding page\b/i.test(p))                               return "Landing Page";
  if (/\bhospital\b|\bclinic\b/i.test(p))                       return "Hospital System";
  if (/\bhrms\b|\bhr management\b/i.test(p))                    return "HR System";
  if (/\berp\b|\benterprise\b/i.test(p))                        return "Enterprise App";
  if (/\bfitness\b|\bworkout\b/i.test(p))                       return "Fitness App";
  if (/\bfinance\b|\bbudget\b/i.test(p))                        return "Finance App";
  if (/\btravel\b/i.test(p))                                    return "Travel App";
  if (/\brecipe\b|\bcooking\b/i.test(p))                        return "Recipe App";
  if (/\bmusic\b|\bplaylist\b/i.test(p))                        return "Music App";
  if (/\bdashboard\b|\badmin\b|\bmanagement\b/i.test(p))        return "Dashboard";
  if (/\bgame\b|\bshooter\b|\bracing\b|\bplatformer\b|\bpuzzle\b|\bsnake\b|\bbreakout\b|\btower defense\b|\bhtml5 game\b/i.test(p)) return "Game";
  return "Web App";
}
