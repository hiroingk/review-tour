import {
  assertReviewChapters,
  assertReviewTour,
  assertReviewTourDraft,
  type ReviewChapter,
  type ReviewPrologue,
  type ReviewTour,
  type ReviewTourDraft,
  type ReviewWarning,
} from 'review-tour/schema';
import { getNumberOption, getStringOption, hasFlag, type ParsedArgs } from '../cliArgs.js';
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

function normalizeAndRepairChapters(draft: ReviewTourDraft, chapters: ReviewChapter[]) {
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
      files: createChapterFiles({ hunkIds, hunkInfo }),
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
    files: createChapterFiles({ hunkIds, hunkInfo }),
  };
}

function createChapterFiles({
  hunkIds,
  hunkInfo,
}: {
  hunkIds: string[];
  hunkInfo: Map<string, HunkInfo>;
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

  return [...byPath.entries()].map(([filePath, groupedHunkIds]) => ({
    path: filePath,
    hunkIds: groupedHunkIds,
  }));
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
