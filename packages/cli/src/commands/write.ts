import {
  assertReviewChapters,
  assertReviewTour,
  assertReviewTourDraft,
  type ReviewChapter,
  type ReviewGroup,
  type ReviewPrologue,
  type ReviewTour,
  type ReviewTourDraft,
  type ReviewWarning,
} from 'review-tour/schema';
import {
  assertAllowedOptions,
  assertBooleanOptions,
  assertNoPositionals,
  assertStringOptions,
  getNumberOption,
  getStringOption,
  hasFlag,
  type ParsedArgs,
} from '../cliArgs.js';
import { readJsonInput } from '../artifact/readJson.js';
import { writeArtifact } from '../artifact/store.js';
import { launchViewer } from './open.js';
import { createFallbackPrologue, normalizePrologue } from './prologue.js';

import { getCliVersion } from '../version.js';

const version = getCliVersion();
const LARGE_REUSED_HUNK_LINE_THRESHOLD = 200;

type ChaptersPayload = {
  title?: string;
  summary?: string;
  prologue?: ReviewPrologue;
  chapters: ReviewChapter[];
};

type HunkInfo = {
  lineCount: number;
  path: string;
};

export async function writeCommand(args: ParsedArgs) {
  validateWriteArgs(args);
  if (hasFlag(args, 'help')) {
    process.stdout.write(writeHelpText());
    return;
  }

  const draftPath = getStringOption(args, 'draft');
  const chaptersPath = getStringOption(args, 'chapters');
  if (!draftPath) {
    throw new Error('Missing required --draft <path>.');
  }
  if (!chaptersPath) {
    throw new Error('Missing required --chapters <path>.');
  }
  if (draftPath === '-' && chaptersPath === '-') {
    throw new Error('Only one of --draft or --chapters can read from stdin.');
  }

  const draftJson = await readJsonInput(draftPath);
  assertReviewTourDraft(draftJson);
  const draft = draftJson;

  const chaptersPayload = parseChaptersPayload(await readJsonInput(chaptersPath));
  const chapters = normalizeAndRepairChapters(draft, chaptersPayload.chapters);
  const summary =
    chaptersPayload.summary ??
    `${chapters.length} chapters covering ${getAllHunkIds(draft).length} hunks.`;
  const prologue = chaptersPayload.prologue
    ? normalizePrologue(chaptersPayload.prologue)
    : createFallbackPrologue({ chapters, draft, summary: chaptersPayload.summary });
  const tour: ReviewTour = {
    ...draft,
    generator: {
      name: 'review-tour',
      version,
      model: getStringOption(args, 'model'),
      mode: parseGeneratorMode(getStringOption(args, 'generator-mode')),
    },
    tour: {
      title: chaptersPayload.title ?? `Review tour for ${draft.repository.name}`,
      summary,
      prologue,
      chapters,
    },
    warnings: repairWarnings(draft.warnings, chapters, draft),
  };
  assertReviewTour(tour);

  const writeResult = await writeArtifact(tour);
  const shouldOpen = hasFlag(args, 'open');
  const launchResult = shouldOpen
    ? await launchViewer({
        repoHash: writeResult.repoHash,
        tourId: 'latest',
        port: getNumberOption(args, 'port'),
      })
    : undefined;

  const output = {
    repoHash: writeResult.repoHash,
    tourId: writeResult.tourId,
    artifactPath: writeResult.artifactPath,
    latestPath: writeResult.latestPath,
    url: launchResult?.url,
  };

  if (hasFlag(args, 'json')) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    [`Wrote ${writeResult.artifactPath}`, launchResult ? `Open ${launchResult.url}` : undefined]
      .filter(Boolean)
      .join('\n') + '\n',
  );
}

function parseChaptersPayload(input: unknown): ChaptersPayload {
  if (Array.isArray(input)) {
    assertReviewChapters(input);
    return { chapters: input };
  }

  if (!isRecord(input) || !Array.isArray(input.chapters)) {
    throw new Error('Chapters file must be a ReviewChapter[] or { chapters }.');
  }

  assertReviewChapters(input.chapters);
  return {
    title: typeof input.title === 'string' ? input.title : undefined,
    summary: typeof input.summary === 'string' ? input.summary : undefined,
    prologue: input.prologue === undefined ? undefined : (input.prologue as ReviewPrologue),
    chapters: input.chapters,
  };
}

