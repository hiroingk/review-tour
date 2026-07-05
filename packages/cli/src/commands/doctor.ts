import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDefaultReviewTourCacheDir } from 'review-tour/viewer';
import { hasFlag, type ParsedArgs } from '../cliArgs.js';
import { getCliVersion, getRequiredNodeRange } from '../version.js';
import { getSkillDataDir } from './skills.js';

type DoctorCheckStatus = 'ok' | 'warn' | 'error';

export type DoctorCheck = {
  name: string;
  status: DoctorCheckStatus;
  detail: string;
};

export async function doctorCommand(args: ParsedArgs) {
  validateDoctorArgs(args);

  const checks: DoctorCheck[] = [
    checkNodeVersion(),
    checkGit(),
    checkGitRepository(),
    await checkCacheDir(),
    await checkSkillData(),
    checkGitHubCli(),
  ];
  const ok = checks.every((check) => check.status !== 'error');

  if (hasFlag(args, 'json')) {
    // Always exit 0 with --json; consumers must read the ok field.
    process.stdout.write(
      `${JSON.stringify({ ok, cliVersion: getCliVersion(), checks }, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`review-tour ${getCliVersion()}\n\n`);
  for (const check of checks) {
    process.stdout.write(`${check.status.padEnd(5)} ${check.name}: ${check.detail}\n`);
  }

  if (!ok) {
    process.stdout.write('\nResolve the failing checks above, then rerun review-tour doctor.\n');
    process.exitCode = 1;
  }
}

export function validateDoctorArgs(args: ParsedArgs) {
  const allowedOptions = new Set(['json']);
  for (const name of args.options.keys()) {
    if (!allowedOptions.has(name)) {
      throw new Error(`Unknown doctor option: --${name}`);
    }
  }

  if (args.positionals.length > 0) {
    throw new Error('review-tour doctor does not accept positional arguments.');
  }
}

export function parseMinimumVersion(range: string): string | undefined {
  const match = range.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : undefined;
}

export function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map((part) => Number.parseInt(part, 10));
  const partsB = b.split('.').map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }

  return 0;
}

function checkNodeVersion(): DoctorCheck {
  const current = process.versions.node;
  const range = getRequiredNodeRange();
  const minimum = range ? parseMinimumVersion(range) : undefined;

  if (!minimum) {
    return { name: 'node', status: 'ok', detail: `Node.js ${current}` };
  }

  if (compareSemver(current, minimum) < 0) {
    return {
      name: 'node',
      status: 'error',
      detail: `Node.js ${current} is below the required ${range}.`,
    };
  }

  return { name: 'node', status: 'ok', detail: `Node.js ${current} satisfies ${range}.` };
}

function checkGit(): DoctorCheck {
  const version = readCommandOutput('git', ['--version']);
  if (version === undefined) {
    return { name: 'git', status: 'error', detail: 'git was not found on PATH.' };
  }

  return { name: 'git', status: 'ok', detail: version };
}

function checkGitRepository(): DoctorCheck {
  const output = readCommandOutput('git', ['rev-parse', '--is-inside-work-tree']);
  if (output !== 'true') {
    return {
      name: 'repository',
      status: 'warn',
      detail: 'The current directory is not inside a git work tree.',
    };
  }

  return { name: 'repository', status: 'ok', detail: 'Inside a git work tree.' };
}

async function checkCacheDir(): Promise<DoctorCheck> {
  const cacheDir = getDefaultReviewTourCacheDir();
  const probePath = path.join(cacheDir, '.doctor-probe');

  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(probePath, 'probe', 'utf8');
    await rm(probePath, { force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: 'cache',
      status: 'error',
      detail: `Cache directory ${cacheDir} is not writable: ${message}`,
    };
  }

  return { name: 'cache', status: 'ok', detail: `Cache directory ${cacheDir} is writable.` };
}

async function checkSkillData(): Promise<DoctorCheck> {
  try {
    const skillDataDir = await getSkillDataDir();
    return { name: 'skill-data', status: 'ok', detail: `Skill data found at ${skillDataDir}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: 'skill-data', status: 'error', detail: message };
  }
}

function checkGitHubCli(): DoctorCheck {
  const version = readCommandOutput('gh', ['--version']);
  if (version === undefined) {
    return {
      name: 'gh',
      status: 'warn',
      detail: 'GitHub CLI (gh) was not found; --pr <url> collection will not work.',
    };
  }

  return { name: 'gh', status: 'ok', detail: version.split('\n')[0] };
}

function readCommandOutput(command: string, commandArgs: string[]): string | undefined {
  try {
    return execFileSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}
