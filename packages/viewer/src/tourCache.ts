import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { assertReviewTour, type ReviewTour } from '@review-tour/schema';

export const repoHashPattern = /^[a-f0-9]{12}$/;
export const tourIdPattern = /^[a-zA-Z0-9._-]+$/;

export type ViewerOptions = {
  cacheDir?: string;
};

export type ReadTourOptions = ViewerOptions & {
  repoHash: string;
  tourId: string;
};

export type ListedTour = {
  branchName?: string;
  repoHash: string;
  tourId: string;
  repositoryName?: string;
  createdAt?: string;
};

export function getDefaultReviewTourCacheDir() {
  if (process.env.REVIEW_TOUR_CACHE_DIR) {
    return process.env.REVIEW_TOUR_CACHE_DIR;
  }

  if (process.platform === 'darwin') {
    return path.join(homedir(), 'Library', 'Caches', 'review-tour');
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? homedir();
    return path.join(localAppData, 'review-tour');
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache');
  return path.join(xdgCacheHome, 'review-tour');
}

export async function readTourFromCache(options: ReadTourOptions) {
  const repoHash = assertRepoHash(options.repoHash);
  const tourId = assertTourId(options.tourId);
  const cacheDir = options.cacheDir ?? getDefaultReviewTourCacheDir();
  const filePath = resolveTourPath(cacheDir, repoHash, tourId);
  const raw = await readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  assertReviewTour(parsed);
  return parsed;
}

export async function listTours(options: ViewerOptions = {}) {
  const cacheDir = options.cacheDir ?? getDefaultReviewTourCacheDir();
  const reposDir = path.join(cacheDir, 'repos');
  const latestByRepoBranch = new Map<string, ListedTour>();

  let repoEntries: string[];
  try {
    repoEntries = await readdir(reposDir);
  } catch {
    return [];
  }

  for (const repoHash of repoEntries) {
    if (!repoHashPattern.test(repoHash)) {
      continue;
    }

    const repoToursDir = path.join(reposDir, repoHash, 'tours');
    let tourEntries: string[];
    try {
      tourEntries = await readdir(repoToursDir);
    } catch {
      continue;
    }

    for (const entry of tourEntries) {
      if (!entry.endsWith('.json')) {
        continue;
      }

      const tourId = entry.slice(0, -'.json'.length);
      if (tourId === 'latest' || !tourIdPattern.test(tourId)) {
        continue;
      }

      try {
        const tour = await readTourFromCache({ cacheDir, repoHash, tourId });
        const listed: ListedTour = {
          branchName: tour.repository.currentBranch,
          createdAt: tour.createdAt,
          repoHash,
          repositoryName: tour.repository.name,
          tourId,
        };
        const key = `${repoHash}:${tour.repository.currentBranch}`;
        const current = latestByRepoBranch.get(key);
        if (!current || (listed.createdAt ?? '').localeCompare(current.createdAt ?? '') > 0) {
          latestByRepoBranch.set(key, listed);
        }
      } catch {
        // Invalid artifacts are intentionally skipped from the index.
      }
    }
  }

  return Array.from(latestByRepoBranch.values()).sort((a, b) => {
    const repoCompare = (a.repositoryName ?? a.repoHash).localeCompare(
      b.repositoryName ?? b.repoHash,
    );
    if (repoCompare !== 0) return repoCompare;

    const branchCompare = (a.branchName ?? '').localeCompare(b.branchName ?? '');
    if (branchCompare !== 0) return branchCompare;

    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

function resolveTourPath(cacheDir: string, repoHash: string, tourId: string) {
  const fileName = `${tourId}.json`;
  const resolvedCacheDir = path.resolve(cacheDir);
  const tourPath = path.resolve(resolvedCacheDir, 'repos', repoHash, 'tours', fileName);

  const relative = path.relative(resolvedCacheDir, tourPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid cache path');
  }

  return tourPath;
}

function assertRepoHash(repoHash: string) {
  if (!repoHashPattern.test(repoHash)) {
    throw new Error('Invalid repo hash');
  }
  return repoHash;
}

function assertTourId(tourId: string) {
  if (!tourIdPattern.test(tourId)) {
    throw new Error('Invalid tour id');
  }
  return tourId;
}

export function getSafeErrorMessage(error: unknown) {
  if (error instanceof SyntaxError) {
    return 'Artifact JSON is invalid.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected viewer error.';
}

export type { ReviewTour };
