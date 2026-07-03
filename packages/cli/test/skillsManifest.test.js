import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vite-plus/test';
import { hashSkillDirectory, parseSkillsManifest } from '../src/skillsManifest.ts';

const manifestUrl = new URL('../../../skills-manifest.json', import.meta.url);
const manifest = parseSkillsManifest(readFileSync(manifestUrl, 'utf8'), 'skills-manifest.json');

// Guards two invariants at once: the manifest file is fresh, and the CLI hash
// implementation matches scripts/generate-skills-manifest.mjs.
test('bundled skill-data matches the generated manifest', async () => {
  const names = Object.keys(manifest.skills);
  expect(names).toContain('core');

  for (const [name, expected] of Object.entries(manifest.skills)) {
    const dir = fileURLToPath(new URL(`../../../skill-data/${name}`, import.meta.url));
    expect(await hashSkillDirectory(dir)).toEqual(expected);
  }
});

test('distribution stubs match the generated manifest', async () => {
  const names = Object.keys(manifest.stubs);
  expect(names).toContain('review-tour');

  for (const [name, expected] of Object.entries(manifest.stubs)) {
    const dir = fileURLToPath(new URL(`../../../skills/${name}`, import.meta.url));
    expect(await hashSkillDirectory(dir)).toEqual(expected);
  }
});

test('parseSkillsManifest rejects invalid JSON', () => {
  expect(() => parseSkillsManifest('not json', 'skills-manifest.json')).toThrow(/Invalid JSON/);
});
