import { expect, test } from 'vite-plus/test';
import { getRouter } from '../src/router.tsx';

test('resets the review panes when a navigation renders', () => {
  const router = getRouter();

  expect(router.options.scrollToTopSelectors).toEqual([
    '[data-left-pane-scroll]',
    '[data-diff-scroll-root]',
  ]);
});