export function normalizeAndRepairChapters(draft: ReviewTourDraft, chapters: ReviewChapter[]) {
  const hunkInfo = createHunkInfoMap(draft);
  const knownHunks = new Set(hunkInfo.keys());
  const normalized = chapters.map((chapter, index) => {
    const hunkIds = [...new Set(chapter.hunkIds)];
    if (hunkIds.length === 0) {
      throw new Error(`Chapter "${chapter.title}" must include at least one hunkId.`);
    }

    const unknownHunks = hunkIds.filter((hunkId) => !knownHunks.has(hunkId));
    if (unknownHunks.length > 0) {
      throw new Error(`Unknown hunk IDs in chapter "${chapter.title}": ${unknownHunks.join(', ')}`);
    }

    return {
      ...chapter,
      index: chapter.index || index + 1,
      hunkIds,
      files: createChapterFiles({
        fallbackRisk: chapter.risk,
        hunkIds,
        hunkInfo,
        sourceFiles: chapter.files,
      }),
    };
  });

  const covered = new Set(normalized.flatMap((chapter) => chapter.hunkIds));
  const missing = [...knownHunks].filter((hunkId) => !covered.has(hunkId));
  if (missing.length > 0) {
    normalized.push(createFallbackChapter(normalized.length + 1, missing, hunkInfo));
  }

  return normalized;
}

export function repairWarnings(
  warnings: ReviewWarning[],
  chapters: ReviewChapter[],
  draft: ReviewTourDraft,
): ReviewWarning[] {
  const repairedWarnings = [...warnings];
  const allHunks = getAllHunkIds(draft);
  const covered = new Set(chapters.flatMap((chapter) => chapter.hunkIds));
  const hasMissing = allHunks.some((hunkId) => !covered.has(hunkId));
  const repairedByFallback = chapters.some((chapter) => chapter.id === 'chapter_uncovered_hunks');

  if (
    (hasMissing || repairedByFallback) &&
    !repairedWarnings.some((warning) => warning.code === 'LLM_PARTIAL_COVERAGE')
  ) {
    repairedWarnings.push({
      code: 'LLM_PARTIAL_COVERAGE',
      message: 'Some hunks were not assigned to chapters; a fallback chapter was added.',
    });
  }

  if (!repairedWarnings.some((warning) => warning.code === 'LARGE_HUNK_REUSED')) {
    const repeatedLargeHunks = getRepeatedLargeHunks({ chapters, draft });
    if (repeatedLargeHunks.length > 0) {
      const details = repeatedLargeHunks
        .slice(0, 4)
        .map(
          (hunk) =>
            `${hunk.path} ${hunk.id} (${hunk.lineCount} lines, ${hunk.chapterCount} chapters)`,
        );
      const extraCount = repeatedLargeHunks.length - details.length;
      const suffix = extraCount > 0 ? `, and ${extraCount} more` : '';

      repairedWarnings.push({
        code: 'LARGE_HUNK_REUSED',
        message: `Large hunks are assigned to multiple chapters: ${details.join('; ')}${suffix}. Prefer one primary chapter and reference related behavior in summaries or review questions.`,
      });
    }
  }

  return repairedWarnings;
}

function getRepeatedLargeHunks({
  chapters,
  draft,
}: {
  chapters: ReviewChapter[];
  draft: ReviewTourDraft;
}) {
  const hunkToFile = new Map<string, { lineCount: number; path: string }>();
  for (const file of draft.diff.files) {
    for (const hunk of file.hunks) {
      hunkToFile.set(hunk.id, { lineCount: hunk.lines.length, path: file.path });
    }
  }

  const chapterIdsByHunk = new Map<string, Set<string>>();
  for (const chapter of chapters) {
    for (const hunkId of new Set(chapter.hunkIds)) {
      const chapterIds = chapterIdsByHunk.get(hunkId) ?? new Set<string>();
      chapterIds.add(chapter.id);
      chapterIdsByHunk.set(hunkId, chapterIds);
    }
  }

  return [...chapterIdsByHunk.entries()]
    .flatMap(([hunkId, chapterIds]) => {
      const hunk = hunkToFile.get(hunkId);
      if (!hunk) return [];
      if (chapterIds.size <= 1 || hunk.lineCount < LARGE_REUSED_HUNK_LINE_THRESHOLD) return [];

      return [
        {
          chapterCount: chapterIds.size,
          id: hunkId,
          lineCount: hunk.lineCount,
          path: hunk.path,
        },
      ];
    })
    .sort((a, b) => b.lineCount - a.lineCount);
}

