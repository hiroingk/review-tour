import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasFlag, type ParsedArgs } from '../cliArgs.js';

type SkillSummary = {
  name: string;
  description: string;
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
`;
}
