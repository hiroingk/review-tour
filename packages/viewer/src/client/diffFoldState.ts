export type DiffFoldState = {
  collapsedFileIds: ReadonlySet<string>;
  expandedFoldIds: ReadonlySet<string>;
};

type StoredDiffFoldState = {
  collapsedFiles?: unknown;
  expandedFolds?: unknown;
};

export function createEmptyDiffFoldState(): DiffFoldState {
  return {
    collapsedFileIds: new Set(),
    expandedFoldIds: new Set(),
  };
}

export function readDiffFoldState(storageKey: string) {
  if (typeof window === 'undefined') return createEmptyDiffFoldState();

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return createEmptyDiffFoldState();

    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return createEmptyDiffFoldState();

    const state = parsed as StoredDiffFoldState;
    return {
      collapsedFileIds: toStringSet(state.collapsedFiles),
      expandedFoldIds: toStringSet(state.expandedFolds),
    };
  } catch {
    return createEmptyDiffFoldState();
  }
}

export function writeDiffFoldState(storageKey: string, state: DiffFoldState) {
  if (typeof window === 'undefined') return;

  try {
    const value = {
      collapsedFiles: Array.from(state.collapsedFileIds),
      expandedFolds: Array.from(state.expandedFoldIds),
    };

    if (value.collapsedFiles.length === 0 && value.expandedFolds.length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    }
  } catch {
    // Ignore storage failures; in-memory fold state remains available for this session.
  }
}

export function setStringSetValue(values: ReadonlySet<string>, value: string, enabled: boolean) {
  const next = new Set(values);
  if (enabled) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}

export function addStringSetValues(values: ReadonlySet<string>, nextValues: readonly string[]) {
  const next = new Set(values);
  for (const value of nextValues) {
    next.add(value);
  }
  return next;
}

function toStringSet(value: unknown) {
  return new Set(
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
