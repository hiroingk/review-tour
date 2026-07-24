import type { ReviewTour } from 'review-tour/schema';
import { runGit, runGitAllowingExitCodes } from './runGit.js';

export type DiffMode = ReviewTour['diff']['mode'];
export const DIFF_CONTEXT_LINES = 20;

export function getDiff(input: {
  repoRoot: string;
  mode: DiffMode;
  baseBranch: string;
  head?: string;
  includeUntracked?: boolean;
  untrackedPaths?: readonly string[];
}) {
  const common = [
    'diff',
    '--find-renames',
    '--no-color',
    '--no-ext-diff',
    `--unified=${DIFF_CONTEXT_LINES}`,
  ];

  if (input.mode === 'working-tree') {
    const trackedDiff = runGit(common, { cwd: input.repoRoot });
    if (!input.includeUntracked) {
      return trackedDiff;
    }

    const untrackedPaths = input.untrackedPaths ?? getUntrackedPaths(input.repoRoot);
    const untrackedDiffs = untrackedPaths.map((filePath) =>
      runGitAllowingExitCodes(
        [
          'diff',
          '--no-index',
          '--no-color',
          '--no-ext-diff',
          `--unified=${DIFF_CONTEXT_LINES}`,
          '--',
          '/dev/null',
          filePath,
        ],
        {
          acceptedExitCodes: [0, 1],
          cwd: input.repoRoot,
        },
      ),
    );

    return [trackedDiff, ...untrackedDiffs].filter(Boolean).join('\n');
  }

  if (input.mode === 'staged') {
    return runGit([...common, '--cached'], { cwd: input.repoRoot });
  }

  if (input.mode === 'base...head') {
    return runGit([...common, `${input.baseBranch}...${input.head ?? 'HEAD'}`], {
      cwd: input.repoRoot,
    });
  }

  return runGit([...common, input.baseBranch, input.head ?? 'HEAD'], {
    cwd: input.repoRoot,
  });
}

export function hasDiff(input: {
  repoRoot: string;
  mode: DiffMode;
  baseBranch: string;
  head?: string;
  includeUntracked?: boolean;
}) {
  return getDiff(input).length > 0;
}

export function getUntrackedPaths(repoRoot: string) {
  const output = runGit(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: repoRoot });
  return output.split('\0').filter(Boolean);
}
