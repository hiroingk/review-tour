import { expect, test } from 'vite-plus/test';
import {
  buildSymbolIndex,
  matchSymbolDefinition,
  splitSymbolSegments,
} from '../src/client/symbolIndex.ts';

function makeFile(overrides = {}) {
  return {
    id: 'file_1',
    path: 'src/example.ts',
    status: 'modified',
    language: 'typescript',
    additions: 0,
    deletions: 0,
    hunks: [],
    ...overrides,
  };
}

test('matches definitions across common languages', () => {
  expect(matchSymbolDefinition('export function buildRows(lines) {')).toBe('buildRows');
  expect(matchSymbolDefinition('  async function loadTour() {')).toBe('loadTour');
  expect(matchSymbolDefinition('export default class ReviewStore {')).toBe('ReviewStore');
  expect(matchSymbolDefinition('export type SymbolIndex = ReadonlyMap<string, string>;')).toBe(
    'SymbolIndex',
  );
  expect(matchSymbolDefinition('const syntaxTheme = resolveTheme();')).toBe('syntaxTheme');
  expect(matchSymbolDefinition('def build_index(files):')).toBe('build_index');
  expect(matchSymbolDefinition('pub async fn resolve_symbol(name: &str) {')).toBe('resolve_symbol');
  expect(matchSymbolDefinition('func (s *Server) HandleTour(w http.ResponseWriter) {')).toBe(
    'HandleTour',
  );
  expect(matchSymbolDefinition('override fun onCreate(savedInstanceState: Bundle?) {')).toBe(
    'onCreate',
  );
});

test('ignores non-definition lines and short names', () => {
  expect(matchSymbolDefinition('return buildRows(lines);')).toBeNull();
  expect(matchSymbolDefinition('const x = 1;')).toBeNull();
  expect(matchSymbolDefinition('')).toBeNull();
  expect(matchSymbolDefinition('// function commented(name) {')).toBeNull();
});

test('indexes new-side definitions and skips deleted lines', () => {
  const file = makeFile({
    hunks: [
      {
        id: 'hunk_1',
        fileId: 'file_1',
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
        header: '@@ -1,3 +1,3 @@',
        patchHash: 'hash',
        lines: [
          { type: 'add', newLine: 1, content: 'export function createTour() {' },
          { type: 'delete', oldLine: 1, content: 'export function legacyTour() {' },
          { type: 'context', oldLine: 2, newLine: 2, content: 'const shared = makeShared();' },
        ],
      },
    ],
  });

  const index = buildSymbolIndex([file]);

  expect(index.get('createTour')).toEqual([
    {
      content: 'export function createTour() {',
      fileId: 'file_1',
      filePath: 'src/example.ts',
      hunkId: 'hunk_1',
      lineNumber: 1,
    },
  ]);
  expect(index.has('legacyTour')).toBe(false);
  expect(index.get('shared')?.[0]?.lineNumber).toBe(2);
});

test('collects multiple definitions for the same name', () => {
  const makeHunk = (id, fileId, newLine) => ({
    id,
    fileId,
    oldStart: 1,
    oldLines: 1,
    newStart: newLine,
    newLines: 1,
    header: '@@',
    patchHash: 'hash',
    lines: [{ type: 'add', newLine, content: 'function setup() {' }],
  });

  const index = buildSymbolIndex([
    makeFile({ id: 'file_1', hunks: [makeHunk('hunk_1', 'file_1', 4)] }),
    makeFile({ id: 'file_2', path: 'src/other.ts', hunks: [makeHunk('hunk_2', 'file_2', 9)] }),
  ]);

  expect(index.get('setup')).toHaveLength(2);
});

test('splits text into symbol and plain segments', () => {
  const known = new Set(['buildRows', 'lines']);
  const segments = splitSymbolSegments('const rows = buildRows(lines);', (name) => known.has(name));

  expect(segments).toEqual([
    { symbol: false, text: 'const rows = ' },
    { symbol: true, text: 'buildRows' },
    { symbol: false, text: '(' },
    { symbol: true, text: 'lines' },
    { symbol: false, text: ');' },
  ]);
});

test('returns a single plain segment when nothing matches', () => {
  const segments = splitSymbolSegments('return value + 1;', () => false);
  expect(segments).toEqual([{ symbol: false, text: 'return value + 1;' }]);
});
