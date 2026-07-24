import { expect, test } from 'vite-plus/test';
import {
  formatReviewCommentsForCodex,
  getReviewCommentLineLabel,
} from '../src/client/reviewComments.ts';

test('formats review comments as a Codex-ready prompt', () => {
  const comment = {
    id: 'comment_1',
    body: 'Please extract this into a helper before adding another dialect.',
    createdAt: '2026-06-24T00:00:00.000Z',
    updatedAt: '2026-06-24T00:00:00.000Z',
    range: {
      fileId: 'file_1',
      filePath: 'src/dialect.ts',
      hunkId: 'hunk_1',
      side: 'right',
      start: {
        content: 'const sql = buildUpdateSet(table);',
        fileId: 'file_1',
        filePath: 'src/dialect.ts',
        hunkId: 'hunk_1',
        lineNumber: 42,
        newLine: 42,
        oldLine: 40,
        position: 3,
        side: 'right',
        type: 'add',
      },
      end: {
        content: 'return sql;',
        fileId: 'file_1',
        filePath: 'src/dialect.ts',
        hunkId: 'hunk_1',
        lineNumber: 43,
        newLine: 43,
        oldLine: 41,
        position: 4,
        side: 'right',
        type: 'add',
      },
      lines: [
        {
          content: 'const sql = buildUpdateSet(table);',
          fileId: 'file_1',
          filePath: 'src/dialect.ts',
          hunkId: 'hunk_1',
          lineNumber: 42,
          newLine: 42,
          oldLine: 40,
          position: 3,
          side: 'right',
          type: 'add',
        },
        {
          content: 'return sql;',
          fileId: 'file_1',
          filePath: 'src/dialect.ts',
          hunkId: 'hunk_1',
          lineNumber: 43,
          newLine: 43,
          oldLine: 41,
          position: 4,
          side: 'right',
          type: 'add',
        },
      ],
    },
  };

  const prompt = formatReviewCommentsForCodex([comment]);

  expect(getReviewCommentLineLabel(comment.range)).toBe('L42-L43');
  expect(prompt).toContain('Please address the following review comments');
  expect(prompt).toContain('## 1. src/dialect.ts:L42-L43 (new)');
  expect(prompt).toContain('Please extract this into a helper');
  expect(prompt).toContain('+const sql = buildUpdateSet(table);');
  expect(prompt).toContain('+return sql;');

  const japanesePrompt = formatReviewCommentsForCodex([comment], 'ja');
  expect(japanesePrompt).toContain('以下のレビューコメントに対応してください');
  expect(japanesePrompt).toContain('コメント:');
  expect(japanesePrompt).toContain('選択されたコード:');
});
