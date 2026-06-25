import { runGit } from './runGit.js';

export function listRemoteUrls(repoRoot: string) {
  const output = runGit(['remote', '-v'], { cwd: repoRoot, allowFailure: true });
  if (!output) {
    return [];
  }

  const urls = new Set<string>();
  for (const line of output.split('\n')) {
    const fields = line.trim().split(/\s+/);
    if (fields[1]) {
      urls.add(fields[1]);
    }
  }

  return [...urls];
}

export function parseGitHubRepository(input: string): string | null {
  const trimmed = input.trim();
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i,
    /^git@github\.com:([^/]+)\/([^/#?]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?$/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match) {
      return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
    }
  }

  return null;
}

export function getLocalGitHubRepositories(repoRoot: string) {
  return listRemoteUrls(repoRoot)
    .map((remoteUrl) => parseGitHubRepository(remoteUrl))
    .filter((repository): repository is string => Boolean(repository));
}
