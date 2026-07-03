import { Readable } from 'node:stream';
import { expect, test } from 'vite-plus/test';
import { readJsonInput } from '../src/artifact/readJson.ts';

test('reads JSON from stdin when input path is dash', async () => {
  const input = Readable.from(['{"chapters":[]}']);

  await expect(readJsonInput('-', { stdin: input })).resolves.toEqual({ chapters: [] });
});

test('reports stdin as the source for invalid stdin JSON', async () => {
  const input = Readable.from(['not json']);

  await expect(readJsonInput('-', { stdin: input })).rejects.toThrow('Invalid JSON: stdin');
});
