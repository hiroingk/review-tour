import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReviewTour } from '@review-tour/schema';
import { assertReviewTour } from '@review-tour/schema';
import { getDefaultReviewTourCacheDir } from '@review-tour/viewer';

export type ArtifactWriteResult = {
  repoHash: string;
  tourId: string;
  artifactPath: string;
  latestPath: string;
  metadataPath: string;
};

export function createRepoHash(repoRoot: string) {
  return createHash('sha256').update(repoRoot).digest('hex').slice(0, 12);
}

export function getArtifactPaths(input: { cacheDir?: string; repoRoot: string; tourId: string }) {
  const cacheDir = input.cacheDir ?? getDefaultReviewTourCacheDir();
  const repoHash = createRepoHash(input.repoRoot);
  const repoDir = path.join(cacheDir, 'repos', repoHash);
  const toursDir = path.join(repoDir, 'tours');

  return {
    repoHash,
    repoDir,
    toursDir,
    artifactPath: path.join(toursDir, `${input.tourId}.json`),
    latestPath: path.join(toursDir, 'latest.json'),
    metadataPath: path.join(repoDir, 'metadata.json'),
  };
}

export async function writeArtifact(
  tour: ReviewTour,
  options: { cacheDir?: string } = {},
): Promise<ArtifactWriteResult> {
  assertReviewTour(tour);

  const paths = getArtifactPaths({
    cacheDir: options.cacheDir,
    repoRoot: tour.repository.root,
    tourId: tour.id,
  });
  await mkdir(paths.toursDir, { recursive: true });

  const serialized = `${JSON.stringify(tour, null, 2)}\n`;
  await writeFile(paths.artifactPath, serialized, 'utf8');
  await writeFile(paths.latestPath, serialized, 'utf8');
  await writeFile(
    paths.metadataPath,
    `${JSON.stringify(
      {
        repoHash: paths.repoHash,
        root: tour.repository.root,
        name: tour.repository.name,
        latestTourId: tour.id,
        updatedAt: tour.createdAt,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return {
    repoHash: paths.repoHash,
    tourId: tour.id,
    artifactPath: paths.artifactPath,
    latestPath: paths.latestPath,
    metadataPath: paths.metadataPath,
  };
}
