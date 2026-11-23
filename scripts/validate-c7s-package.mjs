#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ARCHIVE_PATHS = [
  path.join(ROOT_DIR, 'io_calagopus_blush.c7s.zip'),
  path.join(ROOT_DIR, 'Petalnodes-Theme.zip.c7s'),
];

function inspectArchive(archivePath) {
  const pyScript = `
import json, sys, zipfile

path = sys.argv[1]
with zipfile.ZipFile(path, "r") as zf:
    bad = zf.testzip()
    if bad is not None:
        raise RuntimeError(f"Corrupt ZIP entry: {bad}")
    entries = []
    texts = {}
    for info in zf.infolist():
        entries.append({
            "filename": info.filename,
            "is_dir": info.is_dir(),
            "file_size": info.file_size,
        })
        if not info.is_dir() and (
            info.filename.endswith(".toml")
            or info.filename.endswith(".json")
            or info.filename.endswith(".rs")
            or info.filename.endswith(".ts")
            or info.filename.endswith(".tsx")
            or info.filename.endswith(".css")
            or info.filename.endswith(".html")
        ):
            texts[info.filename] = zf.read(info).decode("utf-8")
    print(json.dumps({"entries": entries, "texts": texts}))
`;
  const raw = execFileSync('python3', ['-c', pyScript, archivePath], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function validateOneArchive(archivePath) {
  assert.ok(fs.existsSync(archivePath), `Archive missing at ${archivePath}`);

  // Verify standard Info-ZIP integrity test
  execFileSync('unzip', ['-tqq', archivePath], { stdio: 'inherit' });

  const { entries, texts } = inspectArchive(archivePath);
  const entryNames = new Set(entries.map((e) => e.filename));
  const dirNames = new Set(entries.filter((e) => e.is_dir).map((e) => e.filename));

  // 1. Explicit directory entries required by Calagopus distr.rs
  for (const reqDir of ['backend/', 'backend/src/', 'frontend/', 'frontend/src/']) {
    assert.ok(dirNames.has(reqDir), `Missing explicit directory entry: ${reqDir}`);
  }

  // 2. Required package files
  for (const reqFile of [
    'Metadata.toml',
    'backend/Cargo.toml',
    'backend/src/lib.rs',
    'frontend/package.json',
    'frontend/src/index.tsx',
    'frontend/src/app.css',
  ]) {
    assert.ok(entryNames.has(reqFile), `Missing required extension file: ${reqFile}`);
  }

  // 3. No wrapping directory, no excluded dev/test/secret files, no boot.html conflict
  for (const name of entryNames) {
    assert.ok(!name.startsWith('io_calagopus_blush/'), `Archive must not have outer wrapper folder: ${name}`);
    assert.ok(!name.includes('node_modules/'), `node_modules leaked into archive: ${name}`);
    assert.ok(!name.includes('.env'), `.env leaked into archive: ${name}`);
    assert.ok(!name.endsWith('.test.ts') && !name.endsWith('.test.tsx'), `Test file leaked into archive: ${name}`);
    assert.ok(name !== 'frontend/src/boot.html', 'boot.html must not be shipped (avoids Calagopus boot-spinner conflict)');
    assert.ok(name !== 'frontend/src/shared-adapter.ts', 'shared-adapter.ts must not be shipped inside archive');
    assert.ok(name !== 'frontend/tsconfig.json', 'frontend/tsconfig.json must not be shipped inside archive');
  }

  // 4. Validate Metadata.toml schema (top-level keys, no [extension] header)
  const metaToml = texts['Metadata.toml'];
  assert.ok(!/^\s*\[extension\]/m.test(metaToml), 'Metadata.toml must not use [extension] header');
  assert.match(metaToml, /^package_name\s*=\s*"io\.calagopus\.blush"/m);
  assert.match(metaToml, /^name\s*=\s*"Petalnodes Theme"/m);
  assert.match(metaToml, /^panel_version\s*=\s*">=1\.1\.0"/m);

  // 5. Validate backend Cargo.toml & lib.rs
  const cargoToml = texts['backend/Cargo.toml'];
  assert.match(cargoToml, /^name\s*=\s*"io_calagopus_blush"/m);
  assert.match(cargoToml, /^edition\s*=\s*\{\s*workspace\s*=\s*true\s*\}/m);
  assert.match(cargoToml, /^shared\s*=\s*\{\s*workspace\s*=\s*true\s*\}/m);

  const libRs = texts['backend/src/lib.rs'];
  assert.match(libRs, /pub struct ExtensionStruct/);
  assert.match(libRs, /impl Extension for ExtensionStruct/);

  // 6. Validate frontend/package.json
  const pkg = JSON.parse(texts['frontend/package.json']);
  assert.equal(pkg.name, 'io.calagopus.blush');
  assert.equal(pkg.main, 'src/index.tsx');
  assert.equal(pkg.types, 'src/index.tsx');
  assert.equal(pkg.dependencies?.shared, 'workspace:*');
  for (const [dep, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    assert.ok(
      typeof spec === 'string' && !spec.includes('9.8.2'),
      `Dependency ${dep} (${spec}) must not require immature 9.8.2 minimum`,
    );
  }

  // 7. Validate frontend/src/index.tsx imports genuine 'shared' and none import shared-adapter
  const indexTsx = texts['frontend/src/index.tsx'];
  assert.match(indexTsx, /from\s+['"]shared['"]/);
  assert.match(indexTsx, /export default new CalagopusBlushExtension\(\)/);

  for (const [filename, content] of Object.entries(texts)) {
    if (filename.startsWith('frontend/src/')) {
      assert.ok(
        !content.includes('shared-adapter'),
        `Forbidden reference to shared-adapter in ${filename}`,
      );
      assert.ok(
        !/import\.meta\.env/.test(content),
        `Unexpected import.meta.env in ${filename}`,
      );
    }
  }

  console.log(
    `Validated ${path.basename(archivePath)}: ${entries.length} ZIP entries checked, unzip -t passed, all Calagopus distr.rs checks passed.`,
  );
}

function main() {
  for (const archivePath of ARCHIVE_PATHS) {
    validateOneArchive(archivePath);
  }
}

main();
