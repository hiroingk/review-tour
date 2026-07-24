import { createViewerServer, DEFAULT_VIEWER_HOST, DEFAULT_VIEWER_PORT } from 'review-tour/viewer';
import {
  assertAllowedOptions,
  assertBooleanOptions,
  assertNoPositionals,
  assertStringOptions,
  getNumberOption,
  hasFlag,
  type ParsedArgs,
} from '../cliArgs.js';

export async function serveCommand(args: ParsedArgs) {
  validateServeArgs(args);
  if (hasFlag(args, 'help')) {
    process.stdout.write(serveHelpText());
    return;
  }

  const port = getNumberOption(args, 'port') ?? DEFAULT_VIEWER_PORT;
  const server = createViewerServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, DEFAULT_VIEWER_HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });

  process.stdout.write(`Review Tour viewer listening on http://${DEFAULT_VIEWER_HOST}:${port}\n`);
}

export function validateServeArgs(args: ParsedArgs) {
  assertNoPositionals(args, 'serve');
  assertAllowedOptions(args, 'serve', ['help', 'port']);
  assertBooleanOptions(args, ['help']);
  assertStringOptions(args, ['port']);
}

function serveHelpText() {
  return `review-tour serve

Usage:
  review-tour serve [--port 4378]

Runs the viewer server on 127.0.0.1 until the process stops.
`;
}
