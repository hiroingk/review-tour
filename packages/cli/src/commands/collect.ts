import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReviewTour, ReviewTourDraft, ReviewWarning } from 'review-tour/schema';
import { assertReviewTourDraft } from 'review-tour/schema';
import {
  assertAllowedOptions,
  assertBooleanOptions,
  assertNoPositionals,
  assertStringOptions,
  getStringOption,
  hasFlag,
  type ParsedArgs,
} from '../cliArgs.js';
import { parseUnifiedDiff } from '../diff/parseUnifiedDiff.js';
import { detectBaseBranch } from '../git/detectBaseBranch.js';
import { createDirtyWarning, detectRepo } from '../git/detectRepo.js';
import { getDiff, getUntrackedPaths, hasDiff, type DiffMode } from '../git/getDiff.js';
import { getLocalGitHubRepositories } from '../git/remotes.js';
import {
  parseGitHubPullRequestUrl,
  readPullRequest,
  type PullRequestInfo,
} from '../github/pullRequest.js';

import { getCliVersion } from '../version.js';

const version = getCliVersion();

export async function collectCommand(args: ParsedArgs) {
  validateCollectArgs(args);
  if (hasFlag(args, 'help')) {
    process.stdout.write(collectHelpText());
    return;
  }

  const draft = collectDraft(args);
  const outputPath = getStringOption(args, 'output');
  const json = `${JSON.stringify(draft, null, 2)}\n`;
  if (outputPath) {
    await writeFile(outputPath, json, 'utf8');
  }

  if (hasFlag(args, 'json') || !outputPath) {
    process.stdout.write(json);
    return;
  }

  process.stdout.write(
    [
      `Collected ${draft.diff.stats.filesChanged} files, ${draft.diff.stats.additions} additions, ${draft.diff.stats.deletions} deletions.`,
      `Wrote ${path.resolve(outputPath)}.`,
    ].join('\n') + '\n',
  );
}

export function collectDraft(args: ParsedArgs) {
  const repo = detectRepo(process.cwd());
  const includeUntracked = hasFlag(args, 'include-untracked');
  const pullRequestSelector = getPullRequestSelector(args);
  if (pullRequestSelector !== undefined) {
    assertPullRequestOptions(args);
    const pullRequestUrl = parseGitHubPullRequestUrl(pullRequestSelector);
    if (pullRequestUrl) {
      assertPullRequestMatchesLocalRepo({
        localRepositories: getLocalGitHubRepositories(repo.root),
        pullRequestRepository: pullRequestUrl.repository,
      });
    }

    const pullRequest = readPullRequest(pullRequestSelector);
    return createPullRequestDraft({
      repo,
      pullRequest: pullRequest.info,
      unifiedDiff: pullRequest.unifiedDiff,
    });
  }

  const explicitBase = getStringOption(args, 'base');
  const head = getStringOption(args, 'head') ?? 'HEAD';
  const base = detectBaseBranch({ repoRoot: repo.root, explicitBase });
  const mode = inferDiffMode({
    repoRoot: repo.root,
    requestedMode: getStringOption(args, 'mode'),
    baseBranch: base.baseBranch,
    head,
    includeUntracked,
  });
  if (includeUntracked && mode !== 'working-tree') {
    throw new Error('--include-untracked can only be used with working-tree mode.');
  }
  const untrackedPaths = mode === 'working-tree' ? getUntrackedPaths(repo.root) : [];

  const unifiedDiff = getDiff({
    repoRoot: repo.root,
    mode,
    baseBranch: base.baseBranch,
    head,
    includeUntracked,
    untrackedPaths,
  });

  if (unifiedDiff.length === 0) {
    if (untrackedPaths.length > 0 && !includeUntracked) {
      throw new Error(
        `${untrackedPaths.length} untracked file(s) were skipped. Rerun with --mode working-tree --include-untracked.`,
      );
    }

    throw new Error(
      [
        'No changes found.',
        'Try:',
        '  review-tour collect --mode working-tree',
        '  review-tour collect --mode staged',
      ].join('\n'),
    );
  }

  const parsedDiff = parseUnifiedDiff(unifiedDiff);
  const warnings: ReviewWarning[] = [
    ...base.warnings,
    ...(mode === 'base...head' ? [] : createDirtyWarning(repo.isDirty)),
    ...(mode === 'working-tree' && untrackedPaths.length > 0 && !includeUntracked
      ? [createUntrackedFilesSkippedWarning(untrackedPaths)]
      : []),
    ...parsedDiff.warnings,
  ];

  const draft: ReviewTourDraft = {
    schemaVersion: 'review-tour/v1',
    id: createTourId(),
    createdAt: new Date().toISOString(),
    generator: {
      name: 'review-tour',
      version,
      mode: 'fallback',
    },
    repository: {
      root: repo.root,
      name: repo.name,
      currentBranch: repo.currentBranch,
      baseBranch: base.baseBranch,
      headSha: repo.headSha,
      baseSha: base.baseSha,
      isDirty: repo.isDirty,
    },
    diff: {
      mode,
      stats: {
        filesChanged: parsedDiff.files.length,
        additions: parsedDiff.files.reduce((sum, file) => sum + file.additions, 0),
        deletions: parsedDiff.files.reduce((sum, file) => sum + file.deletions, 0),
      },
      files: parsedDiff.files,
    },
    warnings,
  };
  assertReviewTourDraft(draft);
  return draft;
}

