import { expect, test } from 'vite-plus/test';
import { translate } from '../src/client/i18n.tsx';

test('translates viewer messages into Japanese', () => {
  expect(translate('ja', 'Display settings')).toBe('表示設定');
  expect(
    translate('ja', '{additions} additions, {deletions} deletions', {
      additions: 12,
      deletions: 3,
    }),
  ).toBe('追加 12、削除 3');
});

test('uses the English key as the English message', () => {
  expect(translate('en', 'Chapter {index} of {total}', { index: 2, total: 4 })).toBe(
    'Chapter 2 of 4',
  );
});
