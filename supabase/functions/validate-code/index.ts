import { corsHeaders } from "../_shared/cors.ts";

/**
 * Validation Agent — performs static analysis on generated code files.
 * Returns a list of detected issues with suggested fixes.
 */

interface CodeFile {
  path: string;
  content: string;
}

interface ValidationIssue {
  file: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion: string;
}

function detectIssues(files: CodeFile[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const file of files) {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Missing key in map
      if (line.includes(".map(") && !line.includes("key=") && !line.includes("/*")) {
        issues.push({
          file: file.path,
          line: lineNum,
          severity: "warning",
          message: "Array map() may be missing key prop",
          suggestion: "Add key={item.id} to the mapped JSX element",
        });
      }

      // Implicit any
      if (/function \w+\([^)]*\)\s*\{/.test(line) && !line.includes(":") && !line.includes("React.FC")) {
        issues.push({
          file: file.path,
          line: lineNum,
          severity: "warning",
          message: "Function parameters may have implicit any types",
          suggestion: "Add explicit TypeScript types to function parameters",
        });
      }

      // Missing useState import
      if (line.includes("useState") && !file.content.includes("import { useState }")) {
        issues.push({
          file: file.path,
          line: lineNum,
          severity: "error",
          message: "useState used but not imported",
          suggestion: "Add 'import { useState } from \"react\"' at top of file",
        });
      }

      // Unclosed JSX tags
      const openTags = (line.match(/<\w+/g) || []).length;
      const closeTags = (line.match(/<\/\w+>/g) || []).length + (line.match(/\/>/g) || []).length;
      if (openTags > closeTags && !line.includes("//") && !line.includes("*")) {
        issues.push({
          file: file.path,
          line: lineNum,
          severity: "error",
          message: "Potentially unclosed JSX tag",
          suggestion: "Ensure all opening tags have matching closing tags",
        });
      }

      // Console.log in production code
      if (line.includes("console.log(")) {
        issues.push({
          file: file.path,
          line: lineNum,
          severity: "info",
          message: "console.log found — should be removed in production",
          suggestion: "Remove console.log or replace with proper logging",
        });
      }

      // Missing return type
      if (/export\s+default\s+function/.test(line) && !line.includes(":") && file.path.endsWith(".tsx")) {
        issues.push({
          file: file.path,
          line: lineNum,
          severity: "info",
          message: "Exported component missing return type annotation",
          suggestion: "Add JSX.Element or React.ReactNode return type",
        });
      }
    }

    // File-level checks
    if (file.path.endsWith(".tsx") && !file.content.includes("export default")) {
      issues.push({
        file: file.path,
        line: 1,
        severity: "warning",
        message: "No default export found in component file",
        suggestion: "Add export default function ComponentName()",
      });
    }
  }

  return issues;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files } = await req.json();
    if (!Array.isArray(files)) {
      return new Response(
        JSON.stringify({ error: "files array is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const issues = detectIssues(files);
    const errors = issues.filter(i => i.severity === "error");
    const warnings = issues.filter(i => i.severity === "warning");
    const infos = issues.filter(i => i.severity === "info");

    return new Response(
      JSON.stringify({
        status: errors.length > 0 ? "failed" : warnings.length > 0 ? "warnings" : "passed",
        totalIssues: issues.length,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        infosCount: infos.length,
        issues,
        summary: errors.length > 0
          ? `${errors.length} error(s) found — auto-fix required`
          : warnings.length > 0
            ? `${warnings.length} warning(s) — minor fixes recommended`
            : "All checks passed — code is clean",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[validate-code] ERROR: ${err?.message}`);
    return new Response(
      JSON.stringify({ error: err?.message || "Validation failed." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
