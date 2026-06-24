export type ReviewCommentSide = 'left' | 'right' | 'unified';

export type ReviewCommentLineRef = {
  content: string;
  fileId: string;
  filePath: string;
  hunkId: string;
  lineNumber: number;
  newLine?: number;
  oldLine?: number;
  position: number;
  side: ReviewCommentSide;
  type: 'add' | 'context' | 'delete';
};

export type ReviewCommentRange = {
  end: ReviewCommentLineRef;
  fileId: string;
  filePath: string;
  hunkId: string;
  lines: ReviewCommentLineRef[];
  side: ReviewCommentSide;
  start: ReviewCommentLineRef;
};

export type ReviewComment = {
  body: string;
  createdAt: string;
  id: string;
  range: ReviewCommentRange;
  updatedAt: string;
};

export function createReviewComment(range: ReviewCommentRange, body: string): ReviewComment {
  const now = new Date().toISOString();

  return {
    body: body.trim(),
    createdAt: now,
    id: createCommentId(),
    range,
    updatedAt: now,
  };
}

export function readReviewComments(storageKey: string): ReviewComment[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return sortReviewComments(parsed.map(toReviewComment).filter((item) => item !== null));
  } catch {
    return [];
  }
}

export function writeReviewComments(storageKey: string, comments: readonly ReviewComment[]) {
  if (typeof window === 'undefined') return;

  try {
    if (comments.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sortReviewComments(comments)));
  } catch {
    // Ignore storage failures; in-memory comments remain available for this session.
  }
}

export function sortReviewComments(comments: readonly ReviewComment[]) {
  return [...comments].sort((left, right) => {
    const pathOrder = left.range.filePath.localeCompare(right.range.filePath);
    if (pathOrder !== 0) return pathOrder;

    const leftLine = Math.min(left.range.start.lineNumber, left.range.end.lineNumber);
    const rightLine = Math.min(right.range.start.lineNumber, right.range.end.lineNumber);
    if (leftLine !== rightLine) return leftLine - rightLine;

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function getReviewCommentLocation(range: ReviewCommentRange) {
  return `${range.filePath}:${getReviewCommentLineLabel(range)} (${getReviewCommentSideLabel(
    range,
  )})`;
}

export function getReviewCommentLineLabel(range: ReviewCommentRange) {
  const start = range.start.lineNumber;
  const end = range.end.lineNumber;

  return start === end ? `L${start}` : `L${Math.min(start, end)}-L${Math.max(start, end)}`;
}

export function getReviewCommentSnippet(range: ReviewCommentRange) {
  const content = range.lines.find((line) => line.content.trim())?.content.trim();
  if (!content) return 'Blank line';

  return content.length > 96 ? `${content.slice(0, 95)}...` : content;
}

export function formatReviewCommentsForCodex(comments: readonly ReviewComment[]) {
  const sorted = sortReviewComments(comments);
  if (sorted.length === 0) return '';

  const sections = sorted.flatMap((comment, index) => {
    const code = formatSelectedCode(comment.range);
    const fence = getMarkdownFence(code);

    return [
      `## ${index + 1}. ${getReviewCommentLocation(comment.range)}`,
      '',
      'Comment:',
      comment.body.trim(),
      '',
      'Selected code:',
      fence,
      code,
      fence,
      '',
    ];
  });

  return ['Please address the following review comments from Review Tour.', '', ...sections]
    .join('\n')
    .trimEnd();
}

export function getReviewCommentLineKey(line: ReviewCommentLineRef) {
  return [
    line.fileId,
    line.hunkId,
    line.side,
    line.position,
    line.oldLine ?? '',
    line.newLine ?? '',
    line.type,
  ].join(':');
}

function formatSelectedCode(range: ReviewCommentRange) {
  return range.lines
    .map((line) => `${getDiffLinePrefix(line.type)}${line.content === '' ? ' ' : line.content}`)
    .join('\n');
}

function getDiffLinePrefix(type: ReviewCommentLineRef['type']) {
  if (type === 'add') return '+';
  if (type === 'delete') return '-';
  return ' ';
}

function getReviewCommentSideLabel(range: ReviewCommentRange) {
  if (range.side === 'left') return 'old';
  if (range.side === 'right') return 'new';

  const hasDelete = range.lines.some((line) => line.type === 'delete');
  const hasNonDelete = range.lines.some((line) => line.type !== 'delete');
  if (hasDelete && hasNonDelete) return 'unified';
  return hasDelete ? 'old' : 'new';
}

function getMarkdownFence(content: string) {
  return content.includes('```') ? '````' : '```';
}

function createCommentId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toReviewComment(value: unknown): ReviewComment | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = asString(record.id);
  const body = asString(record.body);
  const createdAt = asString(record.createdAt);
  const updatedAt = asString(record.updatedAt);
  const range = toReviewCommentRange(record.range);
  if (!id || !body || !createdAt || !updatedAt || !range) return null;

  return { body, createdAt, id, range, updatedAt };
}

function toReviewCommentRange(value: unknown): ReviewCommentRange | null {
  const record = asRecord(value);
  if (!record) return null;

  const fileId = asString(record.fileId);
  const filePath = asString(record.filePath);
  const hunkId = asString(record.hunkId);
  const side = toReviewCommentSide(record.side);
  const start = toReviewCommentLineRef(record.start);
  const end = toReviewCommentLineRef(record.end);
  const lines = Array.isArray(record.lines)
    ? record.lines.map(toReviewCommentLineRef).filter((item) => item !== null)
    : [];

  if (!fileId || !filePath || !hunkId || !side || !start || !end || lines.length === 0) {
    return null;
  }

  return { end, fileId, filePath, hunkId, lines, side, start };
}

function toReviewCommentLineRef(value: unknown): ReviewCommentLineRef | null {
  const record = asRecord(value);
  if (!record) return null;

  const content = asString(record.content);
  const fileId = asString(record.fileId);
  const filePath = asString(record.filePath);
  const hunkId = asString(record.hunkId);
  const lineNumber = asNumber(record.lineNumber);
  const position = asNumber(record.position);
  const side = toReviewCommentSide(record.side);
  const type = toDiffLineType(record.type);
  if (
    content === undefined ||
    !fileId ||
    !filePath ||
    !hunkId ||
    lineNumber === undefined ||
    position === undefined ||
    !side ||
    !type
  ) {
    return null;
  }

  const oldLine = asNumber(record.oldLine);
  const newLine = asNumber(record.newLine);

  return {
    content,
    fileId,
    filePath,
    hunkId,
    lineNumber,
    newLine,
    oldLine,
    position,
    side,
    type,
  };
}

function toReviewCommentSide(value: unknown): ReviewCommentSide | null {
  return value === 'left' || value === 'right' || value === 'unified' ? value : null;
}

function toDiffLineType(value: unknown): ReviewCommentLineRef['type'] | null {
  return value === 'add' || value === 'context' || value === 'delete' ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
