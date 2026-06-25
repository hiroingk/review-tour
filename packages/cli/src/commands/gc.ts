import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { getDefaultReviewTourCacheDir } from '@review-tour/viewer';
import { type ParsedArgs } from '../cliArgs.js';

export type Candidate = {
  filePath: string;
  mtimeMs: number;
};

export type GcOptions = {
  all: boolean;
  days?: number;
  keep?: number;
  json: boolean;
};

export type GcResult = {
  cacheDir: string;
  cleared: boolean;
  deleted: number;
};

export async function gcCommand(args: ParsedArgs) {
  const options = parseGcOptions(args);
  const cacheDir = getDefaultReviewTourCacheDir();
  const result = await runGc({ cacheDir, options });

  const output = {
    cacheDir: result.cacheDir,
    deleted: result.deleted,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  if (result.cleared) {
    process.stdout.write(
      `Cleared Review Tour cache at ${result.cacheDir}. Deleted ${result.deleted} cached files.\n`,
    );
    return;
  }

  process.stdout.write(`Deleted ${result.deleted} tour artifacts from ${result.cacheDir}.\n`);
}

export function parseGcOptions(args: ParsedArgs): GcOptions {
  if (args.positionals.length > 0) {
    throw new Error('review-tour gc does not accept positional arguments.');
  }

  const allowedOptions = new Set(['all', 'days', 'keep', 'json']);
  for (const name of args.options.keys()) {
    if (!allowedOptions.has(name)) {
      throw new Error(`Unknown option for review-tour gc: --${name}`);
    }
  }

  const all = readBooleanFlag(args, 'all');
  const json = readBooleanFlag(args, 'json');
  const hasDays = args.options.has('days');
  const hasKeep = args.options.has('keep');

  if (all && (hasDays || hasKeep)) {
    throw new Error('review-tour gc --all cannot be combined with --days or --keep.');
  }

  return {
    all,
    days: readNumberOption(args, 'days'),
    json,
    keep: readNumberOption(args, 'keep'),
  };
}

export async function runGc(input: {
  cacheDir: string;
  options: GcOptions;
  now?: number;
}): Promise<GcResult> {
  if (input.options.all) {
    const deleted = await countCacheFiles(input.cacheDir);
    await rm(input.cacheDir, { force: true, recursive: true });
    return {
      cacheDir: input.cacheDir,
      cleared: true,
      deleted,
    };
  }

  const candidates = await listTourFiles(input.cacheDir);
  const toDelete = selectTourFilesForGc(candidates, {
    days: input.options.days,
    keep: input.options.keep,
    now: input.now ?? Date.now(),
  });

  for (const filePath of toDelete) {
    await rm(filePath, { force: true });
  }

  return {
    cacheDir: input.cacheDir,
    cleared: false,
    deleted: toDelete.size,
  };
}

export function selectTourFilesForGc(
  candidates: Candidate[],
  options: { days?: number; keep?: number; now: number },
) {
  const toDelete = new Set<string>();

  if (options.days !== undefined) {
    const cutoff = options.now - options.days * 24 * 60 * 60 * 1000;
    for (const candidate of candidates) {
      if (candidate.mtimeMs < cutoff) {
        toDelete.add(candidate.filePath);
      }
    }
  }

  if (options.keep !== undefined) {
    const byNewest = [...candidates].sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const candidate of byNewest.slice(Math.max(options.keep, 0))) {
      toDelete.add(candidate.filePath);
    }
  }

  return toDelete;
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

async function countCacheFiles(cacheDir: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(cacheDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    const entryPath = path.join(cacheDir, entry.name);
    if (entry.isDirectory()) {
      count += await countCacheFiles(entryPath);
    } else {
      count += 1;
    }
  }

  return count;
}

function readBooleanFlag(args: ParsedArgs, name: string) {
  const value = args.options.get(name);
  if (value === undefined) {
    return false;
  }

  if (value !== true) {
    throw new Error(`--${name} does not accept a value`);
  }

  return true;
}

function readNumberOption(args: ParsedArgs, name: string): number | undefined {
  const value = args.options.get(name);
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`--${name} requires a value`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a number`);
  }
  return parsed;
}
