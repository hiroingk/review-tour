import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vite-plus/test';
import { parseGcOptions, runGc } from '../src/commands/gc.ts';

test('rejects clearing the entire cache with retention options', () => {
  expect(() =>
    parseGcOptions({
      command: 'gc',
      options: new Map([
        ['all', true],
        ['days', '30'],
      ]),
      positionals: [],
    }),
  ).toThrow('review-tour gc --all cannot be combined with --days or --keep.');
});

test('clears the entire Review Tour cache with --all', async () => {
  const { cacheDir } = createCacheFixture();

  const result = await runGc({
    cacheDir,
    options: { all: true, json: false },
  });

  expect(result).toEqual({
    cacheDir,
    cleared: true,
    deleted: 3,
  });
  expect(existsSync(cacheDir)).toBe(false);
});

test('removes old tour artifacts without deleting latest or metadata', async () => {
  const { cacheDir, latestPath, metadataPath, oldTourPath } = createCacheFixture();
  const oldDate = new Date('2026-01-01T00:00:00.000Z');
  utimesSync(oldTourPath, oldDate, oldDate);

  const result = await runGc({
    cacheDir,
    now: new Date('2026-01-03T00:00:00.000Z').getTime(),
    options: { all: false, days: 1, json: false },
  });

  expect(result.deleted).toBe(1);
  expect(existsSync(oldTourPath)).toBe(false);
  expect(existsSync(latestPath)).toBe(true);
  expect(existsSync(metadataPath)).toBe(true);
});

function createCacheFixture() {
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'review-tour-gc-'));
  const repoDir = path.join(cacheDir, 'repos', 'aaaaaaaaaaaa');
  const toursDir = path.join(repoDir, 'tours');
  const oldTourPath = path.join(toursDir, 'old-tour.json');
  const latestPath = path.join(toursDir, 'latest.json');
  const metadataPath = path.join(repoDir, 'metadata.json');
  mkdirSync(toursDir, { recursive: true });
  writeFileSync(oldTourPath, '{}\n');
  writeFileSync(latestPath, '{}\n');
  writeFileSync(metadataPath, '{}\n');

  return {
    cacheDir,
    latestPath,
    metadataPath,
    oldTourPath,
  };
}
