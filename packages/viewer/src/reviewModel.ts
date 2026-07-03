import type { DiffFile, DiffLine, ReviewChapter, ReviewTour } from '@review-tour/schema';

export type ChapterStats = {
  additions: number;
  deletions: number;
  files: number;
};

export type SplitLineRow = {
  kind: 'line';
  left: DiffLine | null;
  right: DiffLine | null;
};

export type SplitFoldRow = {
  kind: 'fold';
  count: number;
};

export type SplitRow = SplitLineRow | SplitFoldRow;

export type ExpandableSplitFoldRow = SplitFoldRow & {
  id: string;
  rows: SplitLineRow[];
};

export type ExpandableSplitRow = SplitLineRow | ExpandableSplitFoldRow;

export function getChapterDiffFiles(tour: ReviewTour, chapter: ReviewChapter): DiffFile[] {
  if (Array.isArray(chapter.files) && chapter.files.length > 0) {
    const filesByPath = new Map(tour.diff.files.map((file) => [file.path, file]));

    return chapter.files.flatMap((fileRef) => {
      const file = filesByPath.get(fileRef.path);
      if (!file) return [];

      const hunksById = new Map(file.hunks.map((hunk) => [hunk.id, hunk]));
      const hunks = fileRef.hunkIds
        .map((hunkId) => hunksById.get(hunkId))
        .filter((hunk): hunk is DiffFile['hunks'][number] => hunk !== undefined);

      return hunks.length > 0 ? [{ ...file, hunks }] : [];
    });
  }

  const hunkIdSet = new Set(chapter.hunkIds);
  return tour.diff.files
    .map((file) => ({
      ...file,
      hunks: file.hunks.filter((hunk) => hunkIdSet.has(hunk.id)),
    }))
    .filter((file) => file.hunks.length > 0);
}

export function getChapterStats(tour: ReviewTour, chapter: ReviewChapter): ChapterStats {
  const files = getChapterDiffFiles(tour, chapter);
  let additions = 0;
  let deletions = 0;
  for (const file of files) {
    const stats = getFileStats(file);
    additions += stats.additions;
    deletions += stats.deletions;
  }
  return { additions, deletions, files: files.length };
}

export function getFileStats(file: DiffFile) {
  let additions = 0;
  let deletions = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') additions += 1;
      if (line.type === 'delete') deletions += 1;
    }
  }
  return { additions, deletions };
}

export function buildSplitRows(lines: DiffLine[]): SplitLineRow[] {
  const rows: SplitLineRow[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (!line) {
      index += 1;
      continue;
    }

    if (line.type === 'context') {
      rows.push({ kind: 'line', left: line, right: line });
      index += 1;
      continue;
    }

    if (line.type === 'delete') {
      const deletes: DiffLine[] = [];
      while (lines[index]?.type === 'delete') {
        deletes.push(lines[index]);
        index += 1;
      }

      const adds: DiffLine[] = [];
      while (lines[index]?.type === 'add') {
        adds.push(lines[index]);
        index += 1;
      }

      const count = Math.max(deletes.length, adds.length);
      for (let item = 0; item < count; item += 1) {
        rows.push({
          kind: 'line',
          left: deletes[item] ?? null,
          right: adds[item] ?? null,
        });
      }
      continue;
    }

    const adds: DiffLine[] = [];
    while (lines[index]?.type === 'add') {
      adds.push(lines[index]);
      index += 1;
    }
    for (const add of adds) {
      rows.push({ kind: 'line', left: null, right: add });
    }
  }
  return rows;
}

export function compactContextRows(rows: SplitLineRow[]): SplitRow[] {
  return compactContextRowsWithExpansion(rows).map((row) =>
    row.kind === 'fold' ? { kind: 'fold', count: row.count } : row,
  );
}

export function compactContextRowsWithExpansion(
  rows: SplitLineRow[],
  idPrefix = 'context',
): ExpandableSplitRow[] {
  const output: ExpandableSplitRow[] = [];
  let foldIndex = 0;

  for (let index = 0; index < rows.length; ) {
    const run: SplitLineRow[] = [];
    while (
      rows[index]?.kind === 'line' &&
      rows[index].left?.type === 'context' &&
      rows[index].right?.type === 'context'
    ) {
      run.push(rows[index]);
      index += 1;
    }

    if (run.length > 12) {
      const hiddenRows = run.slice(4, -4);
      output.push(...run.slice(0, 4));
      output.push({
        kind: 'fold',
        id: `${idPrefix}:fold:${foldIndex}`,
        count: hiddenRows.length,
        rows: hiddenRows,
      });
      foldIndex += 1;
      output.push(...run.slice(-4));
    } else {
      output.push(...run);
    }

    if (rows[index]) {
      output.push(rows[index]);
      index += 1;
    }
  }
  return output;
}
