import { expect, test } from 'vite-plus/test';
import { groupFileHunks } from '../src/reviewModel.ts';

const groups = [
  {
    id: 'group_parse',
    title: 'Parse the request',
    summary: 'Validate and normalize the incoming payload.',
    risk: 'medium',
    hunkIds: ['hunk_a', 'hunk_b'],
  },
  {
    id: 'group_persist',
    title: 'Persist the result',
    summary: 'Write the normalized payload after validation succeeds.',
    risk: 'high',
    hunkIds: ['hunk_c'],
  },
];

test('groups consecutive file hunks into review sections', () => {
  const sections = groupFileHunks([{ id: 'hunk_a' }, { id: 'hunk_b' }, { id: 'hunk_c' }], groups);

  expect(
    sections.map((section) => ({
      groupId: section.group?.id,
      groupIndex: section.groupIndex,
      hunkIds: section.hunks.map((hunk) => hunk.id),
    })),
  ).toEqual([
    {
      groupId: 'group_parse',
      groupIndex: 0,
      hunkIds: ['hunk_a', 'hunk_b'],
    },
    {
      groupId: 'group_persist',
      groupIndex: 1,
      hunkIds: ['hunk_c'],
    },
  ]);
});

test('keeps unassigned hunks visible', () => {
  const sections = groupFileHunks(
    [{ id: 'hunk_a' }, { id: 'hunk_unassigned' }, { id: 'hunk_c' }],
    groups,
  );

  expect(sections.map((section) => section.group?.id ?? null)).toEqual([
    'group_parse',
    null,
    'group_persist',
  ]);
  expect(sections[1].hunks.map((hunk) => hunk.id)).toEqual(['hunk_unassigned']);
});

test('renders legacy files as one ungrouped section', () => {
  const sections = groupFileHunks([{ id: 'hunk_a' }, { id: 'hunk_b' }]);

  expect(sections).toEqual([
    {
      group: null,
      groupIndex: null,
      hunks: [{ id: 'hunk_a' }, { id: 'hunk_b' }],
    },
  ]);
});
