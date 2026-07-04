import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectVercelDeploymentFiles } from "../src/lib/vercelUpload";

test("collectVercelDeploymentFiles includes built assets at the deployment root", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vercel-upload-"));
  const distDir = path.join(tempDir, "dist");
  fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(distDir, "index.html"), "<html></html>");
  fs.writeFileSync(path.join(distDir, "assets", "index.js"), "console.log('asset')");
  fs.writeFileSync(path.join(distDir, "assets", "index.css"), "body { color: red; }");
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "test" }));

  const result = collectVercelDeploymentFiles({ projectRoot: tempDir, buildDir: distDir });

  const uploadedFiles = result.files.map((file) => file.file);
  assert.ok(uploadedFiles.includes("index.html"));
  assert.ok(uploadedFiles.includes("assets/index.js"));
  assert.ok(uploadedFiles.includes("assets/index.css"));
  assert.equal(result.audit.includesAssetsDir, true);
  assert.equal(result.audit.assetCount, 2);
});
