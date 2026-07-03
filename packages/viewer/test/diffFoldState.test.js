import { expect, test } from 'vite-plus/test';
import {
  addStringSetValues,
  createEmptyDiffFoldState,
  setStringSetValue,
} from '../src/client/diffFoldState.ts';

test('creates empty diff fold state', () => {
  const state = createEmptyDiffFoldState();

  expect([...state.collapsedFileIds]).toEqual([]);
  expect([...state.expandedFoldIds]).toEqual([]);
});

test('sets string values explicitly', () => {
  const values = new Set(['file_a']);

  expect([...setStringSetValue(values, 'file_b', true)].sort()).toEqual(['file_a', 'file_b']);
  expect([...setStringSetValue(values, 'file_a', false)]).toEqual([]);
});

test('adds multiple string values without removing existing values', () => {
  expect([...addStringSetValues(new Set(['fold_a']), ['fold_b', 'fold_a'])].sort()).toEqual([
    'fold_a',
    'fold_b',
  ]);
});
