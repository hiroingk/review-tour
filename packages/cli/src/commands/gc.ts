import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { getDefaultReviewTourCacheDir } from '@review-tour/viewer';
import { getNumberOption, hasFlag, type ParsedArgs } from '../cliArgs.js';

type Candidate = {
  filePath: string;
  mtimeMs: number;
};

export async function gcCommand(args: ParsedArgs) {
  const days = getNumberOption(args, 'days');
  const keep = getNumberOption(args, 'keep');
  const cacheDir = getDefaultReviewTourCacheDir();
  const candidates = await listTourFiles(cacheDir);
  const toDelete = new Set<string>();

  if (days !== undefined) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    for (const candidate of candidates) {
      if (candidate.mtimeMs < cutoff) {
        toDelete.add(candidate.filePath);
      }
    }
  }

  if (keep !== undefined) {
    const byNewest = [...candidates].sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const candidate of byNewest.slice(Math.max(keep, 0))) {
      toDelete.add(candidate.filePath);
    }
  }

  for (const filePath of toDelete) {
    await rm(filePath, { force: true });
  }

  const output = {
    cacheDir,
    deleted: toDelete.size,
  };

  if (hasFlag(args, 'json')) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(`Deleted ${toDelete.size} tour artifacts from ${cacheDir}.\n`);
}

async function listTourFiles(cacheDir: string) {
  const reposDir = path.join(cacheDir, 'repos');
  const candidates: Candidate[] = [];
  let repos: string[];
  try {
    repos = await readdir(reposDir);
  } catch {
    return candidates;
  }

  for (const repoHash of repos) {
    const toursDir = path.join(reposDir, repoHash, 'tours');
    let entries: string[];
    try {
      entries = await readdir(toursDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.json') || entry === 'latest.json') {
        continue;
      }

      const filePath = path.join(toursDir, entry);
      const fileStat = await stat(filePath);
      candidates.push({ filePath, mtimeMs: fileStat.mtimeMs });
    }
  }

  return candidates;
}
