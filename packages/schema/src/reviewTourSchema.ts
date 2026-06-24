export type ReviewTour = {
  schemaVersion: 'review-tour/v1';
  id: string;
  createdAt: string;
  generator: {
    name: 'review-tour';
    version: string;
    model?: string;
    mode: 'codex-skill' | 'cli-llm' | 'fallback';
  };
  repository: {
    root: string;
    name: string;
    currentBranch: string;
    baseBranch: string;
    headSha: string;
    baseSha?: string;
    isDirty: boolean;
  };
  diff: {
    mode: 'base...head' | 'working-tree' | 'staged' | 'custom';
    stats: {
      filesChanged: number;
      additions: number;
      deletions: number;
    };
    files: DiffFile[];
  };
  tour: {
    title: string;
    summary: string;
    prologue?: ReviewPrologue;
    chapters: ReviewChapter[];
  };
  warnings: ReviewWarning[];
};

export type ReviewTourDraft = Omit<ReviewTour, 'tour'>;

export type DiffFile = {
  id: string;
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  language?: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
};

export type DiffHunk = {
  id: string;
  fileId: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  patchHash: string;
  lines: DiffLine[];
};

export type DiffLine = {
  type: 'context' | 'add' | 'delete';
  oldLine?: number;
  newLine?: number;
  content: string;
};

export type ReviewChapter = {
  id: string;
  index: number;
  title: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  rationale: string;
  reviewQuestions: string[];
  hunkIds: string[];
  files: Array<{
    path: string;
    hunkIds: string[];
  }>;
};

export type ReviewPrologue = {
  whyThisPr: string;
  whatItDoes: string;
  reviewFocus: ReviewFocusItem[];
};

export type ReviewFocusItem = {
  title: string;
  path?: string;
  summary: string;
  hunkIds?: string[];
};

export type ReviewWarning = {
  code:
    | 'DIFF_TOO_LARGE'
    | 'BINARY_FILE_SKIPPED'
    | 'PATCH_TRUNCATED'
    | 'BASE_BRANCH_GUESSED'
    | 'UNCOMMITTED_CHANGES_INCLUDED'
    | 'LLM_PARTIAL_COVERAGE';
  message: string;
};

export class ReviewTourValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ReviewTourValidationError';
    this.errors = errors;
  }
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const diffModes = ['base...head', 'working-tree', 'staged', 'custom'] as const;
const fileStatuses = ['added', 'modified', 'deleted', 'renamed'] as const;
const lineTypes = ['context', 'add', 'delete'] as const;
const risks = ['low', 'medium', 'high'] as const;
const generatorModes = ['codex-skill', 'cli-llm', 'fallback'] as const;
const warningCodes = [
  'DIFF_TOO_LARGE',
  'BINARY_FILE_SKIPPED',
  'PATCH_TRUNCATED',
  'BASE_BRANCH_GUESSED',
  'UNCOMMITTED_CHANGES_INCLUDED',
  'LLM_PARTIAL_COVERAGE',
] as const;

export function validateReviewTour(value: unknown): ValidationResult<ReviewTour> {
  const errors: string[] = [];
  validateDraftLike(value, errors);

  const root = asRecord(value);
  const tour = root ? root.tour : undefined;
  const tourRecord = asRecord(tour);
  if (!tourRecord) {
    errors.push('tour must be an object');
  } else {
    expectString(tourRecord.title, 'tour.title', errors);
    expectString(tourRecord.summary, 'tour.summary', errors);
    if (tourRecord.prologue !== undefined) {
      validatePrologue(tourRecord.prologue, errors);
    }
    validateChapters(tourRecord.chapters, errors);
  }

  return errors.length === 0 ? { ok: true, value: value as ReviewTour } : { ok: false, errors };
}

export function assertReviewTour(value: unknown): asserts value is ReviewTour {
  const result = validateReviewTour(value);
  if (!result.ok) {
    throw new ReviewTourValidationError(result.errors);
  }
}

export function validateReviewTourDraft(value: unknown): ValidationResult<ReviewTourDraft> {
  const errors: string[] = [];
  validateDraftLike(value, errors);
  const root = asRecord(value);
  if (root && 'tour' in root) {
    errors.push('draft must not include tour');
  }

  return errors.length === 0
    ? { ok: true, value: value as ReviewTourDraft }
    : { ok: false, errors };
}

export function assertReviewTourDraft(value: unknown): asserts value is ReviewTourDraft {
  const result = validateReviewTourDraft(value);
  if (!result.ok) {
    throw new ReviewTourValidationError(result.errors);
  }
}

