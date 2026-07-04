import type { DiffFile } from '@review-tour/schema';

export type SymbolDefinition = {
  content: string;
  fileId: string;
  filePath: string;
  hunkId: string;
  lineNumber: number;
};

export type SymbolIndex = ReadonlyMap<string, readonly SymbolDefinition[]>;

export type SymbolSegment = {
  symbol: boolean;
  text: string;
};

const MIN_SYMBOL_NAME_LENGTH = 2;
const MAX_DEFINITIONS_PER_SYMBOL = 20;

const DEFINITION_PATTERNS: readonly RegExp[] = [
  // JavaScript / TypeScript function declarations.
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  // Class-like declarations across JS/TS, Python, Ruby, Java, Kotlin, Swift.
  /^(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|internal\s+|open\s+|final\s+|abstract\s+|sealed\s+|data\s+)*(?:class|interface|enum|protocol|trait|struct)\s+([A-Za-z_$][\w$]*)/,
  // TypeScript type aliases and Go type declarations.
  /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<\s]/,
  // JS/TS variable bindings.
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/,
  // Python and Ruby function definitions.
  /^(?:async\s+)?def\s+([A-Za-z_]\w*)/,
  // Rust functions and items.
  /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/,
  /^(?:pub(?:\([^)]*\))?\s+)?(?:mod|union)\s+([A-Za-z_]\w*)/,
  // Go and Swift functions, including Go method receivers.
  /^func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)/,
  // Kotlin functions.
  /^(?:override\s+|open\s+|internal\s+|private\s+|public\s+|suspend\s+)*fun\s+(?:<[^>]*>\s+)?([A-Za-z_]\w*)/,
  // Ruby modules.
  /^module\s+([A-Z]\w*)/,
];

const SYMBOL_WORD_PATTERN = /[A-Za-z_$][\w$]*/g;

export function matchSymbolDefinition(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  for (const pattern of DEFINITION_PATTERNS) {
    const match = pattern.exec(trimmed);
    const name = match?.[1];
    if (name && name.length >= MIN_SYMBOL_NAME_LENGTH) {
      return name;
    }
  }

  return null;
}

export function buildSymbolIndex(files: readonly DiffFile[]): SymbolIndex {
  const index = new Map<string, SymbolDefinition[]>();

  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'delete' || line.newLine === undefined) continue;

        const name = matchSymbolDefinition(line.content);
        if (!name) continue;

        const definitions = index.get(name) ?? [];
        if (definitions.length >= MAX_DEFINITIONS_PER_SYMBOL) continue;
        if (
          definitions.some(
            (definition) => definition.fileId === file.id && definition.lineNumber === line.newLine,
          )
        ) {
          continue;
        }

        definitions.push({
          content: line.content,
          fileId: file.id,
          filePath: file.path,
          hunkId: hunk.id,
          lineNumber: line.newLine,
        });
        index.set(name, definitions);
      }
    }
  }

  return index;
}

export function splitSymbolSegments(
  text: string,
  hasSymbol: (name: string) => boolean,
): SymbolSegment[] {
  const segments: SymbolSegment[] = [];
  let cursor = 0;

  SYMBOL_WORD_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(SYMBOL_WORD_PATTERN)) {
    const word = match[0];
    if (word.length < MIN_SYMBOL_NAME_LENGTH || !hasSymbol(word)) continue;

    if (match.index > cursor) {
      segments.push({ symbol: false, text: text.slice(cursor, match.index) });
    }
    segments.push({ symbol: true, text: word });
    cursor = match.index + word.length;
  }

  if (segments.length === 0) return [{ symbol: false, text }];
  if (cursor < text.length) {
    segments.push({ symbol: false, text: text.slice(cursor) });
  }

  return segments;
}
