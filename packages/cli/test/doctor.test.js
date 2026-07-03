import { expect, test } from 'vite-plus/test';
import { compareSemver, parseMinimumVersion, validateDoctorArgs } from '../src/commands/doctor.ts';

test('parseMinimumVersion extracts the minimum from a range', () => {
  expect(parseMinimumVersion('>=22.12.0')).toBe('22.12.0');
  expect(parseMinimumVersion('^1.2.3')).toBe('1.2.3');
  expect(parseMinimumVersion('latest')).toBeUndefined();
});

test('compareSemver orders versions numerically per part', () => {
  expect(compareSemver('22.12.0', '22.12.0')).toBe(0);
  expect(compareSemver('22.11.9', '22.12.0')).toBe(-1);
  expect(compareSemver('23.0.0', '22.12.0')).toBe(1);
  expect(compareSemver('22.12.1', '22.12.0')).toBe(1);
});

test('validateDoctorArgs rejects unknown options and positionals', () => {
  expect(() =>
    validateDoctorArgs({ command: 'doctor', positionals: [], options: new Map([['json', true]]) }),
  ).not.toThrow();
  expect(() =>
    validateDoctorArgs({ command: 'doctor', positionals: [], options: new Map([['port', '1']]) }),
  ).toThrow(/Unknown doctor option/);
  expect(() =>
    validateDoctorArgs({ command: 'doctor', positionals: ['extra'], options: new Map() }),
  ).toThrow(/positional/);
});
