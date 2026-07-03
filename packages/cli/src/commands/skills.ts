import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasFlag, type ParsedArgs } from '../cliArgs.js';
import { hashSkillDirectory, parseSkillsManifest } from '../skillsManifest.js';
import { getCliVersion, getPackageRoot } from '../version.js';

type SkillSummary = {
  name: string;
  description: string;
};

type SkillCheckResult = {
  name: string;
  kind: 'skill' | 'stub';
  status: 'ok' | 'stale' | 'missing';
  detail: string;
};

export async function skillsCommand(args: ParsedArgs) {
  const action = args.positionals[0] ?? 'list';

  switch (action) {
    case 'list':
      await listSkills(args);
      return;
    case 'get':
      await getSkill(args);
      return;
    case 'check':
      await checkSkills(args);
      return;
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(helpText());
      return;
    default:
      throw new Error(`Unknown skills command: ${action}`);
  }
}

export async function getSkillDataDir() {
  const explicitDir = process.env.REVIEW_TOUR_SKILL_DATA_DIR;
  if (explicitDir) {
    return explicitDir;
  }

  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(commandDir, '../../../../skill-data'),
    path.resolve(commandDir, '../../skill-data'),
  ];

  for (const candidate of candidates) {
    try {
      const candidateStat = await stat(candidate);
      if (candidateStat.isDirectory()) {
        return candidate;
      }
    } catch {
      // Try the next package layout.
    }
  }

  throw new Error('Could not locate review-tour skill-data. Reinstall or rebuild the package.');
}

async function listSkills(args: ParsedArgs) {
  const skillDataDir = await getSkillDataDir();
  const skills = await readSkillSummaries(skillDataDir);

  if (hasFlag(args, 'json')) {
    process.stdout.write(`${JSON.stringify({ skills }, null, 2)}\n`);
    return;
  }

  for (const skill of skills) {
    process.stdout.write(`${skill.name}\t${skill.description}\n`);
  }
}

async function getSkill(args: ParsedArgs) {
  const skillName = args.positionals[1] ?? 'core';
  assertSafeSkillName(skillName);

  const skillDataDir = await getSkillDataDir();
  const skillPath = path.join(skillDataDir, skillName, 'SKILL.md');
  const body = await readFile(skillPath, 'utf8');
  process.stdout.write(body.endsWith('\n') ? body : `${body}\n`);
}

async function checkSkills(args: ParsedArgs) {
  const packageRoot = getPackageRoot();
  if (!packageRoot) {
    throw new Error('Could not locate the review-tour package root. Reinstall the package.');
  }

  const manifestPath = path.join(packageRoot.dir, 'skills-manifest.json');
  let manifestRaw: string;
  try {
    manifestRaw = await readFile(manifestPath, 'utf8');
  } catch {
    throw new Error(
      `Could not read ${manifestPath}. Reinstall review-tour, or run pnpm run skills:manifest in a source checkout.`,
    );
  }

  const manifest = parseSkillsManifest(manifestRaw, manifestPath);
  const skillDataDir = await getSkillDataDir();
  const results: SkillCheckResult[] = [];

  for (const [name, expected] of Object.entries(manifest.skills)) {
    results.push(
      await checkSkillDirectory(name, 'skill', path.join(skillDataDir, name), expected.hash),
    );
  }

  for (const [name, expected] of Object.entries(manifest.stubs)) {
    results.push(
      await checkSkillDirectory(
        name,
        'stub',
        path.join(packageRoot.dir, 'skills', name),
        expected.hash,
      ),
    );
  }

  const ok = results.every((result) => result.status === 'ok');

  if (hasFlag(args, 'json')) {
    // Always exit 0 with --json; consumers must read the ok field.
    process.stdout.write(
      `${JSON.stringify({ ok, cliVersion: getCliVersion(), results }, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`review-tour ${getCliVersion()}\n\n`);
  for (const result of results) {
    process.stdout.write(
      `${result.status.padEnd(7)} ${result.kind} ${result.name}: ${result.detail}\n`,
    );
  }

  if (!ok) {
    process.stdout.write(
      '\nBundled skill content does not match skills-manifest.json.\n' +
        'Reinstall review-tour, or run pnpm run skills:manifest in a source checkout.\n',
    );
    process.exitCode = 1;
  }
}

async function checkSkillDirectory(
  name: string,
  kind: SkillCheckResult['kind'],
  dir: string,
  expectedHash: string,
): Promise<SkillCheckResult> {
  let computedHash: string;
  try {
    computedHash = (await hashSkillDirectory(dir)).hash;
  } catch {
    return { name, kind, status: 'missing', detail: `Missing directory ${dir}.` };
  }

  if (computedHash !== expectedHash) {
    return {
      name,
      kind,
      status: 'stale',
      detail: `Content hash ${computedHash} does not match manifest hash ${expectedHash}.`,
    };
  }

  return { name, kind, status: 'ok', detail: `Matches manifest hash ${expectedHash}.` };
}

async function readSkillSummaries(skillDataDir: string): Promise<SkillSummary[]> {
  const entries = await readdir(skillDataDir, { withFileTypes: true });
  const summaries: SkillSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = path.join(skillDataDir, entry.name, 'SKILL.md');
    try {
      const body = await readFile(skillPath, 'utf8');
      summaries.push(parseSkillSummary(body, entry.name));
    } catch {
      // Ignore incomplete skill-data directories.
    }
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

function parseSkillSummary(body: string, fallbackName: string): SkillSummary {
  const frontmatter = body.match(/^---\n([\s\S]*?)\n---/);
  const fields = new Map<string, string>();

  if (frontmatter) {
    for (const line of frontmatter[1].split('\n')) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        fields.set(match[1], match[2].replace(/^['"]|['"]$/g, '').trim());
      }
    }
  }

  return {
    name: fields.get('name') || fallbackName,
    description: fields.get('description') || '',
  };
}

function assertSafeSkillName(skillName: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(skillName)) {
    throw new Error(`Invalid skill name: ${skillName}`);
  }
}

function helpText() {
  return `review-tour skills

Commands:
  skills list [--json]
  skills get [core]
  skills check [--json]
`;
}
