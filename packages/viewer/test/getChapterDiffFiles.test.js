import { expect, test } from 'vite-plus/test';
import {
  buildSplitRows,
  compactContextRowsWithExpansion,
  getChapterDiffFiles,
} from '../src/reviewModel.ts';

test('returns only diff hunks selected by the chapter', () => {
  const tour = {
    diff: {
      files: [
        {
          id: 'file_1',
          path: 'a.ts',
          status: 'modified',
          additions: 2,
          deletions: 0,
          hunks: [
            { id: 'hunk_a', lines: [] },
            { id: 'hunk_b', lines: [] },
          ],
        },
        {
          id: 'file_2',
          path: 'b.ts',
          status: 'modified',
          additions: 1,
          deletions: 0,
          hunks: [{ id: 'hunk_c', lines: [] }],
        },
      ],
    },
  };
  const chapter = {
    hunkIds: ['hunk_b'],
  };

  const files = getChapterDiffFiles(tour, chapter);

  expect(files).toHaveLength(1);
  expect(files[0].path).toBe('a.ts');
  expect(files[0].hunks.map((hunk) => hunk.id)).toEqual(['hunk_b']);
});

test('follows chapter file and hunk order when provided', () => {
  const tour = {
    diff: {
      files: [
        {
          id: 'file_test',
          path: 'service.test.ts',
          status: 'modified',
          additions: 1,
          deletions: 0,
          hunks: [{ id: 'hunk_test', lines: [] }],
        },
        {
          id: 'file_service',
          path: 'service.ts',
          status: 'modified',
          additions: 2,
          deletions: 0,
          hunks: [
            { id: 'hunk_late', lines: [] },
            { id: 'hunk_entry', lines: [] },
          ],
        },
      ],
    },
  };
  const chapter = {
    hunkIds: ['hunk_test', 'hunk_entry'],
    files: [
      { path: 'service.ts', hunkIds: ['hunk_entry', 'hunk_late'] },
      { path: 'service.test.ts', hunkIds: ['hunk_test'] },
    ],
  };

  const files = getChapterDiffFiles(tour, chapter);

  expect(files.map((file) => file.path)).toEqual(['service.ts', 'service.test.ts']);
  expect(files[0].hunks.map((hunk) => hunk.id)).toEqual(['hunk_entry', 'hunk_late']);
});

test('keeps folded context rows available for expansion', () => {
  const lines = Array.from({ length: 14 }, (_, index) => ({
    type: 'context',
    oldLine: index + 1,
    newLine: index + 1,
    content: `line ${index + 1}`,
  }));

  const rows = compactContextRowsWithExpansion(buildSplitRows(lines), 'hunk_a');
  const fold = rows.find((row) => row.kind === 'fold');

  expect(rows).toHaveLength(9);
  expect(fold).toBeDefined();
  expect(fold.id).toBe('hunk_a:fold:0');
  expect(fold.count).toBe(6);
  expect(fold.rows.map((row) => row.left?.content)).toEqual([
    'line 5',
    'line 6',
    'line 7',
    'line 8',
    'line 9',
    'line 10',
  ]);
});
