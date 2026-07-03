import type { ReactNode } from 'react';

type MarkdownSegment =
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'text'; text: string };

type MarkdownBlock =
  | { kind: 'ordered-list'; items: string[] }
  | { kind: 'paragraph'; text: string }
  | { kind: 'unordered-list'; items: string[] };

export function MarkdownText({ className, text }: { className: string; text: string }) {
  const blocks = getReadableMarkdownBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`${className} text-pretty`}>
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </div>
  );
}

export function MarkdownInlineText({ text }: { text: string }) {
  return <>{renderInlineMarkdown(text)}</>;
}

export function parseInlineMarkdown(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let index = 0;

  while (index < text.length) {
    const next = findNextInlineMarker(text, index);
    if (!next) {
      pushTextSegment(segments, text.slice(index));
      break;
    }

    pushTextSegment(segments, text.slice(index, next.index));

    if (next.marker === '`') {
      const end = text.indexOf('`', next.index + 1);
      if (end === -1) {
        pushTextSegment(segments, text.slice(next.index));
        break;
      }

      segments.push({ kind: 'code', text: text.slice(next.index + 1, end) });
      index = end + 1;
      continue;
    }

    if (next.marker === '**') {
      const end = text.indexOf('**', next.index + 2);
      if (end === -1) {
        pushTextSegment(segments, text.slice(next.index));
        break;
      }

      const value = text.slice(next.index + 2, end);
      if (value.trim().length === 0) {
        pushTextSegment(segments, text.slice(next.index, end + 2));
      } else {
        segments.push({ kind: 'strong', text: value });
      }
      index = end + 2;
      continue;
    }

    const link = parseLink(text, next.index);
    if (!link) {
      pushTextSegment(segments, text[next.index]);
      index = next.index + 1;
      continue;
    }

    segments.push(link.segment);
    index = link.end;
  }

  return segments;
}

export function getReadableMarkdownBlocks(text: string): MarkdownBlock[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const paragraphs =
    normalized.includes('\n') || normalized.length <= 180
      ? normalized
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      : getReadableParagraphs(normalized);

  return paragraphs.flatMap(parseMarkdownParagraph);
}

function parseMarkdownParagraph(paragraph: string): MarkdownBlock[] {
  const lines = paragraph
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    return [
      {
        kind: 'unordered-list',
        items: lines.map((line) => line.replace(/^[-*]\s+/, '')),
      },
    ];
  }

  if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
    return [
      {
        kind: 'ordered-list',
        items: lines.map((line) => line.replace(/^\d+[.)]\s+/, '')),
      },
    ];
  }

  return [{ kind: 'paragraph', text: paragraph }];
}

function renderMarkdownBlock(block: MarkdownBlock, index: number) {
  if (block.kind === 'paragraph') {
    return (
      <p className="whitespace-pre-line" key={`${index}:${block.text.slice(0, 24)}`}>
        {renderInlineMarkdown(block.text)}
      </p>
    );
  }

  const ListTag = block.kind === 'ordered-list' ? 'ol' : 'ul';
  const listClass =
    block.kind === 'ordered-list'
      ? 'ml-4 grid list-decimal gap-1 pl-1'
      : 'ml-4 grid list-disc gap-1 pl-1';

  return (
    <ListTag className={listClass} key={`${index}:${block.items.join('\n').slice(0, 24)}`}>
      {block.items.map((item, itemIndex) => (
        <li className="pl-1" key={`${itemIndex}:${item.slice(0, 24)}`}>
          {renderInlineMarkdown(item)}
        </li>
      ))}
    </ListTag>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return parseInlineMarkdown(text).map((segment, index) => {
    if (segment.kind === 'code') {
      return (
        <code
          className="rounded-[4px] bg-control px-1 py-[1px] font-mono text-[0.92em] text-code shadow-control"
          key={index}
        >
          {segment.text}
        </code>
      );
    }

    if (segment.kind === 'strong') {
      return (
        <strong className="font-semibold text-fg" key={index}>
          {renderInlineMarkdown(segment.text)}
        </strong>
      );
    }

    if (segment.kind === 'link') {
      return (
        <a
          className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          href={segment.href}
          key={index}
          rel={isExternalLink(segment.href) ? 'noreferrer' : undefined}
          target={isExternalLink(segment.href) ? '_blank' : undefined}
        >
          {renderInlineMarkdown(segment.text)}
        </a>
      );
    }

    return segment.text;
  });
}

function findNextInlineMarker(text: string, start: number) {
  const candidates = [
    { index: text.indexOf('`', start), marker: '`' },
    { index: text.indexOf('**', start), marker: '**' },
    { index: text.indexOf('[', start), marker: '[' },
  ].filter((candidate) => candidate.index >= 0);

  return candidates.sort((a, b) => a.index - b.index)[0];
}

function parseLink(text: string, start: number) {
  const labelEnd = text.indexOf(']', start + 1);
  if (labelEnd === -1 || text[labelEnd + 1] !== '(') return null;

  const hrefEnd = text.indexOf(')', labelEnd + 2);
  if (hrefEnd === -1) return null;

  const label = text.slice(start + 1, labelEnd);
  const href = text.slice(labelEnd + 2, hrefEnd).trim();
  if (label.trim().length === 0 || !isSafeHref(href)) return null;

  return {
    end: hrefEnd + 1,
    segment: { kind: 'link', href, text: label } satisfies MarkdownSegment,
  };
}

function isSafeHref(href: string) {
  return (
    href.startsWith('#') ||
    href.startsWith('/') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:')
  );
}

function isExternalLink(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function pushTextSegment(segments: MarkdownSegment[], text: string) {
  if (!text) return;

  const last = segments.at(-1);
  if (last?.kind === 'text') {
    last.text += text;
    return;
  }

  segments.push({ kind: 'text', text });
}

function getReadableParagraphs(text: string) {
  const sentences = splitSentences(text);
  return sentences.length <= 1 ? [text] : groupSentences(sentences);
}

function splitSentences(value: string) {
  return (value.match(/[^.!?。！？]+[.!?。！？]+(?:["')\]]+)?|[^.!?。！？]+$/g) ?? [value])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function groupSentences(sentences: string[]) {
  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    if (current.length > 0 && (current.length >= 2 || currentLength + sentence.length > 180)) {
      paragraphs.push(joinSentences(current));
      current = [];
      currentLength = 0;
    }

    current.push(sentence);
    currentLength += sentence.length;
  }

  if (current.length > 0) {
    paragraphs.push(joinSentences(current));
  }

  return paragraphs;
}

function joinSentences(sentences: string[]) {
  return sentences.reduce((result, sentence) => {
    if (!result) return sentence;
    return `${result}${needsSentenceSpace(result, sentence) ? ' ' : ''}${sentence}`;
  }, '');
}

function needsSentenceSpace(previous: string, next: string) {
  return /[A-Za-z0-9)"'\]]$/.test(previous) && /^[A-Za-z0-9("'[]/.test(next);
}