export function validateReviewChapters(value: unknown): ValidationResult<ReviewChapter[]> {
  const errors: string[] = [];
  validateChapters(value, errors);

  return errors.length === 0
    ? { ok: true, value: value as ReviewChapter[] }
    : { ok: false, errors };
}

export function assertReviewChapters(value: unknown): asserts value is ReviewChapter[] {
  const result = validateReviewChapters(value);
  if (!result.ok) {
    throw new ReviewTourValidationError(result.errors);
  }
}

function validateDraftLike(value: unknown, errors: string[]) {
  const root = asRecord(value);
  if (!root) {
    errors.push('artifact must be an object');
    return;
  }

  expectLiteral(root.schemaVersion, 'review-tour/v1', 'schemaVersion', errors);
  expectString(root.id, 'id', errors);
  expectString(root.createdAt, 'createdAt', errors);

  validateGenerator(root.generator, errors);
  validateRepository(root.repository, errors);
  validateDiff(root.diff, errors);
  validateWarnings(root.warnings, errors);
}

function validateGenerator(value: unknown, errors: string[]) {
  const generator = asRecord(value);
  if (!generator) {
    errors.push('generator must be an object');
    return;
  }

  expectLiteral(generator.name, 'review-tour', 'generator.name', errors);
  expectString(generator.version, 'generator.version', errors);
  if (generator.model !== undefined) {
    expectString(generator.model, 'generator.model', errors);
  }
  expectOneOf(generator.mode, generatorModes, 'generator.mode', errors);
}

function validateRepository(value: unknown, errors: string[]) {
  const repository = asRecord(value);
  if (!repository) {
    errors.push('repository must be an object');
    return;
  }

  expectString(repository.root, 'repository.root', errors);
  expectString(repository.name, 'repository.name', errors);
  expectString(repository.currentBranch, 'repository.currentBranch', errors);
  expectString(repository.baseBranch, 'repository.baseBranch', errors);
  expectString(repository.headSha, 'repository.headSha', errors);
  if (repository.baseSha !== undefined) {
    expectString(repository.baseSha, 'repository.baseSha', errors);
  }
  expectBoolean(repository.isDirty, 'repository.isDirty', errors);
}

function validateDiff(value: unknown, errors: string[]) {
  const diff = asRecord(value);
  if (!diff) {
    errors.push('diff must be an object');
    return;
  }

  expectOneOf(diff.mode, diffModes, 'diff.mode', errors);

  const stats = asRecord(diff.stats);
  if (!stats) {
    errors.push('diff.stats must be an object');
  } else {
    expectNonNegativeNumber(stats.filesChanged, 'diff.stats.filesChanged', errors);
    expectNonNegativeNumber(stats.additions, 'diff.stats.additions', errors);
    expectNonNegativeNumber(stats.deletions, 'diff.stats.deletions', errors);
  }

  if (!Array.isArray(diff.files)) {
    errors.push('diff.files must be an array');
    return;
  }

  diff.files.forEach((file, index) => validateDiffFile(file, `diff.files[${index}]`, errors));
}

function validateDiffFile(value: unknown, path: string, errors: string[]) {
  const file = asRecord(value);
  if (!file) {
    errors.push(`${path} must be an object`);
    return;
  }

  expectString(file.id, `${path}.id`, errors);
  expectString(file.path, `${path}.path`, errors);
  if (file.oldPath !== undefined) {
    expectString(file.oldPath, `${path}.oldPath`, errors);
  }
  expectOneOf(file.status, fileStatuses, `${path}.status`, errors);
  if (file.language !== undefined) {
    expectString(file.language, `${path}.language`, errors);
  }
  expectNonNegativeNumber(file.additions, `${path}.additions`, errors);
  expectNonNegativeNumber(file.deletions, `${path}.deletions`, errors);

  if (!Array.isArray(file.hunks)) {
    errors.push(`${path}.hunks must be an array`);
    return;
  }

  file.hunks.forEach((hunk, index) => validateDiffHunk(hunk, `${path}.hunks[${index}]`, errors));
}

function validateDiffHunk(value: unknown, path: string, errors: string[]) {
  const hunk = asRecord(value);
  if (!hunk) {
    errors.push(`${path} must be an object`);
    return;
  }

  expectString(hunk.id, `${path}.id`, errors);
  expectString(hunk.fileId, `${path}.fileId`, errors);
  expectNonNegativeNumber(hunk.oldStart, `${path}.oldStart`, errors);
  expectNonNegativeNumber(hunk.oldLines, `${path}.oldLines`, errors);
  expectNonNegativeNumber(hunk.newStart, `${path}.newStart`, errors);
  expectNonNegativeNumber(hunk.newLines, `${path}.newLines`, errors);
  expectString(hunk.header, `${path}.header`, errors);
  expectString(hunk.patchHash, `${path}.patchHash`, errors);

  if (!Array.isArray(hunk.lines)) {
    errors.push(`${path}.lines must be an array`);
    return;
  }

  hunk.lines.forEach((line, index) => validateDiffLine(line, `${path}.lines[${index}]`, errors));
}

