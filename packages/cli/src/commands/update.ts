import { spawn } from 'node:child_process';
import type { ParsedArgs } from '../cliArgs.js';

const packageName = 'review-tour';

export type UpdateCommand = {
  args: string[];
  command: string;
};

export async function updateCommand(args: ParsedArgs) {
  validateUpdateArgs(args);

  const command = createUpdateCommand();
  process.stdout.write(`Updating Review Tour with: ${formatUpdateCommand(command)}\n`);
  process.stdout.write('This updates the CLI, bundled viewer, schema, and skill data together.\n');
  await runUpdateCommand(command);
  process.stdout.write('Review Tour update finished.\n');
}

export function validateUpdateArgs(args: ParsedArgs) {
  if (args.positionals.length > 0 || args.options.size > 0) {
    throw new Error('review-tour update does not accept arguments or options.');
  }
}

export function createUpdateCommand(platform: NodeJS.Platform = process.platform): UpdateCommand {
  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['install', '--global', `${packageName}@latest`],
  };
}

export function formatUpdateCommand(command: UpdateCommand) {
  return [command.command, ...command.args].join(' ');
}

function runUpdateCommand(command: UpdateCommand) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, command.args, { stdio: 'inherit' });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Review Tour update: ${error.message}`));
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Review Tour update stopped by signal ${signal}.`));
        return;
      }

      if (code && code !== 0) {
        reject(new Error(`Review Tour update failed with exit code ${code}.`));
        return;
      }

      resolve();
    });
  });
}
