import { expect, test } from 'vite-plus/test';
import {
  createEmptyReviewProgress,
  getReviewGroupProgressId,
  readReviewProgress,
  toggleSetValue,
  writeReviewProgress,
} from '../src/client/reviewProgress.ts';

test('creates review progress with an empty group set', () => {
  const progress = createEmptyReviewProgress();

  expect([...progress.chapterIds]).toEqual([]);
  expect([...progress.fileIds]).toEqual([]);
  expect([...progress.groupIds]).toEqual([]);
  expect([...progress.questionIds]).toEqual([]);
});

test('creates collision-safe group progress identifiers', () => {
  const first = getReviewGroupProgressId({
    chapterId: 'chapter:a',
    filePath: 'src/a:b.ts',
    groupId: 'group:c',
    tourId: 'tour:a',
  });
  const second = getReviewGroupProgressId({
    chapterId: 'chapter',
    filePath: 'a:src/a:b.ts',
    groupId: 'group:c',
    tourId: 'tour:a',
  });

  expect(first).not.toBe(second);
  expect(toggleSetValue(new Set(), first).has(first)).toBe(true);
});

test('isolates group progress between generated tours opened through latest', () => {
  const first = getReviewGroupProgressId({
    chapterId: 'chapter_a',
    filePath: 'src/a.ts',
    groupId: 'group_a',
    tourId: 'tour_first',
  });
  const second = getReviewGroupProgressId({
    chapterId: 'chapter_a',
    filePath: 'src/a.ts',
    groupId: 'group_a',
    tourId: 'tour_second',
  });

  expect(first).not.toBe(second);
});

test('writes and restores file and group review progress in the same browser payload', () => {
  const storage = createMemoryStorage();
  const restoreWindow = installWindow(storage);

  try {
    writeReviewProgress('progress-key', {
      chapterIds: new Set(['chapter_a']),
      fileIds: new Set(['file_a']),
      groupIds: new Set(['group_a']),
      questionIds: new Set(['question_a']),
    });

    expect(JSON.parse(storage.getItem('progress-key'))).toEqual({
      chapters: ['chapter_a'],
      files: ['file_a'],
      groups: ['group_a'],
      questions: ['question_a'],
    });
    expect(readReviewProgress('progress-key')).toEqual({
      chapterIds: new Set(['chapter_a']),
      fileIds: new Set(['file_a']),
      groupIds: new Set(['group_a']),
      questionIds: new Set(['question_a']),
    });
  } finally {
    restoreWindow();
  }
});

test('reads older progress payloads with no group state', () => {
  const storage = createMemoryStorage();
  storage.setItem(
    'progress-key',
    JSON.stringify({
      chapters: ['chapter_a'],
      files: ['file_a'],
      questions: ['question_a'],
    }),
  );
  const restoreWindow = installWindow(storage);

  try {
    const progress = readReviewProgress('progress-key');
    expect([...progress.groupIds]).toEqual([]);
    expect([...progress.chapterIds]).toEqual(['chapter_a']);
  } finally {
    restoreWindow();
  }
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function installWindow(localStorage) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  };
}
