import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageManifest = {
  name?: string;
  version?: string;
  engines?: {
    node?: string;
  };
};

export type PackageRoot = {
  dir: string;
  manifest: PackageManifest;
};

let cachedPackageRoot: PackageRoot | null | undefined;

export function getPackageRoot(): PackageRoot | undefined {
  if (cachedPackageRoot !== undefined) {
    return cachedPackageRoot ?? undefined;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Repo checkout and published package: packages/cli/{src,dist} -> package root.
    path.resolve(moduleDir, '../../../package.json'),
    // Fallback: the internal @review-tour/cli package manifest.
    path.resolve(moduleDir, '../package.json'),
  ];

  for (const candidate of candidates) {
    try {
      const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as PackageManifest;
      if (typeof manifest.version === 'string' && manifest.version.length > 0) {
        cachedPackageRoot = { dir: path.dirname(candidate), manifest };
        return cachedPackageRoot;
      }
    } catch {
      // Try the next package layout.
    }
  }

  cachedPackageRoot = null;
  return undefined;
}

export function getCliVersion(): string {
  return getPackageRoot()?.manifest.version ?? '0.0.0';
}

export function getRequiredNodeRange(): string | undefined {
  return getPackageRoot()?.manifest.engines?.node;
}
