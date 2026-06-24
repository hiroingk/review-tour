import {
  assertReviewChapters,
  assertReviewTour,
  assertReviewTourDraft,
  type ReviewChapter,
  type ReviewPrologue,
  type ReviewTour,
  type ReviewTourDraft,
  type ReviewWarning,
} from '@review-tour/schema';
import { getNumberOption, getStringOption, hasFlag, type ParsedArgs } from '../cliArgs.js';
import { readJsonFile } from '../artifact/readJson.js';
import { writeArtifact } from '../artifact/store.js';
import { launchViewer } from './open.js';
import { createFallbackPrologue, normalizePrologue } from './prologue.js';

const version = '0.0.0';

type ChaptersPayload = {
  title?: string;
  summary?: string;
  prologue?: ReviewPrologue;
  chapters: ReviewChapter[];
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

  const draftJson = await readJsonFile(draftPath);
  assertReviewTourDraft(draftJson);
  const draft = draftJson;

  const chaptersPayload = parseChaptersPayload(await readJsonFile(chaptersPath));
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
  const hunkToPath = createHunkPathMap(draft);
  const knownHunks = new Set(hunkToPath.keys());
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
      files: createChapterFiles(hunkIds, hunkToPath),
    };
  });

  const covered = new Set(normalized.flatMap((chapter) => chapter.hunkIds));
  const missing = [...knownHunks].filter((hunkId) => !covered.has(hunkId));
  if (missing.length > 0) {
    normalized.push(createFallbackChapter(normalized.length + 1, missing, hunkToPath));
  }

  return normalized;
}

function repairWarnings(
  warnings: ReviewWarning[],
  chapters: ReviewChapter[],
  draft: ReviewTourDraft,
): ReviewWarning[] {
  const allHunks = getAllHunkIds(draft);
  const covered = new Set(chapters.flatMap((chapter) => chapter.hunkIds));
  const hasMissing = allHunks.some((hunkId) => !covered.has(hunkId));
  const repairedByFallback = chapters.some((chapter) => chapter.id === 'chapter_uncovered_hunks');

  if (!hasMissing && !repairedByFallback) {
    return warnings;
  }

  if (warnings.some((warning) => warning.code === 'LLM_PARTIAL_COVERAGE')) {
    return warnings;
  }

  const coverageWarning: ReviewWarning = {
    code: 'LLM_PARTIAL_COVERAGE',
    message: 'Some hunks were not assigned to chapters; a fallback chapter was added.',
  };

  return [...warnings, coverageWarning];
}

function createFallbackChapter(
  index: number,
  hunkIds: string[],
  hunkToPath: Map<string, string>,
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
    files: createChapterFiles(hunkIds, hunkToPath),
  };
}

function createChapterFiles(
  hunkIds: string[],
  hunkToPath: Map<string, string>,
): ReviewChapter['files'] {
  const byPath = new Map<string, string[]>();
  for (const hunkId of hunkIds) {
    const filePath = hunkToPath.get(hunkId);
    if (!filePath) {
      continue;
    }
    const existing = byPath.get(filePath) ?? [];
    existing.push(hunkId);
    byPath.set(filePath, existing);
  }

  return [...byPath.entries()].map(([filePath, groupedHunkIds]) => ({
    path: filePath,
    hunkIds: groupedHunkIds,
  }));
}

function createHunkPathMap(draft: ReviewTourDraft) {
  const hunkToPath = new Map<string, string>();
  for (const file of draft.diff.files) {
    for (const hunk of file.hunks) {
      hunkToPath.set(hunk.id, file.path);
    }
  }
  return hunkToPath;
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
