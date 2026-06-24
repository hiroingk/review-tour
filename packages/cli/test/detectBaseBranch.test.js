import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vite-plus/test';
import { detectBaseBranch } from '../src/git/detectBaseBranch.ts';

test('prefers the current branch tracking upstream over origin/main', () => {
  const repoRoot = createRepoWithTrackingFeature();

  const result = detectBaseBranch({ repoRoot });

  expect(result.baseBranch).toBe('origin/feature');
});

test('promotes an inferred upstream when it has already been merged into origin/main', () => {
  const repoRoot = createRepoWithTrackingFeature();
  git(repoRoot, ['checkout', '-q', 'main']);
  git(repoRoot, ['merge', '--no-ff', '-q', '-m', 'merge feature', 'feature']);
  git(repoRoot, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(repoRoot, ['checkout', '-q', 'feature']);

  const result = detectBaseBranch({ repoRoot });

  expect(result.baseBranch).toBe('origin/main');
  expect(result.warnings[0]?.message).toContain(
    'Base branch was inferred as origin/feature, then updated to origin/main',
  );
});

test('does not promote an explicit base branch', () => {
  const repoRoot = createRepoWithTrackingFeature();
  git(repoRoot, ['checkout', '-q', 'main']);
  git(repoRoot, ['merge', '--no-ff', '-q', '-m', 'merge feature', 'feature']);
  git(repoRoot, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(repoRoot, ['checkout', '-q', 'feature']);

  const result = detectBaseBranch({ repoRoot, explicitBase: 'origin/feature' });

  expect(result.baseBranch).toBe('origin/feature');
  expect(result.warnings).toEqual([]);
});

function createRepoWithTrackingFeature() {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'review-tour-base-'));
  git(repoRoot, ['init', '-q']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'Test']);
  git(repoRoot, ['remote', 'add', 'origin', 'https://example.invalid/repo.git']);

  writeFileSync(path.join(repoRoot, 'file.txt'), 'main\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-q', '-m', 'initial']);
  git(repoRoot, ['branch', '-M', 'main']);
  git(repoRoot, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);

  git(repoRoot, ['checkout', '-q', '-b', 'feature']);
  writeFileSync(path.join(repoRoot, 'file.txt'), 'feature\n');
  git(repoRoot, ['commit', '-q', '-am', 'feature']);
  git(repoRoot, ['update-ref', 'refs/remotes/origin/feature', 'HEAD']);
  git(repoRoot, ['branch', '--set-upstream-to=origin/feature', 'feature']);

  return repoRoot;
}

function git(cwd, args) {
  execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
