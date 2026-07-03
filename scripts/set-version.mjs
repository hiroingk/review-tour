#!/usr/bin/env node
// Sets the same version on the root package and every workspace package
// (fixed versioning), then prints the release commands to run next.
// Usage: pnpm run set-version 0.2.0 | 0.2.0-alpha.1 | 0.2.0-beta.1 | 0.2.0-rc.1
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPattern = /^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$/;

const version = process.argv[2];
if (!version || !versionPattern.test(version)) {
  process.stderr.write(
    'Usage: pnpm run set-version <version>\n' +
      'Accepted formats: 1.2.3, 1.2.3-alpha.1, 1.2.3-beta.1, 1.2.3-rc.1\n',
  );
  process.exit(1);
}

const manifestPaths = [
  'package.json',
  'packages/cli/package.json',
  'packages/schema/package.json',
  'packages/viewer/package.json',
];

for (const manifestPath of manifestPaths) {
  const absolutePath = path.join(repoRoot, manifestPath);
  const manifest = JSON.parse(await readFile(absolutePath, 'utf8'));
  manifest.version = version;
  await writeFile(absolutePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${manifestPath}: version set to ${version}\n`);
}

const prerelease = version.includes('-');
const distTag = prerelease ? version.split('-')[1].split('.')[0] : 'latest';

process.stdout.write(
  '\nNext steps:\n' +
    `  git commit -am "Release v${version}"\n` +
    `  git tag v${version}\n` +
    `  git push origin main v${version}\n\n` +
    `Pushing the tag triggers .github/workflows/publish.yml (npm dist-tag: ${distTag}).\n`,
);
