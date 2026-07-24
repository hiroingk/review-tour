import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vite-plus/test';
import { parseUnifiedDiff } from '../src/diff/parseUnifiedDiff.ts';
import { DIFF_CONTEXT_LINES, getDiff, getUntrackedPaths } from '../src/git/getDiff.ts';

test('includes untracked non-ignored files only when requested', () => {
  const repoRoot = createRepo();

  try {
    mkdirSync(path.join(repoRoot, 'src'));
    writeFileSync(path.join(repoRoot, 'src/new.ts'), 'export const created = true;\n');
    writeFileSync(path.join(repoRoot, 'ignored.log'), 'ignore me\n');

    expect(getUntrackedPaths(repoRoot)).toEqual(['src/new.ts']);
    expect(
      getDiff({
        baseBranch: 'HEAD',
        includeUntracked: false,
        mode: 'working-tree',
        repoRoot,
      }),
    ).toBe('');

    const diff = getDiff({
      baseBranch: 'HEAD',
      includeUntracked: true,
      mode: 'working-tree',
      repoRoot,
    });
    const parsed = parseUnifiedDiff(diff);

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].path).toBe('src/new.ts');
    expect(parsed.files[0].status).toBe('added');
    expect(parsed.files[0].hunks).toHaveLength(1);
  } finally {
    rmSync(repoRoot, { force: true, recursive: true });
  }
});

test('keeps distant changes in separate review hunks', () => {
  const repoRoot = createRepo();

  try {
    const filePath = path.join(repoRoot, 'tracked.txt');
    const lines = readFileSync(filePath, 'utf8').trimEnd().split('\n');
    lines[10] = 'changed near the start';
    lines[100] = 'changed near the end';
    writeFileSync(filePath, `${lines.join('\n')}\n`);

    const diff = getDiff({
      baseBranch: 'HEAD',
      mode: 'working-tree',
      repoRoot,
    });

    expect(DIFF_CONTEXT_LINES).toBe(20);
    expect(diff.match(/^@@/gm)).toHaveLength(2);
  } finally {
    rmSync(repoRoot, { force: true, recursive: true });
  }
});

function createRepo() {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'review-tour-diff-'));
  runGit(repoRoot, ['init', '--quiet']);
  runGit(repoRoot, ['config', 'user.email', 'review-tour@example.com']);
  runGit(repoRoot, ['config', 'user.name', 'Review Tour']);

  writeFileSync(path.join(repoRoot, '.gitignore'), '*.log\n');
  writeFileSync(
    path.join(repoRoot, 'tracked.txt'),
    `${Array.from({ length: 130 }, (_, index) => `line ${index + 1}`).join('\n')}\n`,
  );
  runGit(repoRoot, ['add', '.']);
  runGit(repoRoot, ['commit', '--quiet', '-m', 'Initial']);
  return repoRoot;
}

function runGit(repoRoot, args) {
  execFileSync('git', args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
