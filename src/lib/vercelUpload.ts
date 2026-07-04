import fs from "node:fs";
import path from "node:path";

const textExts = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".html",
  ".css",
  ".md",
  ".txt",
  ".svg",
  ".xml",
  ".map",
  ".json5",
  ".env",
]);

function encodeFileContent(buf: Buffer, relPath: string) {
  const ext = path.extname(relPath).toLowerCase();
  const isText = textExts.has(ext) || /^[\w\-\/]*LICENSE$/i.test(path.basename(relPath));
  if (isText) {
    return { data: buf.toString("utf8") };
  }
  return { data: buf.toString("base64"), encoding: "base64" as const };
}

function addFileFromDisk(rootDir: string, relPath: string, files: Array<{ file: string; data: string; encoding?: string }>) {
  const full = path.join(rootDir, relPath);
  if (!fs.existsSync(full)) return;

  const stat = fs.statSync(full);
  if (stat.isFile()) {
    const content = encodeFileContent(fs.readFileSync(full), relPath);
    files.push({ file: relPath.replace(/\\/g, "/"), ...content });
    return;
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(full);
    for (const entry of entries) {
      addFileFromDisk(rootDir, path.posix.join(relPath, entry), files);
    }
  }
}

export function collectVercelDeploymentFiles({ projectRoot, buildDir }: { projectRoot: string; buildDir: string }) {
  const files: Array<{ file: string; data: string; encoding?: string }> = [];
  const seen = new Set<string>();

  function addBuiltFile(relPath: string, prefix = "") {
    const full = path.join(buildDir, relPath);
    if (!fs.existsSync(full)) return;
    const content = encodeFileContent(fs.readFileSync(full), relPath);
    const normalizedRel = relPath.replace(/\\/g, "/");
    const targetPath = prefix ? path.posix.join(prefix, normalizedRel) : normalizedRel;
    files.push({ file: targetPath.replace(/\\/g, "/"), ...content });
  }

  function addBuiltFilesFromDir(dir: string, prefix = "") {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      const rel = path.relative(buildDir, full).replace(/\\/g, "/");
      if (stat.isDirectory()) {
        addBuiltFilesFromDir(full, prefix);
      } else if (stat.isFile()) {
        addBuiltFile(rel, prefix);
        if (!prefix) {
          addBuiltFile(rel, "dist");
        }
      }
    }
  }

  addBuiltFilesFromDir(buildDir);

  const criticalFiles = [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "tsconfig.json",
    "tsconfig.build.json",
    "next.config.js",
    "vite.config.ts",
    "vite.config.js",
    "index.html",
    "server.ts",
    "src/server.ts",
    "src",
    "public",
  ];

  for (const relPath of criticalFiles) {
    addFileFromDisk(projectRoot, relPath, files);
  }

  const uniqueFiles: Array<{ file: string; data: string; encoding?: string }> = [];
  for (const file of files) {
    if (!seen.has(file.file)) {
      seen.add(file.file);
      uniqueFiles.push(file);
    }
  }

  const assetFiles = uniqueFiles.filter((file) => file.file.startsWith("assets/") || file.file.startsWith("dist/assets/"));
  const includesAssetsDir = assetFiles.length > 0;

  return {
    files: uniqueFiles,
    audit: {
      assetCount: assetFiles.length,
      includesAssetsDir,
      buildRoot: buildDir,
      projectRoot,
      first50: uniqueFiles.slice(0, 50).map((file) => file.file),
    },
  };
}
