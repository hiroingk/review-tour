import { expect, test } from 'vite-plus/test';
import { repairWarnings } from '../src/commands/write.ts';

function createLargeHunk(id) {
  return {
    id,
    fileId: 'file_service',
    header: '@@ -1,220 +1,220 @@',
    lines: Array.from({ length: 220 }, (_, index) => ({
      content: `line ${index + 1}`,
      newLine: index + 1,
      oldLine: index + 1,
      type: 'context',
    })),
    newLines: 220,
    newStart: 1,
    oldLines: 220,
    oldStart: 1,
    patchHash: 'hash',
  };
}

function createDraft() {
  return {
    diff: {
      files: [
        {
          additions: 1,
          deletions: 0,
          hunks: [createLargeHunk('hunk_large')],
          id: 'file_service',
          path: 'src/service.ts',
          status: 'modified',
        },
      ],
    },
  };
}

function createChapter(id) {
  return {
    files: [{ hunkIds: ['hunk_large'], path: 'src/service.ts' }],
    hunkIds: ['hunk_large'],
    id,
    index: 1,
    rationale: 'Review a large implementation hunk.',
    reviewQuestions: ['Is this safe?'],
    risk: 'medium',
    summary: 'Review a large implementation hunk.',
    title: id,
  };
}

test('adds a warning when a large hunk is reused across chapters', () => {
  const warnings = repairWarnings(
    [],
    [createChapter('chapter_one'), createChapter('chapter_two')],
    createDraft(),
  );

  expect(warnings).toEqual([
    {
      code: 'LARGE_HUNK_REUSED',
      message:
        'Large hunks are assigned to multiple chapters: src/service.ts hunk_large (220 lines, 2 chapters). Prefer one primary chapter and reference related behavior in summaries or review questions.',
    },
  ]);
});
