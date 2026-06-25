#!/usr/bin/env node
import { parseArgs } from './cliArgs.js';
import { collectCommand } from './commands/collect.js';
import { generateCommand } from './commands/generate.js';
import { gcCommand } from './commands/gc.js';
import { openCommand } from './commands/open.js';
import { serveCommand } from './commands/serve.js';
import { skillsCommand } from './commands/skills.js';
import { updateCommand } from './commands/update.js';
import { writeCommand } from './commands/write.js';

const args = parseArgs(process.argv.slice(2));

try {
  await main();
} catch (error) {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}

async function main() {
  switch (args.command) {
    case 'collect':
      await collectCommand(args);
      return;
    case 'generate':
      await generateCommand(args);
      return;
    case 'write':
      await writeCommand(args);
      return;
    case 'open':
      await openCommand(args);
      return;
    case 'serve':
      await serveCommand(args);
      return;
    case 'skills':
      await skillsCommand(args);
      return;
    case 'gc':
      await gcCommand(args);
      return;
    case 'update':
      await updateCommand(args);
      return;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      process.stdout.write(helpText());
      return;
    default:
      throw new Error(`Unknown command: ${args.command}`);
  }
}

function helpText() {
  return `review-tour

Commands:
  generate [--base origin/main] [--head HEAD] [--mode base...head|working-tree|staged|custom] [--no-open] [--json]
  collect --json [--base origin/main] [--head HEAD] [--mode base...head|working-tree|staged|custom]
  write --draft <path> --chapters <path> [--open] [--json]
  open [latest|tourId] [--json]
  serve [--port 4378]
  skills list|get
  gc [--days 30] [--keep 20] [--all]
  update
`;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
