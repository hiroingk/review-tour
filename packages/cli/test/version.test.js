import { readFileSync } from 'node:fs';
import { expect, test } from 'vite-plus/test';
import { getCliVersion, getRequiredNodeRange } from '../src/version.ts';

const rootManifest = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
);

test('getCliVersion returns the root package version', () => {
  expect(getCliVersion()).toBe(rootManifest.version);
});

test('getRequiredNodeRange returns the root engines constraint', () => {
  expect(getRequiredNodeRange()).toBe(rootManifest.engines.node);
});