function createFallbackChapter(
  index: number,
  hunkIds: string[],
  hunkInfo: Map<string, HunkInfo>,
): ReviewChapter {
  return {
    id: 'chapter_uncovered_hunks',
    index,
    title: 'Uncovered diff hunks',
    summary: 'These hunks were not assigned by the chapter generator.',
    risk: 'medium',
    rationale: 'Every hunk must be reviewable, so the CLI grouped the uncovered hunks here.',
    reviewQuestions: ['Do these uncovered hunks need their own review chapter?'],
    hunkIds,
    files: createChapterFiles({
      createFallbackGroups: true,
      fallbackRisk: 'medium',
      hunkIds,
      hunkInfo,
    }),
  };
}

function createChapterFiles({
  createFallbackGroups = false,
  fallbackRisk,
  hunkIds,
  hunkInfo,
  sourceFiles = [],
}: {
  createFallbackGroups?: boolean;
  fallbackRisk: ReviewChapter['risk'];
  hunkIds: string[];
  hunkInfo: Map<string, HunkInfo>;
  sourceFiles?: ReviewChapter['files'];
}): ReviewChapter['files'] {
  const byPath = new Map<string, string[]>();
  for (const hunkId of hunkIds) {
    const info = hunkInfo.get(hunkId);
    if (!info) {
      continue;
    }
    const filePath = info.path;
    const existing = byPath.get(filePath) ?? [];
    existing.push(hunkId);
    byPath.set(filePath, existing);
  }

  const sourceFilesByPath = new Map<string, ReviewChapter['files'][number]>();
  for (const sourceFile of sourceFiles) {
    const existing = sourceFilesByPath.get(sourceFile.path);
    if (sourceFile.groups?.length && !byPath.has(sourceFile.path)) {
      throw new Error(
        `Review groups reference file "${sourceFile.path}" with no hunks in the chapter.`,
      );
    }
    if (existing?.groups?.length && sourceFile.groups?.length) {
      throw new Error(`Duplicate review group metadata for file "${sourceFile.path}".`);
    }
    if (existing?.groups?.length) {
      continue;
    }
    sourceFilesByPath.set(sourceFile.path, sourceFile);
  }

  return [...byPath.entries()].map(([filePath, groupedHunkIds]) => {
    const groups = normalizeReviewGroups({
      createFallbackGroup: createFallbackGroups,
      fallbackRisk,
      filePath,
      groups: sourceFilesByPath.get(filePath)?.groups,
      hunkIds: groupedHunkIds,
    });

    return {
      path: filePath,
      hunkIds: groupedHunkIds,
      ...(groups ? { groups } : {}),
    };
  });
}

function normalizeReviewGroups({
  createFallbackGroup,
  fallbackRisk,
  filePath,
  groups,
  hunkIds,
}: {
  createFallbackGroup: boolean;
  fallbackRisk: ReviewChapter['risk'];
  filePath: string;
  groups: ReviewGroup[] | undefined;
  hunkIds: string[];
}): ReviewGroup[] | undefined {
  if (!groups?.length) {
    return createFallbackGroup
      ? [createFallbackReviewGroup({ fallbackRisk, filePath, hunkIds })]
      : undefined;
  }

  const hunkIndex = new Map(hunkIds.map((hunkId, index) => [hunkId, index]));
  const assignedHunks = new Set<string>();
  const groupIds = new Set<string>();
  const normalized = groups.map((group) => {
    if (groupIds.has(group.id)) {
      throw new Error(`Duplicate review group ID "${group.id}" in file "${filePath}".`);
    }
    groupIds.add(group.id);

    const duplicateHunks = [
      ...new Set(group.hunkIds.filter((hunkId, index) => group.hunkIds.indexOf(hunkId) !== index)),
    ];
    if (duplicateHunks.length > 0) {
      throw new Error(
        `Duplicate hunk IDs in review group "${group.title}" for file "${filePath}": ${duplicateHunks.join(', ')}`,
      );
    }

    const groupHunkIds = [...group.hunkIds];
    if (groupHunkIds.length === 0) {
      throw new Error(`Review group "${group.title}" in file "${filePath}" must include hunkIds.`);
    }

    const unknownHunks = groupHunkIds.filter((hunkId) => !hunkIndex.has(hunkId));
    if (unknownHunks.length > 0) {
      throw new Error(
        `Unknown hunk IDs in review group "${group.title}" for file "${filePath}": ${unknownHunks.join(', ')}`,
      );
    }

    const repeatedHunks = groupHunkIds.filter((hunkId) => assignedHunks.has(hunkId));
    if (repeatedHunks.length > 0) {
      throw new Error(
        `Hunk IDs assigned to multiple review groups in file "${filePath}": ${repeatedHunks.join(', ')}`,
      );
    }

    const orderedHunkIds = [...groupHunkIds].sort(
      (left, right) => (hunkIndex.get(left) ?? 0) - (hunkIndex.get(right) ?? 0),
    );
    const positions = orderedHunkIds.map((hunkId) => hunkIndex.get(hunkId) ?? 0);
    const contiguous = positions.every(
      (position, index) => index === 0 || position === (positions[index - 1] ?? 0) + 1,
    );
    if (!contiguous) {
      throw new Error(
        `Review group "${group.title}" in file "${filePath}" must reference contiguous hunks.`,
      );
    }

    for (const hunkId of orderedHunkIds) {
      assignedHunks.add(hunkId);
    }

    return { ...group, hunkIds: orderedHunkIds };
  });

  const missingHunkIds = hunkIds.filter((hunkId) => !assignedHunks.has(hunkId));
  for (const contiguousHunkIds of splitContiguousHunkIds(missingHunkIds, hunkIndex)) {
    const fallbackGroup = createFallbackReviewGroup({
      fallbackRisk,
      filePath,
      hunkIds: contiguousHunkIds,
      title: 'Additional changes',
    });
    let fallbackId = fallbackGroup.id;
    let suffix = 2;
    while (groupIds.has(fallbackId)) {
      fallbackId = `${fallbackGroup.id}_${suffix}`;
      suffix += 1;
    }
    groupIds.add(fallbackId);
    normalized.push({ ...fallbackGroup, id: fallbackId });
  }

  return normalized.sort(
    (left, right) =>
      (hunkIndex.get(left.hunkIds[0] ?? '') ?? 0) - (hunkIndex.get(right.hunkIds[0] ?? '') ?? 0),
  );
}

