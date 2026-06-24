import { createViewerServer, DEFAULT_VIEWER_HOST, DEFAULT_VIEWER_PORT } from '@review-tour/viewer';
import { getNumberOption, type ParsedArgs } from '../cliArgs.js';

export async function serveCommand(args: ParsedArgs) {
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
