import { readFile } from 'node:fs/promises';

export async function readJsonFile(filePath: string): Promise<unknown> {
  return parseJson(await readFile(filePath, 'utf8'), filePath);
}

export async function readJsonInput(
  inputPath: string,
  options: { stdin?: AsyncIterable<Buffer | string> } = {},
): Promise<unknown> {
  if (inputPath === '-') {
    return parseJson(await readAll(options.stdin ?? process.stdin), 'stdin');
  }

  return readJsonFile(inputPath);
}

function parseJson(input: string, source: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${source}`);
    }
    throw error;
  }
}

async function readAll(input: AsyncIterable<Buffer | string>) {
  let output = '';
  for await (const chunk of input) {
    output += chunk.toString();
  }
  return output;
}
