import path from 'node:path';
import type { ReviewWarning } from '@review-tour/schema';
import { runGit } from './runGit.js';

export type RepositoryInfo = {
  root: string;
  name: string;
  currentBranch: string;
  headSha: string;
  isDirty: boolean;
};

export function detectRepo(cwd = process.cwd()): RepositoryInfo {
  const root = runGit(['rev-parse', '--show-toplevel'], { cwd });
  if (!root) {
    throw new Error('Not a git repository.');
  }

  const currentBranch =
    runGit(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      allowFailure: true,
    }) ?? 'HEAD';
  const headSha = runGit(['rev-parse', 'HEAD'], { cwd: root });
  const status = runGit(['status', '--porcelain'], { cwd: root });

  return {
    root,
    name: path.basename(root),
    currentBranch,
    headSha,
    isDirty: status.length > 0,
  };
}

export function createDirtyWarning(isDirty: boolean): ReviewWarning[] {
  return isDirty
    ? [
        {
          code: 'UNCOMMITTED_CHANGES_INCLUDED',
          message: 'The repository has uncommitted changes.',
        },
      ]
    : [];
}
