import { expect, test } from 'vite-plus/test';
import { parseUnifiedDiff } from '../src/diff/parseUnifiedDiff.ts';

test('parses unified diff files, hunks, and deterministic hunk ids', () => {
  const diff = [
    'diff --git a/src/example.ts b/src/example.ts',
    'index 1111111..2222222 100644',
    '--- a/src/example.ts',
    '+++ b/src/example.ts',
    '@@ -1,2 +1,3 @@',
    ' const one = 1;',
    '+const two = 2;',
    ' const three = 3;',
    '',
  ].join('\n');

  const result = parseUnifiedDiff(diff);

  expect(result.warnings).toHaveLength(0);
  expect(result.files).toHaveLength(1);
  expect(result.files[0].path).toBe('src/example.ts');
  expect(result.files[0].language).toBe('typescript');
  expect(result.files[0].additions).toBe(1);
  expect(result.files[0].deletions).toBe(0);
  expect(result.files[0].hunks).toHaveLength(1);
  expect(result.files[0].hunks[0].id).toMatch(/^hunk_[a-f0-9]{16}$/);
  expect(result.files[0].hunks[0].lines.map((line) => line.type)).toEqual([
    'context',
    'add',
    'context',
  ]);
});

test('preserves blank diff lines as empty content', () => {
  const diff = [
    'diff --git a/src/example.ts b/src/example.ts',
    'index 1111111..2222222 100644',
    '--- a/src/example.ts',
    '+++ b/src/example.ts',
    '@@ -1,3 +1,4 @@',
    ' const one = 1;',
    ' ',
    '+',
    ' const three = 3;',
    '',
  ].join('\n');

  const result = parseUnifiedDiff(diff);
  const hunkLines = result.files[0].hunks[0].lines;

  expect(hunkLines[1].type).toBe('context');
  expect(hunkLines[1].content).toBe('');
  expect(hunkLines[2].type).toBe('add');
  expect(hunkLines[2].content).toBe('');
});
