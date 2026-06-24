import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vite-plus/test';
import { getSkillDataDir } from '../src/commands/skills.ts';

test('locates skill data from an explicit environment override', async () => {
  const skillDataDir = mkdtempSync(path.join(tmpdir(), 'review-tour-skills-'));
  mkdirSync(path.join(skillDataDir, 'core'));
  writeFileSync(
    path.join(skillDataDir, 'core', 'SKILL.md'),
    '---\nname: core\ndescription: Test skill\n---\n',
  );

  const previous = process.env.REVIEW_TOUR_SKILL_DATA_DIR;
  process.env.REVIEW_TOUR_SKILL_DATA_DIR = skillDataDir;

  try {
    await expect(getSkillDataDir()).resolves.toBe(skillDataDir);
  } finally {
    if (previous === undefined) {
      delete process.env.REVIEW_TOUR_SKILL_DATA_DIR;
    } else {
      process.env.REVIEW_TOUR_SKILL_DATA_DIR = previous;
    }
  }
});
