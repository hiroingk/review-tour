#!/usr/bin/env node
// Prints a changelog draft from commits since the most recent tag.
// Usage: pnpm run changelog:draft
import { execFileSync } from 'node:child_process';
import process from 'node:process';

let lastTag;
try {
  lastTag = git(['describe', '--tags', '--abbrev=0']);
} catch {
  lastTag = undefined;
}

const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const log = git(['log', range, '--no-merges', '--pretty=format:%s (%h)']);

process.stdout.write(`## Unreleased (since ${lastTag ?? 'the first commit'})\n\n`);
if (!log) {
  process.stdout.write('No commits in range.\n');
} else {
  for (const line of log.split('\n')) {
    process.stdout.write(`- ${line}\n`);
  }
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}
