import { writeFile } from 'node:fs/promises';
import type { ReviewTour, ReviewTourDraft, ReviewWarning } from '@review-tour/schema';
import { assertReviewTourDraft } from '@review-tour/schema';
import { getStringOption, hasFlag, type ParsedArgs } from '../cliArgs.js';
import { parseUnifiedDiff } from '../diff/parseUnifiedDiff.js';
import { detectBaseBranch } from '../git/detectBaseBranch.js';
import { createDirtyWarning, detectRepo } from '../git/detectRepo.js';
import { getDiff, hasDiff, type DiffMode } from '../git/getDiff.js';

const version = '0.0.0';

export async function collectCommand(args: ParsedArgs) {
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
    `Collected ${draft.diff.stats.filesChanged} files, ${draft.diff.stats.additions} additions, ${draft.diff.stats.deletions} deletions.\n`,
  );
}

export function collectDraft(args: ParsedArgs) {
  const repo = detectRepo(process.cwd());
  const explicitBase = getStringOption(args, 'base');
  const head = getStringOption(args, 'head') ?? 'HEAD';
  const base = detectBaseBranch({ repoRoot: repo.root, explicitBase });
  const mode = inferDiffMode({
    repoRoot: repo.root,
    requestedMode: getStringOption(args, 'mode'),
    baseBranch: base.baseBranch,
    head,
  });

  const unifiedDiff = getDiff({
    repoRoot: repo.root,
    mode,
    baseBranch: base.baseBranch,
    head,
  });

  if (unifiedDiff.length === 0) {
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

function inferDiffMode(input: {
  repoRoot: string;
  requestedMode?: string;
  baseBranch: string;
  head: string;
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
    })
  ) {
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
