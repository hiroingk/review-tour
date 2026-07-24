export type ReviewProgress = {
  chapterIds: ReadonlySet<string>;
  fileIds: ReadonlySet<string>;
  groupIds: ReadonlySet<string>;
  questionIds: ReadonlySet<string>;
};

type StoredReviewProgress = {
  chapters?: unknown;
  files?: unknown;
  groups?: unknown;
  questions?: unknown;
};

export function createEmptyReviewProgress(): ReviewProgress {
  return {
    chapterIds: new Set(),
    fileIds: new Set(),
    groupIds: new Set(),
    questionIds: new Set(),
  };
}

export function readReviewProgress(storageKey: string, legacyChapterStorageKey?: string) {
  if (typeof window === 'undefined') return createEmptyReviewProgress();

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return {
          chapterIds: toStringSet(parsed),
          fileIds: new Set<string>(),
          groupIds: new Set<string>(),
          questionIds: new Set<string>(),
        };
      }

      if (isRecord(parsed)) {
        const progress = parsed as StoredReviewProgress;
        return {
          chapterIds: toStringSet(progress.chapters),
          fileIds: toStringSet(progress.files),
          groupIds: toStringSet(progress.groups),
          questionIds: toStringSet(progress.questions),
        };
      }
    }

    if (legacyChapterStorageKey) {
      const legacy = window.localStorage.getItem(legacyChapterStorageKey);
      if (legacy) {
        const parsed: unknown = JSON.parse(legacy);
        return {
          chapterIds: toStringSet(parsed),
          fileIds: new Set<string>(),
          groupIds: new Set<string>(),
          questionIds: new Set<string>(),
        };
      }
    }
  } catch {
    return createEmptyReviewProgress();
  }

  return createEmptyReviewProgress();
}

export function writeReviewProgress(storageKey: string, progress: ReviewProgress) {
  if (typeof window === 'undefined') return;

  try {
    const value = {
      chapters: Array.from(progress.chapterIds),
      files: Array.from(progress.fileIds),
      groups: Array.from(progress.groupIds),
      questions: Array.from(progress.questionIds),
    };

    if (
      value.chapters.length === 0 &&
      value.files.length === 0 &&
      value.groups.length === 0 &&
      value.questions.length === 0
    ) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    }
  } catch {
    // Ignore storage failures; in-memory progress remains available for this session.
  }
}

export function toggleSetValue(values: ReadonlySet<string>, value: string) {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function getReviewGroupProgressId({
  chapterId,
  filePath,
  groupId,
  tourId,
}: {
  chapterId: string;
  filePath: string;
  groupId: string;
  tourId: string;
}) {
  return `group:${JSON.stringify([tourId, chapterId, filePath, groupId])}`;
}

function toStringSet(value: unknown) {
  return new Set(
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
