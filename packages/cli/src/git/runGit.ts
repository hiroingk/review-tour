import { execFileSync, spawnSync } from 'node:child_process';

export type RunGitOptions = {
  cwd?: string;
  allowFailure?: boolean;
};

export function runGit(args: string[], options?: { cwd?: string; allowFailure?: false }): string;
export function runGit(
  args: string[],
  options: { cwd?: string; allowFailure: true },
): string | null;
export function runGit(args: string[], options: RunGitOptions = {}) {
  try {
    return execFileSync('git', args, {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error) {
    if (options.allowFailure) {
      return null;
    }
    throw error;
  }
}

export function gitSucceeds(args: string[], cwd?: string) {
  return runGit(args, { cwd, allowFailure: true }) !== null;
}

export function runGitAllowingExitCodes(
  args: string[],
  options: { acceptedExitCodes: readonly number[]; cwd?: string },
) {
  const result = spawnSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === null || !options.acceptedExitCodes.includes(result.status)) {
    const detail = result.stderr.trim();
    throw new Error(detail || `git ${args.join(' ')} failed with exit code ${result.status}.`);
  }

  return result.stdout.trimEnd();
}
