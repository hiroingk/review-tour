import { execFileSync } from 'node:child_process';

export type PullRequestInfo = {
  additions?: number;
  author?: string;
  baseRefName: string;
  baseRefOid?: string;
  body?: string;
  changedFiles?: number;
  deletions?: number;
  headRefName: string;
  headRefOid: string;
  headRepository?: string;
  isCrossRepository?: boolean;
  number: number;
  title: string;
  url: string;
};

const prJsonFields = [
  'additions',
  'author',
  'baseRefName',
  'baseRefOid',
  'body',
  'changedFiles',
  'deletions',
  'headRefName',
  'headRefOid',
  'headRepository',
  'isCrossRepository',
  'number',
  'title',
  'url',
];

export function readPullRequest(selector: string) {
  const viewJson = runGh(['pr', 'view', selector, '--json', prJsonFields.join(',')]);
  const info = parsePullRequestInfo(viewJson);
  const unifiedDiff = runGh(['pr', 'diff', selector, '--patch', '--color', 'never']);

  return { info, unifiedDiff };
}

export function parsePullRequestInfo(raw: string): PullRequestInfo {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Could not parse GitHub pull request metadata.');
  }

  const value = asRecord(parsed);
  if (!value) {
    throw new Error('GitHub pull request metadata must be an object.');
  }

  const number = expectNumber(value.number, 'pull request number');
  const title = expectString(value.title, 'pull request title');
  const url = expectString(value.url, 'pull request URL');
  const baseRefName = expectString(value.baseRefName, 'pull request base ref');
  const headRefName = expectString(value.headRefName, 'pull request head ref');
  const headRefOid = expectString(value.headRefOid, 'pull request head SHA');

  return {
    additions: optionalNumber(value.additions),
    author: parseAuthor(value.author),
    baseRefName,
    baseRefOid: optionalString(value.baseRefOid),
    body: optionalString(value.body),
    changedFiles: optionalNumber(value.changedFiles),
    deletions: optionalNumber(value.deletions),
    headRefName,
    headRefOid,
    headRepository: parseHeadRepository(value.headRepository),
    isCrossRepository: optionalBoolean(value.isCrossRepository),
    number,
    title,
    url,
  };
}

export function parseGitHubPullRequestUrl(input: string) {
  const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/i.exec(
    input.trim(),
  );
  if (!match) {
    return null;
  }

  return {
    number: Number(match[3]),
    repository: `${match[1].toLowerCase()}/${match[2].toLowerCase()}`,
  };
}

function runGh(args: string[]) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      throw new Error('GitHub PR review requires the GitHub CLI (`gh`) on PATH.');
    }
    throw error;
  }
}

function parseAuthor(value: unknown) {
  const author = asRecord(value);
  return author ? optionalString(author.login) : undefined;
}

function parseHeadRepository(value: unknown) {
  const repository = asRecord(value);
  return repository ? optionalString(repository.nameWithOwner) : undefined;
}

function expectString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing ${label} in GitHub pull request metadata.`);
  }
  return value;
}

function expectNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Missing ${label} in GitHub pull request metadata.`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCommandNotFoundError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
