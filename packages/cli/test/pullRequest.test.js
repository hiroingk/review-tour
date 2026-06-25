import { expect, test } from 'vite-plus/test';
import { createPullRequestDraft } from '../src/commands/collect.ts';
import { parseGitHubRepository } from '../src/git/remotes.ts';
import { parseGitHubPullRequestUrl, parsePullRequestInfo } from '../src/github/pullRequest.ts';

test('parses GitHub pull request URLs', () => {
  expect(parseGitHubPullRequestUrl('https://github.com/Owner/Repo/pull/123')).toEqual({
    number: 123,
    repository: 'owner/repo',
  });
  expect(parseGitHubPullRequestUrl('https://example.com/Owner/Repo/pull/123')).toBeNull();
});

test('parses common GitHub remote URL formats', () => {
  expect(parseGitHubRepository('https://github.com/Owner/Repo.git')).toBe('owner/repo');
  expect(parseGitHubRepository('git@github.com:Owner/Repo.git')).toBe('owner/repo');
  expect(parseGitHubRepository('ssh://git@github.com/Owner/Repo.git')).toBe('owner/repo');
});

test('parses GitHub CLI pull request metadata', () => {
  const info = parsePullRequestInfo(
    JSON.stringify({
      author: { login: 'octocat' },
      baseRefName: 'main',
      baseRefOid: 'base123',
      body: '',
      headRefName: 'feature',
      headRefOid: 'head123',
      headRepository: { nameWithOwner: 'octocat/repo' },
      isCrossRepository: false,
      number: 123,
      title: 'Add feature',
      url: 'https://github.com/octocat/repo/pull/123',
    }),
  );

  expect(info.author).toBe('octocat');
  expect(info.baseRefName).toBe('main');
  expect(info.body).toBeUndefined();
  expect(info.headRepository).toBe('octocat/repo');
});

test('creates a pull request draft from GitHub metadata and patch output', () => {
  const diff = [
    'diff --git a/src/example.ts b/src/example.ts',
    'index 1111111..2222222 100644',
    '--- a/src/example.ts',
    '+++ b/src/example.ts',
    '@@ -1,2 +1,3 @@',
    ' const one = 1;',
    '+const two = 2;',
    ' const three = 3;',
    '',
  ].join('\n');

  const draft = createPullRequestDraft({
    createdAt: '2026-06-25T00:00:00.000Z',
    pullRequest: {
      baseRefName: 'main',
      baseRefOid: 'base123',
      headRefName: 'feature',
      headRefOid: 'head123',
      number: 123,
      title: 'Add feature',
      url: 'https://github.com/octocat/repo/pull/123',
    },
    repo: {
      currentBranch: 'local-branch',
      headSha: 'local123',
      isDirty: true,
      name: 'repo',
      root: '/tmp/repo',
    },
    unifiedDiff: diff,
  });

  expect(draft.diff.mode).toBe('custom');
  expect(draft.repository.currentBranch).toBe('feature');
  expect(draft.repository.baseBranch).toBe('main');
  expect(draft.repository.headSha).toBe('head123');
  expect(draft.repository.isDirty).toBe(false);
  expect(draft.pullRequest?.number).toBe(123);
  expect(draft.diff.files[0].path).toBe('src/example.ts');
});
