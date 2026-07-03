import { expect, test } from 'vite-plus/test';
import { getReadableMarkdownBlocks, parseInlineMarkdown } from '../src/client/MarkdownText.tsx';

test('parses lightweight inline markdown for review descriptions', () => {
  expect(
    parseInlineMarkdown(
      'Call `review-tour write` after **collect**. See [docs](https://example.com).',
    ),
  ).toEqual([
    { kind: 'text', text: 'Call ' },
    { kind: 'code', text: 'review-tour write' },
    { kind: 'text', text: ' after ' },
    { kind: 'strong', text: 'collect' },
    { kind: 'text', text: '. See ' },
    { kind: 'link', text: 'docs', href: 'https://example.com' },
    { kind: 'text', text: '.' },
  ]);
});

test('keeps unmatched markdown markers as text', () => {
  expect(parseInlineMarkdown('Keep `unfinished and **open')).toEqual([
    { kind: 'text', text: 'Keep `unfinished and **open' },
  ]);
});

test('parses markdown list blocks in descriptions', () => {
  expect(getReadableMarkdownBlocks('- Review `collect`\n- Verify **write**')).toEqual([
    {
      kind: 'unordered-list',
      items: ['Review `collect`', 'Verify **write**'],
    },
  ]);
});
