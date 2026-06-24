import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const viewerRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultDistDir = path.join(viewerRoot, 'dist');
const textExtensions = new Set(['.css', '.html', '.js', '.json']);

export async function sanitizeViewerDist(options = {}) {
  const distDir = path.resolve(options.distDir ?? defaultDistDir);
  const sourceRoot = path.resolve(options.sourceRoot ?? viewerRoot);
  const normalizedSourceRoot = normalizePath(sourceRoot);
  const files = await collectTextFiles(distDir);
  let changedFiles = 0;

  for (const file of files) {
    const original = await readFile(file, 'utf8');
    const sanitized = sanitizeText(original, normalizedSourceRoot);
    if (sanitized !== original) {
      await writeFile(file, sanitized, 'utf8');
      changedFiles += 1;
    }
  }

  const remaining = await findRemainingSourcePaths(files, normalizedSourceRoot);
  if (remaining.length > 0) {
    throw new Error(
      `Viewer dist still contains local source paths:\n${remaining
        .map((file) => `  ${path.relative(distDir, file)}`)
        .join('\n')}`,
    );
  }

  return { changedFiles, filesScanned: files.length };
}

function sanitizeText(text, normalizedSourceRoot) {
  return text.split(`${normalizedSourceRoot}/`).join('').split(normalizedSourceRoot).join('.');
}

async function collectTextFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return files;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

async function findRemainingSourcePaths(files, normalizedSourceRoot) {
  const remaining = [];
  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    if (contents.includes(normalizedSourceRoot)) {
      remaining.push(file);
    }
  }
  return remaining;
}

function normalizePath(filePath) {
  return path.resolve(filePath).split(path.sep).join('/');
}

async function main() {
  await mkdir(defaultDistDir, { recursive: true });
  await sanitizeViewerDist();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