function createFallbackReviewGroup({
  fallbackRisk,
  filePath,
  hunkIds,
  title = `Review ${getFileName(filePath)}`,
}: {
  fallbackRisk: ReviewChapter['risk'];
  filePath: string;
  hunkIds: string[];
  title?: string;
}): ReviewGroup {
  return {
    id: `group_fallback_${hunkIds[0] ?? 'unassigned'}`,
    title,
    summary: `Review these related changes in \`${filePath}\` as one implementation unit.`,
    risk: fallbackRisk,
    hunkIds,
  };
}

function splitContiguousHunkIds(hunkIds: string[], hunkIndex: Map<string, number>) {
  const groups: string[][] = [];

  for (const hunkId of hunkIds) {
    const current = groups.at(-1);
    const previousHunkId = current?.at(-1);
    const followsPrevious =
      previousHunkId !== undefined &&
      (hunkIndex.get(hunkId) ?? 0) === (hunkIndex.get(previousHunkId) ?? 0) + 1;

    if (current && followsPrevious) {
      current.push(hunkId);
    } else {
      groups.push([hunkId]);
    }
  }

  return groups;
}

export function validateWriteArgs(args: ParsedArgs) {
  assertNoPositionals(args, 'write');
  assertAllowedOptions(args, 'write', [
    'chapters',
    'draft',
    'generator-mode',
    'help',
    'json',
    'model',
    'open',
    'port',
  ]);
  assertBooleanOptions(args, ['help', 'json', 'open']);
  assertStringOptions(args, ['chapters', 'draft', 'generator-mode', 'model', 'port']);
}

function writeHelpText() {
  return `review-tour write

Usage:
  review-tour write --draft <path|-> --chapters <path|->
    [--generator-mode codex-skill|cli-llm|fallback] [--model <name>]
    [--open] [--port 4378] [--json]

Options:
  --draft <path|->     Collected draft JSON path, or - for stdin.
  --chapters <path|->  AI-authored chapters JSON path, or - for stdin.
  --open               Start the viewer server and include its URL.
  --json               Print machine-readable result JSON.
  --help               Show this help.
`;
}

function getFileName(filePath: string) {
  return filePath.split('/').filter(Boolean).at(-1) ?? filePath;
}

function createHunkInfoMap(draft: ReviewTourDraft) {
  const hunkInfo = new Map<string, HunkInfo>();
  for (const file of draft.diff.files) {
    for (const hunk of file.hunks) {
      hunkInfo.set(hunk.id, { lineCount: hunk.lines.length, path: file.path });
    }
  }
  return hunkInfo;
}

function getAllHunkIds(draft: ReviewTourDraft) {
  return draft.diff.files.flatMap((file) => file.hunks.map((hunk) => hunk.id));
}

function parseGeneratorMode(value: string | undefined): ReviewTour['generator']['mode'] {
  if (value === undefined) {
    return 'codex-skill';
  }

  if (value === 'codex-skill' || value === 'cli-llm' || value === 'fallback') {
    return value;
  }

  throw new Error(`Unsupported generator mode: ${value}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
