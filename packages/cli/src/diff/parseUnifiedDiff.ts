import type { DiffFile, DiffHunk, DiffLine, ReviewWarning } from 'review-tour/schema';
import { createHunkId, sha256 } from './createHunkIds.js';

type MutableFile = Omit<DiffFile, 'id' | 'hunks'> & {
  id?: string;
  hunks: MutableHunk[];
};

type MutableHunk = Omit<DiffHunk, 'id' | 'fileId' | 'patchHash'> & {
  id?: string;
  fileId?: string;
  patchHash?: string;
  rawLines: string[];
};

export type ParsedUnifiedDiff = {
  files: DiffFile[];
  warnings: ReviewWarning[];
};

export function parseUnifiedDiff(unifiedDiff: string): ParsedUnifiedDiff {
  const files: MutableFile[] = [];
  const warnings: ReviewWarning[] = [];
  let currentFile: MutableFile | null = null;
  let currentHunk: MutableHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  const finishHunk = () => {
    if (!currentFile || !currentHunk) {
      return;
    }

    const patch = currentHunk.rawLines.join('\n');
    currentHunk.patchHash = sha256(patch);
    currentHunk.id = createHunkId({
      path: currentFile.path,
      oldStart: currentHunk.oldStart,
      oldLines: currentHunk.oldLines,
      newStart: currentHunk.newStart,
      newLines: currentHunk.newLines,
      patch,
    });
    currentFile.hunks.push(currentHunk);
    currentHunk = null;
  };

  const finishFile = () => {
    finishHunk();
    if (!currentFile) {
      return;
    }

    currentFile.id = createFileId(currentFile.path, currentFile.oldPath);
    files.push(currentFile);
    currentFile = null;
  };

  const lines = unifiedDiff.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      finishFile();
      const paths = parseDiffGitLine(line);
      currentFile = {
        path: paths?.newPath ?? 'unknown',
        oldPath: paths?.oldPath,
        status: 'modified',
        additions: 0,
        deletions: 0,
        language: inferLanguage(paths?.newPath ?? paths?.oldPath ?? ''),
        hunks: [],
      };
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith('new file mode ')) {
      currentFile.status = 'added';
      continue;
    }

    if (line.startsWith('deleted file mode ')) {
      currentFile.status = 'deleted';
      continue;
    }

    if (line.startsWith('rename from ')) {
      currentFile.oldPath = line.slice('rename from '.length);
      currentFile.status = 'renamed';
      continue;
    }

    if (line.startsWith('rename to ')) {
      currentFile.path = line.slice('rename to '.length);
      currentFile.status = 'renamed';
      currentFile.language = inferLanguage(currentFile.path);
      continue;
    }

    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      warnings.push({
        code: 'BINARY_FILE_SKIPPED',
        message: `Binary file change skipped for ${currentFile.path}.`,
      });
      continue;
    }

    if (line.startsWith('--- ')) {
      const oldPath = normalizeDiffPath(line.slice(4));
      if (oldPath) {
        currentFile.oldPath = oldPath;
      } else {
        currentFile.status = 'added';
      }
      continue;
    }

    if (line.startsWith('+++ ')) {
      const newPath = normalizeDiffPath(line.slice(4));
      if (newPath) {
        currentFile.path = newPath;
        currentFile.language = inferLanguage(newPath);
      } else {
        currentFile.status = 'deleted';
      }
      continue;
    }

    if (line.startsWith('@@ ')) {
      finishHunk();
      const parsedHeader = parseHunkHeader(line);
      if (!parsedHeader) {
        warnings.push({
          code: 'PATCH_TRUNCATED',
          message: `Could not parse hunk header in ${currentFile.path}.`,
        });
        continue;
      }

      currentHunk = {
        oldStart: parsedHeader.oldStart,
        oldLines: parsedHeader.oldLines,
        newStart: parsedHeader.newStart,
        newLines: parsedHeader.newLines,
        header: line,
        lines: [],
        rawLines: [line],
      };
      oldLine = parsedHeader.oldStart;
      newLine = parsedHeader.newStart;
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line.startsWith('\\ No newline at end of file')) {
      currentHunk.rawLines.push(line);
      continue;
    }

    const diffLine = parseDiffLine(line, oldLine, newLine);
    if (!diffLine) {
      continue;
    }

    currentHunk.rawLines.push(line);
    currentHunk.lines.push(diffLine.line);
    oldLine = diffLine.nextOldLine;
    newLine = diffLine.nextNewLine;

    if (diffLine.line.type === 'add') {
      currentFile.additions += 1;
    } else if (diffLine.line.type === 'delete') {
      currentFile.deletions += 1;
    }
  }

  finishFile();

  return {
    files: files.map((file) => toDiffFile(file)),
    warnings,
  };
}

function toDiffFile(file: MutableFile): DiffFile {
  const id = file.id ?? createFileId(file.path, file.oldPath);
  return {
    id,
    path: file.path,
    oldPath: file.oldPath,
    status: file.status,
    language: file.language,
    additions: file.additions,
    deletions: file.deletions,
    hunks: file.hunks.map((hunk) => ({
      id:
        hunk.id ??
        createHunkId({
          path: file.path,
          oldStart: hunk.oldStart,
          oldLines: hunk.oldLines,
          newStart: hunk.newStart,
          newLines: hunk.newLines,
          patch: hunk.rawLines.join('\n'),
        }),
      fileId: id,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      header: hunk.header,
      patchHash: hunk.patchHash ?? sha256(hunk.rawLines.join('\n')),
      lines: hunk.lines,
    })),
  };
}

function parseDiffGitLine(line: string) {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  if (!match) {
    return null;
  }

  return {
    oldPath: unquoteGitPath(match[1] ?? ''),
    newPath: unquoteGitPath(match[2] ?? ''),
  };
}

function parseHunkHeader(line: string) {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) {
    return null;
  }

  return {
    oldStart: Number(match[1]),
    oldLines: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newLines: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function parseDiffLine(
  line: string,
  oldLine: number,
  newLine: number,
): { line: DiffLine; nextOldLine: number; nextNewLine: number } | null {
  const marker = line[0];
  const content = line.slice(1);

  if (marker === ' ') {
    return {
      line: {
        type: 'context',
        oldLine,
        newLine,
        content,
      },
      nextOldLine: oldLine + 1,
      nextNewLine: newLine + 1,
    };
  }

  if (marker === '+') {
    return {
      line: {
        type: 'add',
        newLine,
        content,
      },
      nextOldLine: oldLine,
      nextNewLine: newLine + 1,
    };
  }

  if (marker === '-') {
    return {
      line: {
        type: 'delete',
        oldLine,
        content,
      },
      nextOldLine: oldLine + 1,
      nextNewLine: newLine,
    };
  }

  return null;
}

function normalizeDiffPath(rawPath: string) {
  const unquoted = unquoteGitPath(rawPath.trim());
  if (unquoted === '/dev/null') {
    return null;
  }

  return unquoted.replace(/^[ab]\//, '');
}

function unquoteGitPath(rawPath: string) {
  if (rawPath.length >= 2 && rawPath.startsWith('"') && rawPath.endsWith('"')) {
    return rawPath.slice(1, -1);
  }

  return rawPath;
}

function createFileId(filePath: string, oldPath?: string) {
  return `file_${sha256([oldPath ?? '', filePath].join(':')).slice(0, 12)}`;
}

function inferLanguage(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (!extension || extension === filePath) {
    return undefined;
  }

  const byExtension: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    sh: 'shell',
  };

  return byExtension[extension] ?? extension;
}