export function createPullRequestDraft(input: {
  repo: ReturnType<typeof detectRepo>;
  pullRequest: PullRequestInfo;
  unifiedDiff: string;
  createdAt?: string;
}) {
  if (input.unifiedDiff.length === 0) {
    throw new Error('No changes found in GitHub pull request.');
  }

  const parsedDiff = parseUnifiedDiff(input.unifiedDiff);
  const draft: ReviewTourDraft = {
    schemaVersion: 'review-tour/v1',
    id: createTourId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    generator: {
      name: 'review-tour',
      version,
      mode: 'fallback',
    },
    repository: {
      root: input.repo.root,
      name: input.repo.name,
      currentBranch: input.pullRequest.headRefName,
      baseBranch: input.pullRequest.baseRefName,
      headSha: input.pullRequest.headRefOid,
      baseSha: input.pullRequest.baseRefOid,
      isDirty: false,
    },
    diff: {
      mode: 'custom',
      stats: {
        filesChanged: parsedDiff.files.length,
        additions: parsedDiff.files.reduce((sum, file) => sum + file.additions, 0),
        deletions: parsedDiff.files.reduce((sum, file) => sum + file.deletions, 0),
      },
      files: parsedDiff.files,
    },
    pullRequest: {
      additions: input.pullRequest.additions,
      author: input.pullRequest.author,
      baseRefName: input.pullRequest.baseRefName,
      body: input.pullRequest.body,
      changedFiles: input.pullRequest.changedFiles,
      deletions: input.pullRequest.deletions,
      headRefName: input.pullRequest.headRefName,
      headRepository: input.pullRequest.headRepository,
      isCrossRepository: input.pullRequest.isCrossRepository,
      number: input.pullRequest.number,
      title: input.pullRequest.title,
      url: input.pullRequest.url,
    },
    warnings: parsedDiff.warnings,
  };
  assertReviewTourDraft(draft);
  return draft;
}

function assertPullRequestOptions(args: ParsedArgs) {
  for (const option of ['base', 'head', 'include-untracked', 'mode']) {
    if (args.options.has(option)) {
      throw new Error(`review-tour collect --pr cannot be combined with --${option}.`);
    }
  }
}

function assertPullRequestMatchesLocalRepo(input: {
  localRepositories: string[];
  pullRequestRepository: string;
}) {
  if (input.localRepositories.includes(input.pullRequestRepository)) {
    return;
  }

  throw new Error(
    [
      `Pull request belongs to ${input.pullRequestRepository}, but this checkout does not have a matching GitHub remote.`,
      'Run review-tour from the matching local repository checkout.',
    ].join('\n'),
  );
}

function getPullRequestSelector(args: ParsedArgs) {
  const value = args.options.get('pr');
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('--pr requires a pull request URL, number, or branch.');
  }

  return value;
}

function inferDiffMode(input: {
  repoRoot: string;
  requestedMode?: string;
  baseBranch: string;
  head: string;
  includeUntracked: boolean;
}): DiffMode {
  if (input.requestedMode) {
    if (isDiffMode(input.requestedMode)) {
      return input.requestedMode;
    }
    throw new Error(`Unsupported diff mode: ${input.requestedMode}`);
  }

  if (
    hasDiff({
      repoRoot: input.repoRoot,
      mode: 'base...head',
      baseBranch: input.baseBranch,
      head: input.head,
    })
  ) {
    return 'base...head';
  }

  if (
    hasDiff({
      repoRoot: input.repoRoot,
      mode: 'staged',
      baseBranch: input.baseBranch,
      head: input.head,
    })
  ) {
    return 'staged';
  }

  if (
    hasDiff({
      repoRoot: input.repoRoot,
      mode: 'working-tree',
      baseBranch: input.baseBranch,
      head: input.head,
      includeUntracked: input.includeUntracked,
    })
  ) {
    return 'working-tree';
  }

  if (getUntrackedPaths(input.repoRoot).length > 0) {
    return 'working-tree';
  }

  return 'base...head';
}

function isDiffMode(value: string): value is ReviewTour['diff']['mode'] {
  return ['base...head', 'working-tree', 'staged', 'custom'].includes(value);
}

function createTourId() {
  return `tour_${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)}`;
}

export function validateCollectArgs(args: ParsedArgs) {
  assertNoPositionals(args, 'collect');
  assertAllowedOptions(args, 'collect', [
    'base',
    'head',
    'help',
    'include-untracked',
    'json',
    'mode',
    'output',
    'pr',
  ]);
  assertBooleanOptions(args, ['help', 'include-untracked', 'json']);
  assertStringOptions(args, ['base', 'head', 'mode', 'output', 'pr']);
}

export function collectHelpText() {
  return `review-tour collect

Usage:
  review-tour collect [--pr <url|number>] [--base origin/main] [--head HEAD]
    [--mode base...head|working-tree|staged|custom] [--include-untracked]
    [--output <path>] [--json]

Options:
  --include-untracked  Include untracked, non-ignored files in working-tree mode.
  --output <path>      Write the full draft JSON to a file. Omit --json to suppress full stdout.
  --json               Print the full draft JSON to stdout.
  --help               Show this help.
`;
}

export function createUntrackedFilesSkippedWarning(paths: readonly string[]): ReviewWarning {
  const examples = paths.slice(0, 3).join(', ');
  const remaining = paths.length - Math.min(paths.length, 3);
  return {
    code: 'UNTRACKED_FILES_SKIPPED',
    message: `${paths.length} untracked file(s) were skipped${examples ? `: ${examples}` : ''}${
      remaining > 0 ? `, and ${remaining} more` : ''
    }. Rerun with --include-untracked to include them.`,
  };
}
