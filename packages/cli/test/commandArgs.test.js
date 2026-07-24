import { expect, test } from 'vite-plus/test';
import {
  collectHelpText,
  createUntrackedFilesSkippedWarning,
  validateCollectArgs,
} from '../src/commands/collect.ts';
import { validateGenerateArgs } from '../src/commands/generate.ts';
import { validateOpenArgs } from '../src/commands/open.ts';
import { validateServeArgs } from '../src/commands/serve.ts';
import { validateWriteArgs } from '../src/commands/write.ts';

function args(command, options = [], positionals = []) {
  return {
    command,
    options: new Map(options),
    positionals,
  };
}

test('collect accepts help without running collection inputs', () => {
  expect(() => validateCollectArgs(args('collect', [['help', true]]))).not.toThrow();
  expect(collectHelpText()).toContain('review-tour collect');
  expect(collectHelpText()).toContain('--output <path>');
  expect(collectHelpText()).toContain('--include-untracked');
});

test('collect rejects unknown options, flag values, and positionals', () => {
  expect(() => validateCollectArgs(args('collect', [['hlep', true]]))).toThrow(
    'Unknown option for review-tour collect: --hlep',
  );
  expect(() => validateCollectArgs(args('collect', [['include-untracked', 'yes']]))).toThrow(
    '--include-untracked does not accept a value',
  );
  expect(() => validateCollectArgs(args('collect', [['output', true]]))).toThrow(
    '--output requires a value',
  );
  expect(() => validateCollectArgs(args('collect', [], ['extra']))).toThrow(
    'does not accept positional arguments',
  );
});

test('primary commands reject unknown options before performing work', () => {
  expect(() => validateGenerateArgs(args('generate', [['unknown', true]]))).toThrow(
    'Unknown option for review-tour generate',
  );
  expect(() => validateWriteArgs(args('write', [['unknown', true]]))).toThrow(
    'Unknown option for review-tour write',
  );
  expect(() => validateOpenArgs(args('open', [['unknown', true]]))).toThrow(
    'Unknown option for review-tour open',
  );
  expect(() => validateServeArgs(args('serve', [['unknown', true]]))).toThrow(
    'Unknown option for review-tour serve',
  );
});

test('summarizes skipped untracked files without flooding warnings', () => {
  expect(
    createUntrackedFilesSkippedWarning(['src/one.ts', 'src/two.ts', 'src/three.ts', 'src/four.ts']),
  ).toEqual({
    code: 'UNTRACKED_FILES_SKIPPED',
    message:
      '4 untracked file(s) were skipped: src/one.ts, src/two.ts, src/three.ts, and 1 more. Rerun with --include-untracked to include them.',
  });
});
