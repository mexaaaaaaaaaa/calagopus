#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SOURCE_DIR = path.join(ROOT_DIR, 'backend-extensions', 'io_calagopus_blush');
const OUTPUT_ARCHIVES = [
  path.join(ROOT_DIR, 'io_calagopus_blush.c7s.zip'),
  path.join(ROOT_DIR, 'Petalnodes-Theme.zip.c7s'),
];

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'target',
  '.git',
  '.playwright-cli',
]);

const EXCLUDED_REL_PATHS = new Set([
  'frontend/tsconfig.json',
  'frontend/src/shared-adapter.ts',
]);

function shouldExcludeFile(relPosixPath) {
  if (EXCLUDED_REL_PATHS.has(relPosixPath)) return true;
  if (relPosixPath.endsWith('.test.ts') || relPosixPath.endsWith('.test.tsx')) return true;
  if (relPosixPath.endsWith('.spec.ts') || relPosixPath.endsWith('.spec.tsx')) return true;
  const base = path.posix.basename(relPosixPath);
  if (base === '.DS_Store' || base.startsWith('.env') || base.endsWith('.log')) return true;
  return false;
}

function collectEntries(dirPath, relPrefix = '') {
  const dirs = [];
  const files = [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to package symlink inside extension: ${path.posix.join(relPrefix, entry.name)}`);
    }
    const fullPath = path.join(dirPath, entry.name);
    const relPosix = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      dirs.push(`${relPosix}/`);
      const child = collectEntries(fullPath, relPosix);
      dirs.push(...child.dirs);
      files.push(...child.files);
    } else if (entry.isFile()) {
      if (shouldExcludeFile(relPosix)) continue;
      files.push({ relPosix, fullPath });
    }
  }

  return { dirs, files };
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Extension source directory not found: ${SOURCE_DIR}`);
  }

  const { dirs, files } = collectEntries(SOURCE_DIR);

  const requiredDirs = ['backend/', 'backend/src/', 'frontend/', 'frontend/src/'];
  for (const reqDir of requiredDirs) {
    if (!dirs.includes(reqDir)) {
      throw new Error(`Missing required directory for Calagopus distr.rs layout: ${reqDir}`);
    }
  }

  const requiredFiles = [
    'Metadata.toml',
    'backend/Cargo.toml',
    'backend/src/lib.rs',
    'frontend/package.json',
    'frontend/src/index.tsx',
  ];
  const fileSet = new Set(files.map((f) => f.relPosix));
  for (const reqFile of requiredFiles) {
    if (!fileSet.has(reqFile)) {
      throw new Error(`Missing required file for Calagopus distr.rs layout: ${reqFile}`);
    }
  }

  const manifestPayload = JSON.stringify({
    outputArchives: OUTPUT_ARCHIVES,
    dirs: Array.from(new Set(dirs)).sort(),
    files: files.sort((a, b) => a.relPosix.localeCompare(b.relPosix)),
  });

  const pyScript = `
import json, sys, zipfile

payload = json.loads(sys.stdin.read())
FIXED_DATE = (2026, 1, 1, 0, 0, 0)

for out_path in payload["outputArchives"]:
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for d in payload["dirs"]:
            zi = zipfile.ZipInfo(d, date_time=FIXED_DATE)
            zi.external_attr = (0o40755 << 16) | 0x10
            zf.writestr(zi, b"")
        for f in payload["files"]:
            with open(f["fullPath"], "rb") as fp:
                data = fp.read()
            zi = zipfile.ZipInfo(f["relPosix"], date_time=FIXED_DATE)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o100644 << 16
            zf.writestr(zi, data)
`;

  execFileSync('python3', ['-c', pyScript], {
    input: manifestPayload,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  for (const archivePath of OUTPUT_ARCHIVES) {
    const stat = fs.statSync(archivePath);
    console.log(
      `Built ${path.basename(archivePath)} (${stat.size} bytes, ${dirs.length} dirs, ${files.length} files)`,
    );
  }
}

main();
