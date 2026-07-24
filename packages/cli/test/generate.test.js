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

test('creates a fallback review group for each generated chapter file', () => {
  const draft = {
    diff: {
      files: [
        file('src/auth/service.ts', 'hunk_source'),
        file('src/auth/service.test.ts', 'hunk_test'),
      ],
    },
  };

  const chapters = createFileBasedChapters(draft);
  const sourceFile = chapters.find((chapter) => chapter.id === 'chapter_source_changes').files[0];
  const testFile = chapters.find((chapter) => chapter.id === 'chapter_tests').files[0];

  expect(sourceFile.groups).toEqual([
    {
      hunkIds: ['hunk_source'],
      id: 'group_file_hunk_source',
      risk: 'high',
      summary: 'Review the related changes in `src/auth/service.ts` as one implementation unit.',
      title: 'Review service.ts',
    },
  ]);
  expect(testFile.groups).toEqual([
    {
      hunkIds: ['hunk_test'],
      id: 'group_file_hunk_test',
      risk: 'high',
      summary:
        'Review the related changes in `src/auth/service.test.ts` as one implementation unit.',
      title: 'Review service.test.ts',
    },
  ]);
});

test('omits files with no hunks from fallback chapters and review groups', () => {
  const draft = {
    diff: {
      files: [
        file('src/app.ts', 'hunk_source'),
        {
          id: 'file_binary',
          path: 'src/logo.png',
          status: 'modified',
          additions: 0,
          deletions: 0,
          hunks: [],
        },
      ],
    },
  };

  const chapters = createFileBasedChapters(draft);

  expect(chapters).toHaveLength(1);
  expect(chapters[0].files.map((chapterFile) => chapterFile.path)).toEqual(['src/app.ts']);
  expect(chapters[0].files.flatMap((chapterFile) => chapterFile.groups ?? [])).toEqual([
    {
      hunkIds: ['hunk_source'],
      id: 'group_file_hunk_source',
      risk: 'medium',
      summary: 'Review the related changes in `src/app.ts` as one implementation unit.',
      title: 'Review app.ts',
    },
  ]);
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
