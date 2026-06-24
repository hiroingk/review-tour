import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vite-plus/test';
import { sanitizeViewerDist } from '../scripts/sanitize-dist.js';

test('removes local source roots from viewer dist assets', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'review-tour-sanitize-'));
  const sourceRoot = path.join(tempRoot, 'packages', 'viewer');
  const distDir = path.join(sourceRoot, 'dist');
  const manifestPath = path.join(distDir, 'server', 'assets', 'manifest.js');

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `var manifest = { filePath: "${normalize(sourceRoot)}/src/routes/__root.tsx" };\n`,
    'utf8',
  );

  const result = await sanitizeViewerDist({ distDir, sourceRoot });
  const sanitized = await readFile(manifestPath, 'utf8');

  expect(result.changedFiles).toBe(1);
  expect(sanitized).not.toContain(normalize(sourceRoot));
  expect(sanitized).toContain('src/routes/__root.tsx');
});

function normalize(filePath) {
  return path.resolve(filePath).split(path.sep).join('/');
}
