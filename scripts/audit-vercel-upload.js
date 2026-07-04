const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const buildDir = path.join(projectRoot, 'dist');

const textExts = new Set([
  '.ts','.tsx','.js','.jsx','.json','.html','.css','.md','.txt','.svg','.xml','.map','.json5','.env'
]);

function isText(ext, name){
  return textExts.has(ext) || /LICENSE/i.test(name);
}

function encode(fullPath, rel){
  const buf = fs.readFileSync(fullPath);
  const ext = path.extname(rel).toLowerCase();
  if (isText(ext, path.basename(rel))) return { data: buf.toString('utf8') };
  return { data: buf.toString('base64'), encoding: 'base64' };
}

function walkDir(dir, cb){
  const entries = fs.readdirSync(dir);
  for(const e of entries){
    const full = path.join(dir,e);
    const stat = fs.statSync(full);
    if(stat.isDirectory()) walkDir(full, cb);
    else if(stat.isFile()) cb(full);
  }
}

const files = [];
if(!fs.existsSync(buildDir)){
  console.error('Build dir not found:', buildDir);
  process.exit(2);
}

walkDir(buildDir, (full)=>{
  const rel = path.relative(buildDir, full).replace(/\\/g,'/');
  const encoded = encode(full, rel);
  // Add as root-relative (e.g., assets/...), and also as dist/... per new logic
  files.push({ file: rel, ...encoded });
  files.push({ file: path.posix.join('dist', rel), ...encoded });
});

// Add critical root files
const critical = ['package.json','pnpm-lock.yaml','package-lock.json','vercel.json','index.html','server.ts'];
for(const c of critical){
  const full = path.join(projectRoot, c);
  if(fs.existsSync(full) && fs.statSync(full).isFile()){
    const encoded = encode(full, c);
    files.push({ file: c, ...encoded });
  }
}

// dedupe keeping first occurrence
const seen = new Set();
const unique = [];
for(const f of files){
  if(!seen.has(f.file)){
    seen.add(f.file);
    unique.push(f);
  }
}

// Save payload
const out = { files: unique };
const outPath = path.join(projectRoot, 'tmp_vercel_payload.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log('Payload written to', outPath);
console.log('Total files:', unique.length);
console.log('First 200 files:\n', unique.slice(0,200).map(f=>f.file).join('\n'));

// Verify specific files
const checks = [
  'dist/index.html',
  'assets/index-CF55kPG5.js',
  'assets/index-BkCKaEbq.css'
];
for(const c of checks){
  const found = unique.find(f=>f.file === c || f.file === c.replace(/^dist\//,''));
  console.log(`${c} -> ${found ? 'FOUND' : 'MISSING'}`);
}

// Count asset files (those under assets/ or dist/assets/)
const assetFiles = unique.filter(f => f.file.startsWith('assets/') || f.file.startsWith('dist/assets/'));
console.log('Asset files count:', assetFiles.length);
console.log('Assets included (sample 100):\n', assetFiles.slice(0,100).map(f=>f.file).join('\n'));

// check assets folder included
console.log('Includes assets dir:', assetFiles.length>0);

process.exit(0);
