import {
  assertReviewTour,
  type DiffFile,
  type ReviewChapter,
  type ReviewTour,
  type ReviewTourDraft,
} from 'review-tour/schema';
import { getNumberOption, hasFlag, type ParsedArgs } from '../cliArgs.js';
import { writeArtifact } from '../artifact/store.js';
import { collectDraft } from './collect.js';
import { launchViewer } from './open.js';
import { createFallbackPrologue } from './prologue.js';

import { getCliVersion } from '../version.js';

const version = getCliVersion();

export async function generateCommand(args: ParsedArgs) {
  const draft = collectDraft(args);
  const chapters = createFileBasedChapters(draft);
  const summary = `${chapters.length} file-based chapters covering ${getAllHunkIds(draft).length} hunks.`;
  const tour: ReviewTour = {
    ...draft,
    generator: {
      name: 'review-tour',
      version,
      mode: 'fallback',
    },
    tour: {
      title: `Review tour for ${draft.repository.name}`,
      summary,
      prologue: createFallbackPrologue({ chapters, draft }),
      chapters,
    },
    warnings: draft.warnings,
  };
  assertReviewTour(tour);

  const writeResult = await writeArtifact(tour);
  const shouldOpen = !hasFlag(args, 'no-open');
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

export function createFileBasedChapters(draft: ReviewTourDraft): ReviewChapter[] {
  const groups = {
    source: [] as DiffFile[],
    tests: [] as DiffFile[],
    config: [] as DiffFile[],
  };

  for (const file of draft.diff.files) {
    if (isTestPath(file.path)) {
      groups.tests.push(file);
    } else if (isConfigSchemaOrGeneratedPath(file.path)) {
      groups.config.push(file);
    } else {
      groups.source.push(file);
    }
  }

  return [
    createChapter({
      id: 'chapter_source_changes',
      index: 1,
      title: 'Source changes',
      summary: 'Review the main behavior and implementation changes first.',
      rationale:
        'Application source changes usually define the behavior that the rest of the diff supports.',
      reviewQuestions: [
        'Does the implementation match the intended behavior?',
        'Are edge cases, errors, and data flow handled clearly?',
      ],
      files: groups.source,
      fallbackRisk: inferRisk(groups.source, 'medium'),
    }),
    createChapter({
      id: 'chapter_tests',
      index: 2,
      title: 'Tests',
      summary: 'Review tests after the behavior they protect.',
      rationale: 'Tests are easiest to evaluate once the implementation intent is understood.',
      reviewQuestions: [
        'Do these tests cover the important behavior changes?',
        'Are failure and boundary cases represented?',
      ],
      files: groups.tests,
      fallbackRisk: 'low',
    }),
    createChapter({
      id: 'chapter_config_schema_generated',
      index: 3,
      title: 'Config, schema, and generated files',
      summary: 'Review project wiring, schema, dependency, and generated-file changes.',
      rationale:
        'These files can affect builds, runtime contracts, and dependency behavior even when logic changes are small.',
      reviewQuestions: [
        'Do configuration and schema changes match the source changes?',
        'Are generated or lockfile changes expected?',
      ],
      files: groups.config,
      fallbackRisk: inferRisk(groups.config, 'medium'),
    }),
  ]
    .filter((chapter): chapter is ReviewChapter => Boolean(chapter))
    .map((chapter, index) => ({ ...chapter, index: index + 1 }));
}

function createChapter(input: {
  id: string;
  index: number;
  title: string;
  summary: string;
  rationale: string;
  reviewQuestions: string[];
  files: DiffFile[];
  fallbackRisk: ReviewChapter['risk'];
}): ReviewChapter | null {
  const hunkIds = input.files.flatMap((file) => file.hunks.map((hunk) => hunk.id));
  if (hunkIds.length === 0) {
    return null;
  }

  return {
    id: input.id,
    index: input.index,
    title: input.title,
    summary: input.summary,
    risk: input.fallbackRisk,
    rationale: input.rationale,
    reviewQuestions: input.reviewQuestions,
    hunkIds,
    files: input.files.map((file) => ({
      path: file.path,
      hunkIds: file.hunks.map((hunk) => hunk.id),
    })),
  };
}

function inferRisk(files: DiffFile[], fallbackRisk: ReviewChapter['risk']): ReviewChapter['risk'] {
  if (
    files.some((file) =>
      /(^|\/)(auth|payment|billing|migration|migrations|db|database|security)(\/|\.|$)/i.test(
        file.path,
      ),
    )
  ) {
    return 'high';
  }

  if (files.some((file) => file.deletions > 20 || file.additions > 80)) {
    return 'medium';
  }

  return fallbackRisk;
}

function isTestPath(filePath: string) {
  return /(^|\/)(__tests__|tests?|spec)(\/|$)|(\.|-)(test|spec)\.[^.]+$/i.test(filePath);
}

function isConfigSchemaOrGeneratedPath(filePath: string) {
  return (
    /(^|\/)(dist|build|coverage|generated|schema|schemas)(\/|$)/i.test(filePath) ||
    /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|Gemfile\.lock)$/i.test(
      filePath,
    ) ||
    /(^|\/)(package\.json|tsconfig[^/]*\.json|vite\.config\.[^.]+|next\.config\.[^.]+|eslint\.config\.[^.]+)$/i.test(
      filePath,
    ) ||
    /\.(snap|min\.js|generated\.[^.]+)$/i.test(filePath)
  );
}

function getAllHunkIds(draft: ReviewTourDraft) {
  return draft.diff.files.flatMap((file) => file.hunks.map((hunk) => hunk.id));
}
