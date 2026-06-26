import { expect, test } from 'vite-plus/test';
import { getCollapsedFileScrollTop } from '../src/client/collapseScroll.ts';

test('keeps scroll position when the file top is already visible', () => {
  expect(
    getCollapsedFileScrollTop({
      currentScrollTop: 120,
      fileTop: 24,
      rootTop: 0,
    }),
  ).toBeNull();
});

test('moves scroll up to the collapsed file header when collapsed inside a scrolled file', () => {
  expect(
    getCollapsedFileScrollTop({
      currentScrollTop: 900,
      fileTop: -420,
      rootTop: 80,
    }),
  ).toBe(400);
});

test('clamps collapsed file scroll position at the top', () => {
  expect(
    getCollapsedFileScrollTop({
      currentScrollTop: 120,
      fileTop: -260,
      rootTop: 0,
    }),
  ).toBe(0);
});
