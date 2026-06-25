import { describe, expect, test } from 'vite-plus/test';
import { validateReviewTour } from '../src/reviewTourSchema.ts';

function createTour(overrides = {}) {
  return {
    schemaVersion: 'review-tour/v1',
    id: 'tour_test',
    createdAt: '2026-06-23T00:00:00.000Z',
    generator: {
      name: 'review-tour',
      version: '0.0.0',
      mode: 'codex-skill',
    },
    repository: {
      root: '/tmp/repo',
      name: 'repo',
      currentBranch: 'main',
      baseBranch: 'origin/main',
      headSha: 'abc123',
      isDirty: false,
    },
    diff: {
      mode: 'working-tree',
      stats: { filesChanged: 1, additions: 1, deletions: 0 },
      files: [
        {
          id: 'file_abc',
          path: 'src/example.ts',
          status: 'modified',
          language: 'typescript',
          additions: 1,
          deletions: 0,
          hunks: [
            {
              id: 'hunk_abc',
              fileId: 'file_abc',
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 2,
              header: '@@ -1 +1,2 @@',
              patchHash: 'hash',
              lines: [
                { type: 'context', oldLine: 1, newLine: 1, content: 'one' },
                { type: 'add', newLine: 2, content: 'two' },
              ],
            },
          ],
        },
      ],
    },
    tour: {
      title: 'Test tour',
      summary: 'A minimal valid tour.',
      prologue: {
        whyThisPr: 'The old flow did not explain the motivation behind the diff.',
        whatItDoes: 'The tour now gives reviewers a concise introduction before chapters.',
        reviewFocus: [
          {
            title: 'Prologue rendering',
            path: 'src/example.ts',
            summary: 'Confirm the generated prologue gives enough context for reviewers.',
            hunkIds: ['hunk_abc'],
          },
        ],
      },
      chapters: [
        {
          id: 'chapter_1',
          index: 1,
          title: 'Example',
          summary: 'Review the example file.',
          risk: 'low',
          rationale: 'Small change.',
          reviewQuestions: ['Is this expected?'],
          hunkIds: ['hunk_abc'],
          files: [{ path: 'src/example.ts', hunkIds: ['hunk_abc'] }],
        },
      ],
    },
    warnings: [],
    ...overrides,
  };
}

describe('review tour schema', () => {
  test('validates a minimal review tour artifact', () => {
    const result = validateReviewTour(createTour());
    expect(result.ok).toBe(true);
  });

  test('validates optional pull request metadata', () => {
    const result = validateReviewTour(
      createTour({
        pullRequest: {
          baseRefName: 'main',
          headRefName: 'feature',
          number: 123,
          title: 'Add feature',
          url: 'https://github.com/octocat/repo/pull/123',
        },
      }),
    );

    expect(result.ok).toBe(true);
  });

  test('rejects an invalid schema version', () => {
    const result = validateReviewTour(createTour({ schemaVersion: 'bad' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toMatch(/schemaVersion/);
    }
  });

  test('rejects an invalid prologue shape', () => {
    const result = validateReviewTour(
      createTour({
        tour: {
          title: 'Test tour',
          summary: 'A minimal valid tour.',
          prologue: {
            whyThisPr: '',
            whatItDoes: 'Valid text.',
            reviewFocus: [{ title: 'Missing summary' }],
          },
          chapters: [
            {
              id: 'chapter_1',
              index: 1,
              title: 'Example',
              summary: 'Review the example file.',
              risk: 'low',
              rationale: 'Small change.',
              reviewQuestions: ['Is this expected?'],
              hunkIds: ['hunk_abc'],
              files: [{ path: 'src/example.ts', hunkIds: ['hunk_abc'] }],
            },
          ],
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toMatch(/tour\.prologue/);
    }
  });

  test('allows blank diff line content', () => {
    const tour = createTour({
      diff: {
        mode: 'working-tree',
        stats: { filesChanged: 1, additions: 1, deletions: 0 },
        files: [
          {
            id: 'file_abc',
            path: 'src/example.ts',
            status: 'modified',
            language: 'typescript',
            additions: 1,
            deletions: 0,
            hunks: [
              {
                id: 'hunk_abc',
                fileId: 'file_abc',
                oldStart: 1,
                oldLines: 1,
                newStart: 1,
                newLines: 2,
                header: '@@ -1 +1,2 @@',
                patchHash: 'hash',
                lines: [
                  { type: 'context', oldLine: 1, newLine: 1, content: '' },
                  { type: 'add', newLine: 2, content: '' },
                ],
              },
            ],
          },
        ],
      },
    });

    const result = validateReviewTour(tour);
    expect(result.ok).toBe(true);
  });
});
