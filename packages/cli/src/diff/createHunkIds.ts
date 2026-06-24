import { createHash } from 'node:crypto';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function createHunkId(input: {
  path: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  patch: string;
}) {
  return `hunk_${sha256(
    [
      input.path,
      input.oldStart,
      input.oldLines,
      input.newStart,
      input.newLines,
      sha256(input.patch).slice(0, 16),
    ].join(':'),
  ).slice(0, 16)}`;
}
