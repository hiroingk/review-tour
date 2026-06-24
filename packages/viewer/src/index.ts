import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getDefaultReviewTourCacheDir,
  getSafeErrorMessage,
  type ViewerOptions,
} from './tourCache.js';
import { REVIEW_TOUR_CACHE_DIR_HEADER } from './server/api.js';
export { getChapterDiffFiles } from './reviewModel.js';
export {
  getDefaultReviewTourCacheDir,
  listTours,
  readTourFromCache,
  type ListedTour,
  type ReadTourOptions,
  type ViewerOptions,
} from './tourCache.js';

export const DEFAULT_VIEWER_HOST = '127.0.0.1';
export const DEFAULT_VIEWER_PORT = 4378;
export const VIEWER_HEALTH_PATH = '/__review-tour-health';
export const VIEWER_UI_VERSION = 'tanstack-start-v1';

export function createViewerServer(options: ViewerOptions = {}) {
  const cacheDir = options.cacheDir ?? getDefaultReviewTourCacheDir();

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url ?? '/',
        `http://${request.headers.host ?? `${DEFAULT_VIEWER_HOST}:${DEFAULT_VIEWER_PORT}`}`,
      );

      if (requestUrl.pathname === VIEWER_HEALTH_PATH) {
        sendJson(response, 200, {
          name: 'review-tour-viewer',
          schemaVersion: 'review-tour/v1',
          uiVersion: VIEWER_UI_VERSION,
        });
        return;
      }

      if (await sendStaticAsset(requestUrl, response)) {
        return;
      }

      await renderStartApp(request, response, cacheDir);
    } catch (error) {
      sendHtml(response, 500, renderErrorPage(getSafeErrorMessage(error)));
    }
  });
}

export async function listenViewerServer(
  server: Server,
  options: { host?: string; port?: number } = {},
) {
  const host = options.host ?? DEFAULT_VIEWER_HOST;
  const port = options.port ?? DEFAULT_VIEWER_PORT;
  await mkdir(getDefaultReviewTourCacheDir(), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function renderStartApp(
  request: IncomingMessage,
  response: ServerResponse,
  cacheDir: string,
) {
  const serverEntryPath = path.join(getAppDistDir(), 'server', 'server.js');

  try {
    await stat(serverEntryPath);
  } catch {
    sendHtml(response, 500, renderErrorPage('Viewer app build not found. Run `vp build` first.'));
    return;
  }

  const entry = (await import(pathToFileURL(serverEntryPath).href)) as {
    default: { fetch: (request: Request) => Promise<Response> };
  };
  const webRequest = createWebRequest(request, cacheDir);
  const webResponse = await entry.default.fetch(webRequest);
  await sendWebResponse(response, webResponse, request.method === 'HEAD');
}

function createWebRequest(request: IncomingMessage, cacheDir: string) {
  const origin = `http://${request.headers.host ?? `${DEFAULT_VIEWER_HOST}:${DEFAULT_VIEWER_PORT}`}`;
  const url = new URL(request.url ?? '/', origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  headers.set(REVIEW_TOUR_CACHE_DIR_HEADER, cacheDir);

  return new Request(url, {
    headers,
    method: request.method ?? 'GET',
  });
}

async function sendWebResponse(response: ServerResponse, webResponse: Response, omitBody: boolean) {
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  if (omitBody || !webResponse.body) {
    response.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  response.end(body);
}

async function sendStaticAsset(requestUrl: URL, response: ServerResponse) {
  if (!isClientAssetPath(requestUrl.pathname)) {
    return false;
  }

  const clientDir = path.join(getAppDistDir(), 'client');
  const assetPath = safeResolve(clientDir, decodeURIComponent(requestUrl.pathname));
  if (!assetPath) {
    return false;
  }

  try {
    const assetStat = await stat(assetPath);
    if (!assetStat.isFile()) {
      return false;
    }
  } catch {
    return false;
  }

  response.writeHead(200, {
    'content-type': getContentType(assetPath),
    'cache-control': requestUrl.pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
  });
  createReadStream(assetPath).pipe(response);
  return true;
}

function isClientAssetPath(pathname: string) {
  return (
    pathname.startsWith('/assets/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/logo192.png' ||
    pathname === '/logo512.png'
  );
}

function safeResolve(root: string, pathname: string) {
  const resolved = path.resolve(root, pathname.replace(/^\/+/, ''));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

function getAppDistDir() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  if (path.basename(moduleDir) === 'lib') {
    return path.resolve(moduleDir, '..');
  }
  return path.resolve(moduleDir, '..', 'dist');
}

function getContentType(filePath: string) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function sendHtml(response: ServerResponse, statusCode: number, body: string) {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function renderErrorPage(message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review Tour Error</title>
    <style>
      :root {
        color-scheme: dark;
        --page: #050505;
        --text: #e7e2dc;
        --muted: #aaaaaa;
      }
      @media (prefers-color-scheme: light) {
        :root {
          color-scheme: light;
          --page: #f7f7f4;
          --text: #191715;
          --muted: #6d6760;
        }
      }
      body { margin: 0; background: var(--page); color: var(--text); font-family: ui-sans-serif, system-ui, sans-serif; }
      main { max-width: 720px; margin: 64px auto; padding: 0 24px; }
      p { color: var(--muted); }
    </style>
  </head>
  <body>
    <main>
      <h1>Review Tour Error</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
