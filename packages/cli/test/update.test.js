import { expect, test } from 'vite-plus/test';
import {
  createUpdateCommand,
  formatUpdateCommand,
  validateUpdateArgs,
} from '../src/commands/update.ts';

test('updates the npm package that owns the CLI and bundled viewer packages', () => {
  const command = createUpdateCommand('darwin');

  expect(command.command).toBe('npm');
  expect(command.args).toEqual(['install', '--global', 'review-tour@latest']);
  expect(formatUpdateCommand(command)).toBe('npm install --global review-tour@latest');
});

test('uses the npm command shim on Windows', () => {
  expect(createUpdateCommand('win32').command).toBe('npm.cmd');
});

test('keeps update intentionally argument-free', () => {
  expect(() =>
    validateUpdateArgs({
      command: 'update',
      options: new Map([['json', true]]),
      positionals: [],
    }),
  ).toThrow('review-tour update does not accept arguments or options.');
});
