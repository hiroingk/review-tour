import { execFileSync } from 'node:child_process';

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
