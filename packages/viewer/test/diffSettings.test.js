import { expect, test } from 'vite-plus/test';
import { resolveDiffLayout } from '../src/client/diffSettings.ts';

test('uses unified layout in a narrow viewport without changing a split preference', () => {
  expect(resolveDiffLayout('split', true)).toBe('unified');
});

test('keeps the preferred layout when the viewport is wide', () => {
  expect(resolveDiffLayout('split', false)).toBe('split');
  expect(resolveDiffLayout('unified', false)).toBe('unified');
});

test('keeps unified layout in a narrow viewport', () => {
  expect(resolveDiffLayout('unified', true)).toBe('unified');
});
