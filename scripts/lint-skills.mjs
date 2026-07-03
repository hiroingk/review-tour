#!/usr/bin/env node
// Lints SKILL.md files under skills/ and skill-data/:
// - frontmatter must parse and declare name + description
// - the name must match the directory and the skill name pattern
// - inline code spans must avoid patterns that trip agent permission checkers
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoots = ['skills', 'skill-data'];
const namePattern = /^[a-z0-9][a-z0-9-]*$/;

const problems = [];
let checkedFiles = 0;

for (const root of skillRoots) {
  const rootDir = path.join(repoRoot, root);
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    problems.push(`${root}: directory is missing.`);
    continue;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const skillPath = path.join(rootDir, entry.name, 'SKILL.md');
    const relativePath = path.relative(repoRoot, skillPath);
    let body;
    try {
      body = await readFile(skillPath, 'utf8');
    } catch {
      problems.push(`${relativePath}: SKILL.md is missing.`);
      continue;
    }

    checkedFiles += 1;
    lintSkillFile(relativePath, entry.name, body);
  }
}

if (checkedFiles === 0) {
  problems.push('No SKILL.md files were found.');
}

if (problems.length > 0) {
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.stderr.write(`\nSkill lint failed with ${problems.length} problem(s).\n`);
  process.exit(1);
}

process.stdout.write(`Skill lint passed. ${checkedFiles} SKILL.md file(s) checked.\n`);

function lintSkillFile(relativePath, directoryName, body) {
  const frontmatterMatch = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    problems.push(`${relativePath}: missing or unterminated YAML frontmatter.`);
    return;
  }

  const fields = new Map();
  for (const line of frontmatterMatch[1].split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const fieldMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!fieldMatch) {
      problems.push(`${relativePath}: unparseable frontmatter line: ${line}`);
      continue;
    }
    fields.set(fieldMatch[1], fieldMatch[2].replace(/^['"]|['"]$/g, '').trim());
  }

  const name = fields.get('name');
  if (!name) {
    problems.push(`${relativePath}: frontmatter is missing a name field.`);
  } else {
    if (!namePattern.test(name)) {
      problems.push(`${relativePath}: skill name "${name}" does not match ${namePattern}.`);
    }
    if (name !== directoryName) {
      problems.push(
        `${relativePath}: skill name "${name}" does not match directory "${directoryName}".`,
      );
    }
  }

  const description = fields.get('description');
  if (!description) {
    problems.push(`${relativePath}: frontmatter is missing a description field.`);
  } else if (description.length > 1024) {
    problems.push(`${relativePath}: description is longer than 1024 characters.`);
  }

  lintInlineCodeSpans(relativePath, body.slice(frontmatterMatch[0].length));
}

function lintInlineCodeSpans(relativePath, markdownBody) {
  // Fenced blocks are safe; only inline spans confuse shell-permission parsers.
  const withoutFences = markdownBody.replace(/^```[\s\S]*?^```/gm, '');

  for (const spanMatch of withoutFences.matchAll(/`([^`\n]+)`/g)) {
    const span = spanMatch[1];
    if (span.startsWith('!')) {
      problems.push(
        `${relativePath}: inline code span \`${span}\` starts with "!" (history-expansion risk).`,
      );
    }
    if (/\s>{1,2}\s/.test(span)) {
      problems.push(
        `${relativePath}: inline code span \`${span}\` contains a redirection-like ">" pattern.`,
      );
    }
  }
}
