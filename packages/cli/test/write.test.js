import { expect, test } from 'vite-plus/test';
import { normalizeAndRepairChapters, repairWarnings } from '../src/commands/write.ts';

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

function createHunk(id, fileId = 'file_service') {
  return {
    id,
    fileId,
    header: '@@ -1 +1 @@',
    lines: [{ content: id, newLine: 1, oldLine: 1, type: 'context' }],
    newLines: 1,
    newStart: 1,
    oldLines: 1,
    oldStart: 1,
    patchHash: `hash_${id}`,
  };
}

function createGroupedDraft(hunkIds = ['hunk_one', 'hunk_two', 'hunk_three']) {
  return {
    diff: {
      files: [
        {
          additions: 1,
          deletions: 0,
          hunks: hunkIds.map((hunkId) => createHunk(hunkId)),
          id: 'file_service',
          path: 'src/service.ts',
          status: 'modified',
        },
      ],
    },
  };
}

function createGroupedChapter(groups, hunkIds = ['hunk_one', 'hunk_two', 'hunk_three']) {
  return {
    files: [{ groups, hunkIds, path: 'src/service.ts' }],
    hunkIds,
    id: 'chapter_service',
    index: 1,
    rationale: 'Review the service flow.',
    reviewQuestions: ['Is the service flow safe?'],
    risk: 'medium',
    summary: 'Review the service flow.',
    title: 'Service flow',
  };
}

function reviewGroup(id, hunkIds, overrides = {}) {
  return {
    hunkIds,
    id,
    risk: 'medium',
    summary: `Summary for ${id}.`,
    title: id,
    ...overrides,
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

test('preserves review group metadata and orders groups and hunks by the chapter hunk order', () => {
  const groups = [
    reviewGroup('group_late', ['hunk_three'], {
      risk: 'low',
      summary: 'Review the final response.',
      title: 'Return the response',
    }),
    reviewGroup('group_early', ['hunk_two', 'hunk_one'], {
      risk: 'high',
      summary: 'Validate and normalize the input.',
      title: 'Validate input',
    }),
  ];

  const [chapter] = normalizeAndRepairChapters(createGroupedDraft(), [
    createGroupedChapter(groups),
  ]);

  expect(chapter.files[0].groups).toEqual([
    {
      hunkIds: ['hunk_one', 'hunk_two'],
      id: 'group_early',
      risk: 'high',
      summary: 'Validate and normalize the input.',
      title: 'Validate input',
    },
    {
      hunkIds: ['hunk_three'],
      id: 'group_late',
      risk: 'low',
      summary: 'Review the final response.',
      title: 'Return the response',
    },
  ]);
});

test('adds an Additional changes group for contiguous hunks omitted from authored groups', () => {
  const [chapter] = normalizeAndRepairChapters(createGroupedDraft(), [
    createGroupedChapter([reviewGroup('group_authored', ['hunk_one'])]),
  ]);

  expect(chapter.files[0].groups).toEqual([
    reviewGroup('group_authored', ['hunk_one']),
    {
      hunkIds: ['hunk_two', 'hunk_three'],
      id: 'group_fallback_hunk_two',
      risk: 'medium',
      summary: 'Review these related changes in `src/service.ts` as one implementation unit.',
      title: 'Additional changes',
    },
  ]);
});

test('adds per-file review groups to a synthesized fallback chapter', () => {
  const chapters = normalizeAndRepairChapters(createGroupedDraft(['hunk_one', 'hunk_two']), [
    createGroupedChapter([reviewGroup('group_authored', ['hunk_one'])], ['hunk_one']),
  ]);
  const fallbackChapter = chapters.find((chapter) => chapter.id === 'chapter_uncovered_hunks');

  expect(fallbackChapter.files[0].groups).toEqual([
    {
      hunkIds: ['hunk_two'],
      id: 'group_fallback_hunk_two',
      risk: 'medium',
      summary: 'Review these related changes in `src/service.ts` as one implementation unit.',
      title: 'Review service.ts',
    },
  ]);
});

test('rejects review groups attached to a file with no chapter hunks', () => {
  const chapter = createGroupedChapter([reviewGroup('group_wrong_file', ['hunk_one'])]);
  chapter.files = [
    {
      groups: [reviewGroup('group_wrong_file', ['hunk_one'])],
      hunkIds: ['hunk_one'],
      path: 'src/other.ts',
    },
  ];

  expect(() => normalizeAndRepairChapters(createGroupedDraft(), [chapter])).toThrow(
    'Review groups reference file "src/other.ts" with no hunks in the chapter.',
  );
});

test('rejects unknown hunk IDs in a review group', () => {
  expect(() =>
    normalizeAndRepairChapters(createGroupedDraft(), [
      createGroupedChapter([reviewGroup('group_unknown', ['hunk_missing'])]),
    ]),
  ).toThrow(
    'Unknown hunk IDs in review group "group_unknown" for file "src/service.ts": hunk_missing',
  );
});

test('rejects duplicate review group IDs within a file', () => {
  expect(() =>
    normalizeAndRepairChapters(createGroupedDraft(), [
      createGroupedChapter([
        reviewGroup('group_duplicate', ['hunk_one']),
        reviewGroup('group_duplicate', ['hunk_two']),
      ]),
    ]),
  ).toThrow('Duplicate review group ID "group_duplicate" in file "src/service.ts".');
});

test('rejects duplicate hunk IDs within one review group', () => {
  expect(() =>
    normalizeAndRepairChapters(createGroupedDraft(), [
      createGroupedChapter([reviewGroup('group_duplicate_hunk', ['hunk_one', 'hunk_one'])]),
    ]),
  ).toThrow(
    'Duplicate hunk IDs in review group "group_duplicate_hunk" for file "src/service.ts": hunk_one',
  );
});

test('rejects hunks assigned to multiple review groups within a file', () => {
  expect(() =>
    normalizeAndRepairChapters(createGroupedDraft(), [
      createGroupedChapter([
        reviewGroup('group_one', ['hunk_one']),
        reviewGroup('group_two', ['hunk_one']),
      ]),
    ]),
  ).toThrow('Hunk IDs assigned to multiple review groups in file "src/service.ts": hunk_one');
});

test('rejects a review group whose hunks are not contiguous', () => {
  expect(() =>
    normalizeAndRepairChapters(createGroupedDraft(), [
      createGroupedChapter([reviewGroup('group_split', ['hunk_one', 'hunk_three'])]),
    ]),
  ).toThrow('Review group "group_split" in file "src/service.ts" must reference contiguous hunks.');
});
