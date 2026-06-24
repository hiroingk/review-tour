import { expect, test } from 'vite-plus/test';
import { createFileBasedChapters } from '../src/commands/generate.ts';
import { createFallbackPrologue, normalizePrologue } from '../src/commands/prologue.ts';

function file(path, hunkId) {
  return {
    id: `file_${hunkId}`,
    path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    hunks: [{ id: hunkId, fileId: `file_${hunkId}`, lines: [] }],
  };
}

test('creates file-based fallback chapters covering every hunk', () => {
  const draft = {
    diff: {
      files: [
        file('src/app.ts', 'hunk_source'),
        file('src/app.test.ts', 'hunk_test'),
        file('pnpm-lock.yaml', 'hunk_lockfile'),
      ],
    },
  };

  const chapters = createFileBasedChapters(draft);
  const hunkIds = chapters.flatMap((chapter) => chapter.hunkIds);

  expect(chapters.map((chapter) => chapter.id)).toEqual([
    'chapter_source_changes',
    'chapter_tests',
    'chapter_config_schema_generated',
  ]);
  expect(hunkIds.sort()).toEqual(['hunk_lockfile', 'hunk_source', 'hunk_test']);
});

test('creates fallback prologue from generated chapters', () => {
  const draft = {
    repository: { name: 'example-repo' },
    diff: {
      stats: { filesChanged: 3 },
      files: [
        file('src/db/dialect.ts', 'hunk_source'),
        file('src/app.test.ts', 'hunk_test'),
        file('pnpm-lock.yaml', 'hunk_lockfile'),
      ],
    },
  };

  const chapters = createFileBasedChapters(draft);
  const prologue = createFallbackPrologue({ chapters, draft });

  expect(prologue.whyThisPr).toContain('example-repo');
  expect(prologue.whyThisPr).toContain('\n\n');
  expect(prologue.whatItDoes).toContain('src/db/dialect.ts');
  expect(prologue.whatItDoes).toContain('\n\n');
  expect(prologue.reviewFocus[0].title).toBe('Source changes');
  expect(prologue.reviewFocus[0].path).toBe('src/db/dialect.ts');
});

test('normalizes long prologue text into readable paragraphs', () => {
  const prologue = normalizePrologue({
    whyThisPr:
      'Developers need reviewers to understand why the implementation changed before reading the diff. Without that context, the first chapter has to carry both motivation and implementation details. Splitting the intro gives the reviewer a calmer path into the code.',
    whatItDoes:
      'The generated tour now separates the motivation from the implementation outcome. It keeps the first section focused on the problem, then moves the second section to the concrete behavior reviewers should expect.',
    reviewFocus: [
      {
        title: 'Readable prologue',
        summary:
          'Confirm the generated overview can be read as separate thoughts. The text should not collapse every idea into one dense paragraph. Reviewers should be able to scan the first concern and then continue into the concrete verification note.',
      },
    ],
  });

  expect(prologue.whyThisPr).toContain('\n\n');
  expect(prologue.whatItDoes).toContain('\n\n');
  expect(prologue.reviewFocus[0].summary).toContain('\n\n');
});
