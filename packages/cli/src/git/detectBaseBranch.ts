import type { ReviewWarning } from '@review-tour/schema';
import { gitSucceeds, runGit } from './runGit.js';

export type BaseBranchResult = {
  baseBranch: string;
  baseSha?: string;
  warnings: ReviewWarning[];
};

export function detectBaseBranch(input: {
  repoRoot: string;
  explicitBase?: string;
}): BaseBranchResult {
  if (input.explicitBase) {
    return {
      baseBranch: input.explicitBase,
      baseSha: resolveRef(input.repoRoot, input.explicitBase),
      warnings: [],
    };
  }

  const candidates = uniqueCandidates([
    getTrackingUpstreamBranch(input.repoRoot),
    'origin/main',
    'origin/master',
    'main',
    'master',
    getRemoteDefaultBranch(input.repoRoot),
    'HEAD~1',
  ]);

  for (const candidate of candidates) {
    if (gitSucceeds(['rev-parse', '--verify', candidate], input.repoRoot)) {
      const baseBranch = promoteMergedBaseBranch(input.repoRoot, candidate);
      return {
        baseBranch,
        baseSha: resolveRef(input.repoRoot, baseBranch),
        warnings: [
          {
            code: 'BASE_BRANCH_GUESSED',
            message:
              baseBranch === candidate
                ? `Base branch was inferred as ${candidate}.`
                : `Base branch was inferred as ${candidate}, then updated to ${baseBranch} because ${candidate} is already merged into ${baseBranch}.`,
          },
        ],
      };
    }
  }

  return {
    baseBranch: 'HEAD',
    baseSha: resolveRef(input.repoRoot, 'HEAD'),
    warnings: [
      {
        code: 'BASE_BRANCH_GUESSED',
        message: 'Base branch could not be inferred; using HEAD.',
      },
    ],
  };
}

function uniqueCandidates(candidates: Array<string | null>) {
  return candidates.filter((candidate, index): candidate is string => {
    return Boolean(candidate) && candidates.indexOf(candidate) === index;
  });
}

function resolveRef(repoRoot: string, ref: string) {
  return (
    runGit(['rev-parse', ref], {
      cwd: repoRoot,
      allowFailure: true,
    }) ?? undefined
  );
}

function promoteMergedBaseBranch(repoRoot: string, baseBranch: string) {
  const candidates = uniqueCandidates([
    getRemoteDefaultBranch(repoRoot),
    'origin/main',
    'origin/master',
    'main',
    'master',
  ]);

  for (const candidate of candidates) {
    if (candidate === baseBranch) {
      continue;
    }
    if (!gitSucceeds(['rev-parse', '--verify', candidate], repoRoot)) {
      continue;
    }
    if (isStrictAncestor(repoRoot, baseBranch, candidate)) {
      return candidate;
    }
  }

  return baseBranch;
}

function isStrictAncestor(repoRoot: string, ancestor: string, descendant: string) {
  if (!gitSucceeds(['merge-base', '--is-ancestor', ancestor, descendant], repoRoot)) {
    return false;
  }

  return resolveRef(repoRoot, ancestor) !== resolveRef(repoRoot, descendant);
}

function getRemoteDefaultBranch(repoRoot: string) {
  const symbolicRef = runGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], {
    cwd: repoRoot,
    allowFailure: true,
  });

  if (!symbolicRef) {
    return null;
  }

  return symbolicRef.replace(/^refs\/remotes\//, '');
}

function getTrackingUpstreamBranch(repoRoot: string) {
  return runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
    cwd: repoRoot,
    allowFailure: true,
  });
}
