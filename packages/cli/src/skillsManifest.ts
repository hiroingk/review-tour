import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type SkillManifestEntry = {
  hash: string;
  files: number;
};

export type SkillsManifest = {
  source: string;
  skills: Record<string, SkillManifestEntry>;
  stubs: Record<string, SkillManifestEntry>;
};

// Must stay in sync with scripts/generate-skills-manifest.mjs, which produces
// skills-manifest.json at build time. A CLI test compares both outputs.
export async function hashSkillDirectory(dir: string): Promise<SkillManifestEntry> {
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

async function listFilesRecursive(rootDir: string, relativeDir: string): Promise<string[]> {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files: string[] = [];

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

export function parseSkillsManifest(raw: string, manifestPath: string): SkillsManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${manifestPath}.`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid skills manifest in ${manifestPath}.`);
  }

  const manifest = parsed as Partial<SkillsManifest>;
  return {
    source: typeof manifest.source === 'string' ? manifest.source : '',
    skills: normalizeEntries(manifest.skills),
    stubs: normalizeEntries(manifest.stubs),
  };
}

function normalizeEntries(value: unknown): Record<string, SkillManifestEntry> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const entries: Record<string, SkillManifestEntry> = {};
  for (const [name, entry] of Object.entries(value)) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as SkillManifestEntry).hash === 'string' &&
      typeof (entry as SkillManifestEntry).files === 'number'
    ) {
      entries[name] = {
        hash: (entry as SkillManifestEntry).hash,
        files: (entry as SkillManifestEntry).files,
      };
    }
  }

  return entries;
}
