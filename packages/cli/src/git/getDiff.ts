import type { ReviewTour } from '@review-tour/schema';
import { runGit } from './runGit.js';

export type DiffMode = ReviewTour['diff']['mode'];

export function getDiff(input: {
  repoRoot: string;
  mode: DiffMode;
  baseBranch: string;
  head?: string;
}) {
  const common = ['diff', '--find-renames', '--no-color', '--no-ext-diff', '--unified=80'];

  if (input.mode === 'working-tree') {
    return runGit(common, { cwd: input.repoRoot });
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
}) {
  return getDiff(input).length > 0;
}
