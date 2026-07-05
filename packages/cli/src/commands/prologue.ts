import type { ReviewChapter, ReviewPrologue, ReviewTourDraft } from 'review-tour/schema';

export function createFallbackPrologue({
  chapters,
  draft,
  summary,
}: {
  chapters: ReviewChapter[];
  draft: ReviewTourDraft;
  summary?: string;
}): ReviewPrologue {
  const hunkCount = draft.diff.files.reduce((count, file) => count + file.hunks.length, 0);
  const changedPaths = draft.diff.files.slice(0, 3).map((file) => file.path);
  const changedFiles = changedPaths.length > 0 ? changedPaths.join(', ') : 'the changed files';
  const reviewFocus = createReviewFocus(chapters);

  return {
    whyThisPr: formatReadablePrologueText(
      summary ??
        `Review this change because it updates ${draft.diff.stats.filesChanged} files across ${hunkCount} hunks in ${draft.repository.name}.\n\nUse the chapters to move from the broad intent to the highest-risk files first.`,
    ),
    whatItDoes: formatReadablePrologueText(
      `The diff changes ${changedFiles}${
        draft.diff.files.length > changedPaths.length ? ', and related files' : ''
      }.\n\nReview these changes across the generated chapters so behavior, tests, and project wiring stay aligned.`,
    ),
    reviewFocus,
  };
}

export function normalizePrologue(prologue: ReviewPrologue): ReviewPrologue {
  return {
    ...prologue,
    whyThisPr: formatReadablePrologueText(prologue.whyThisPr),
    whatItDoes: formatReadablePrologueText(prologue.whatItDoes),
    reviewFocus: prologue.reviewFocus.map((item) => ({
      ...item,
      summary: formatReadablePrologueText(item.summary),
    })),
  };
}

export function formatReadablePrologueText(value: string) {
  const normalized = normalizeExplicitBreaks(value);
  if (normalized.includes('\n') || normalized.length <= 180) {
    return normalized;
  }

  const sentences = splitSentences(normalized);
  if (sentences.length <= 1) {
    return normalized;
  }

  return groupSentences(sentences).join('\n\n');
}

function createReviewFocus(chapters: ReviewChapter[]): ReviewPrologue['reviewFocus'] {
  const prioritized = [...chapters].sort((a, b) => getRiskWeight(b.risk) - getRiskWeight(a.risk));
  const focusItems = prioritized.slice(0, 3).map((chapter) => ({
    title: chapter.title,
    path: chapter.files[0]?.path,
    summary: formatReadablePrologueText(chapter.rationale || chapter.summary),
    hunkIds: chapter.hunkIds,
  }));

  if (focusItems.length > 0) {
    return focusItems;
  }

  return [
    {
      title: 'Diff coverage',
      summary: formatReadablePrologueText(
        'Confirm that every changed hunk is represented in the generated review chapters.',
      ),
    },
  ];
}

function normalizeExplicitBreaks(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  return sentences.reduce((text, sentence) => {
    if (!text) return sentence;
    return `${text}${needsSentenceSpace(text, sentence) ? ' ' : ''}${sentence}`;
  }, '');
}

function needsSentenceSpace(previous: string, next: string) {
  return /[A-Za-z0-9)"'\]]$/.test(previous) && /^[A-Za-z0-9("'[]/.test(next);
}

function getRiskWeight(risk: ReviewChapter['risk']) {
  if (risk === 'high') return 3;
  if (risk === 'medium') return 2;
  return 1;
}
