import { spawn } from 'node:child_process';
import http from 'node:http';
import {
  DEFAULT_VIEWER_HOST,
  DEFAULT_VIEWER_PORT,
  VIEWER_HEALTH_PATH,
  VIEWER_UI_VERSION,
} from 'review-tour/viewer';
import { getNumberOption, hasFlag, type ParsedArgs } from '../cliArgs.js';
import { createRepoHash } from '../artifact/store.js';
import { detectRepo } from '../git/detectRepo.js';

export type ViewerLaunchResult = {
  repoHash: string;
  tourId: string;
  url: string;
};

export async function openCommand(args: ParsedArgs) {
  const repo = detectRepo(process.cwd());
  const tourId = args.positionals[0] ?? 'latest';
  const port = getNumberOption(args, 'port') ?? DEFAULT_VIEWER_PORT;
  const repoHash = createRepoHash(repo.root);
  const actualPort = await ensureViewerServer(port);
  const url = createViewerUrl({ repoHash, tourId, port: actualPort });

  if (hasFlag(args, 'json')) {
    process.stdout.write(
      `${JSON.stringify({ repoHash, tourId, port: actualPort, url }, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`${url}\n`);
}

export async function launchViewer(input: {
  repoHash: string;
  tourId: string;
  port?: number;
}): Promise<ViewerLaunchResult> {
  const port = input.port ?? DEFAULT_VIEWER_PORT;
  const actualPort = await ensureViewerServer(port);
  return {
    repoHash: input.repoHash,
    tourId: input.tourId,
    url: createViewerUrl({
      repoHash: input.repoHash,
      tourId: input.tourId,
      port: actualPort,
    }),
  };
}

export function createViewerUrl(input: { repoHash: string; tourId: string; port?: number }) {
  const port = input.port ?? DEFAULT_VIEWER_PORT;
  return `http://${DEFAULT_VIEWER_HOST}:${port}/tours/${encodeURIComponent(
    input.tourId,
  )}?repo=${encodeURIComponent(input.repoHash)}`;
}

async function ensureViewerServer(preferredPort: number) {
  const maxAttempts = 20;
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferredPort + offset;
    if (await isViewerHealthy(port)) {
      return port;
    }

    if (await isServerListening(port)) {
      continue;
    }

    await startViewerServer(port);
    if (await waitForHealthyViewer(port)) {
      return port;
    }
  }

  throw new Error(
    `Viewer server did not start on ${DEFAULT_VIEWER_HOST}:${preferredPort}-${preferredPort + maxAttempts - 1}.`,
  );
}

async function startViewerServer(port: number) {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    throw new Error('Could not determine CLI entrypoint for viewer server.');
  }

  const child = spawn(process.execPath, [scriptPath, 'serve', '--port', String(port)], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function waitForHealthyViewer(port: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await isViewerHealthy(port)) {
      return true;
    }
    await sleep(100);
  }

  return false;
}

function isViewerHealthy(port: number) {
  return new Promise<boolean>((resolve) => {
    const request = http.get(
      {
        host: DEFAULT_VIEWER_HOST,
        port,
        path: VIEWER_HEALTH_PATH,
        timeout: 300,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve(
            response.statusCode === 200 &&
              body.includes('"name":"review-tour-viewer"') &&
              body.includes('"schemaVersion":"review-tour/v1"') &&
              body.includes(`"uiVersion":"${VIEWER_UI_VERSION}"`),
          );
        });
      },
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function isServerListening(port: number) {
  return new Promise<boolean>((resolve) => {
    const request = http.get(
      {
        host: DEFAULT_VIEWER_HOST,
        port,
        path: '/',
        timeout: 300,
      },
      (response) => {
        response.resume();
        resolve(true);
      },
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
