import { expect, test } from 'vite-plus/test';
import { resetScrollPosition } from '../src/client/scrollPosition.ts';

test('resets both scroll axes immediately', () => {
  const target = { scrollLeft: 48, scrollTop: 960 };

  resetScrollPosition(target);

  expect(target).toEqual({ scrollLeft: 0, scrollTop: 0 });
});

test('ignores a missing scroll target', () => {
  expect(() => resetScrollPosition(null)).not.toThrow();
});
