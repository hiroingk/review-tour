#!/usr/bin/env node
// Generates skills-manifest.json with a content hash per bundled skill.
// Usage:
//   node scripts/generate-skills-manifest.mjs           # write the manifest
//   node scripts/generate-skills-manifest.mjs --check   # fail when the manifest is stale
//
// The hash algorithm must stay in sync with packages/cli/src/skillsManifest.ts.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'skills-manifest.json');
const checkOnly = process.argv.includes('--check');

const manifest = {
  source: 'hiroingk/review-tour',
  skills: await hashSkillRoot(path.join(repoRoot, 'skill-data')),
  stubs: await hashSkillRoot(path.join(repoRoot, 'skills')),
};

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  let existing;
  try {
    existing = await readFile(manifestPath, 'utf8');
  } catch {
    existing = '';
  }

  if (existing !== serialized) {
    process.stderr.write('skills-manifest.json is stale. Run: pnpm run skills:manifest\n');
    process.exit(1);
  }

  process.stdout.write('skills-manifest.json is up to date.\n');
  process.exit(0);
}

await writeFile(manifestPath, serialized, 'utf8');
process.stdout.write(`Wrote ${path.relative(repoRoot, manifestPath)}.\n`);

async function hashSkillRoot(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const result = {};

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    result[entry.name] = await hashDirectory(path.join(rootDir, entry.name));
  }

  return result;
}

async function hashDirectory(dir) {
  const files = await listFilesRecursive(dir, '');
  files.sort();

  const hash = createHash('sha256');
  for (const relativePath of files) {
    const content = await readFile(path.join(dir, relativePath));
    hash.update(relativePath);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }

  return { hash: hash.digest('hex').slice(0, 16), files: files.length };
}

async function listFilesRecursive(rootDir, relativeDir) {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(rootDir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}