function validateDiffLine(value: unknown, path: string, errors: string[]) {
  const line = asRecord(value);
  if (!line) {
    errors.push(`${path} must be an object`);
    return;
  }

  expectOneOf(line.type, lineTypes, `${path}.type`, errors);
  if (line.oldLine !== undefined) {
    expectNonNegativeNumber(line.oldLine, `${path}.oldLine`, errors);
  }
  if (line.newLine !== undefined) {
    expectNonNegativeNumber(line.newLine, `${path}.newLine`, errors);
  }
  expectStringValue(line.content, `${path}.content`, errors);
}

function validateChapters(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push('tour.chapters must be an array');
    return;
  }

  value.forEach((chapter, index) => validateChapter(chapter, `tour.chapters[${index}]`, errors));
}

function validatePrologue(value: unknown, errors: string[]) {
  const prologue = asRecord(value);
  if (!prologue) {
    errors.push('tour.prologue must be an object');
    return;
  }

  expectString(prologue.whyThisPr, 'tour.prologue.whyThisPr', errors);
  expectString(prologue.whatItDoes, 'tour.prologue.whatItDoes', errors);

  if (!Array.isArray(prologue.reviewFocus)) {
    errors.push('tour.prologue.reviewFocus must be an array');
    return;
  }

  prologue.reviewFocus.forEach((item, index) => {
    const focusItem = asRecord(item);
    const path = `tour.prologue.reviewFocus[${index}]`;
    if (!focusItem) {
      errors.push(`${path} must be an object`);
      return;
    }

    expectString(focusItem.title, `${path}.title`, errors);
    expectString(focusItem.summary, `${path}.summary`, errors);
    if (focusItem.path !== undefined) {
      expectString(focusItem.path, `${path}.path`, errors);
    }
    if (focusItem.hunkIds !== undefined) {
      expectStringArray(focusItem.hunkIds, `${path}.hunkIds`, errors);
    }
  });
}

function validateChapter(value: unknown, path: string, errors: string[]) {
  const chapter = asRecord(value);
  if (!chapter) {
    errors.push(`${path} must be an object`);
    return;
  }

  expectString(chapter.id, `${path}.id`, errors);
  expectNonNegativeNumber(chapter.index, `${path}.index`, errors);
  expectString(chapter.title, `${path}.title`, errors);
  expectString(chapter.summary, `${path}.summary`, errors);
  expectOneOf(chapter.risk, risks, `${path}.risk`, errors);
  expectString(chapter.rationale, `${path}.rationale`, errors);
  expectStringArray(chapter.reviewQuestions, `${path}.reviewQuestions`, errors);
  expectStringArray(chapter.hunkIds, `${path}.hunkIds`, errors);

  if (!Array.isArray(chapter.files)) {
    errors.push(`${path}.files must be an array`);
    return;
  }

  chapter.files.forEach((file, index) => {
    const filePath = `${path}.files[${index}]`;
    const chapterFile = asRecord(file);
    if (!chapterFile) {
      errors.push(`${filePath} must be an object`);
      return;
    }
    expectString(chapterFile.path, `${filePath}.path`, errors);
    expectStringArray(chapterFile.hunkIds, `${filePath}.hunkIds`, errors);
  });
}

function validateWarnings(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push('warnings must be an array');
    return;
  }

  value.forEach((warning, index) => {
    const warningPath = `warnings[${index}]`;
    const item = asRecord(warning);
    if (!item) {
      errors.push(`${warningPath} must be an object`);
      return;
    }
    expectOneOf(item.code, warningCodes, `${warningPath}.code`, errors);
    expectString(item.message, `${warningPath}.message`, errors);
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function expectLiteral(value: unknown, expected: string, path: string, errors: string[]) {
  if (value !== expected) {
    errors.push(`${path} must be ${JSON.stringify(expected)}`);
  }
}

function expectString(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function expectStringValue(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'string') {
    errors.push(`${path} must be a string`);
  }
}

function expectBoolean(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean`);
  }
}

function expectNonNegativeNumber(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push(`${path} must be a non-negative number`);
  }
}

function expectStringArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }

  value.forEach((item, index) => expectString(item, `${path}[${index}]`, errors));
}

function expectOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  errors: string[],
) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(', ')}`);
  }
}
