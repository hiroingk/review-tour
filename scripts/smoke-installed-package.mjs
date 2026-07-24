#!/usr/bin/env node
// Builds confidence in the publishable package by installing its tarball into
// an isolated prefix, then exercising the bundled skill, CLI, cache, and viewer.
// Usage: pnpm run test:smoke:install
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageManifest = await readJson(path.join(repoRoot, 'package.json'));
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'review-tour-smoke-'));
const packDir = path.join(tempRoot, 'pack');
const installPrefix = path.join(tempRoot, 'prefix');
const fixtureRoot = path.join(tempRoot, 'fixture');
const cacheDir = path.join(tempRoot, 'cache');
const draftPath = path.join(tempRoot, 'draft.json');
const chaptersPath = path.join(tempRoot, 'chapters.json');
const npmCacheDir = process.env.REVIEW_TOUR_SMOKE_NPM_CACHE
  ? path.resolve(process.env.REVIEW_TOUR_SMOKE_NPM_CACHE)
  : path.join(repoRoot, 'node_modules', '.cache', 'review-tour-smoke', 'npm');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
const cliPath =
  process.platform === 'win32'
    ? path.join(installPrefix, 'review-tour.cmd')
    : path.join(installPrefix, 'bin', 'review-tour');
const installedPackageDir =
  process.platform === 'win32'
    ? path.join(installPrefix, 'node_modules', 'review-tour')
    : path.join(installPrefix, 'lib', 'node_modules', 'review-tour');
const smokeEnv = {
  ...process.env,
  REVIEW_TOUR_CACHE_DIR: cacheDir,
};

let viewerProcess;
let succeeded = false;

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(npmCacheDir, { recursive: true });

  step('Pack the publishable package');
  run(pnpmCommand, ['pack', '--pack-destination', packDir], {
    cwd: repoRoot,
    env: {
      ...process.env,
      npm_config_ignore_scripts: 'true',
    },
  });

  const tarballPath = path.join(packDir, `${packageManifest.name}-${packageManifest.version}.tgz`);
  await access(tarballPath);

  step('Install the tarball into an isolated global prefix');
  run(
    npmCommand,
    [
      'install',
      '--global',
      '--prefix',
      installPrefix,
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
      tarballPath,
    ],
    {
      env: {
        ...process.env,
        npm_config_cache: npmCacheDir,
      },
    },
  );

  await assertInstalledLayout();

  step('Verify the installed CLI and bundled skill');
  assert.equal(runCli(['version']).trim(), packageManifest.version);

  const skillList = parseJson(runCli(['skills', 'list', '--json']), 'skills list');
  assert.ok(
    skillList.skills?.some((skill) => skill.name === 'core'),
    'Installed skill list does not include core.',
  );

  const coreSkill = runCli(['skills', 'get', 'core']);
  assert.match(coreSkill, /review-tour collect/);
  assert.match(coreSkill, /review-tour write/);

  const skillCheck = parseJson(runCli(['skills', 'check', '--json']), 'skills check');
  assert.equal(skillCheck.ok, true, formatJsonFailure('Bundled skill check failed', skillCheck));

  step('Create a temporary Git repository with a working-tree change');
  await createFixtureRepository();

  const doctor = parseJson(runCli(['doctor', '--json'], { cwd: fixtureRoot }), 'doctor');
  assert.equal(doctor.ok, true, formatJsonFailure('Installed CLI doctor failed', doctor));

  step('Exercise collect, generate, and write using the installed CLI');
  runCli(['collect', '--mode', 'working-tree', '--output', draftPath], { cwd: fixtureRoot });

  const draft = await readJson(draftPath);
  assert.equal(draft.schemaVersion, 'review-tour/v1');
  assert.equal(draft.diff?.mode, 'working-tree');
  assert.equal(draft.diff?.files?.length, 1);
  assert.equal(draft.diff.files[0].path, 'src/example.js');
  assert.ok(draft.diff.files[0].hunks.length > 0, 'Collected draft has no hunks.');

  const generateResult = parseJson(
    runCli(['generate', '--mode', 'working-tree', '--no-open', '--json'], { cwd: fixtureRoot }),
    'generate',
  );
  assertArtifactResult(generateResult, 'generate');

  const generatedArtifact = await readJson(generateResult.artifactPath);
  assert.ok(
    generatedArtifact.tour?.chapters?.length > 0,
    'Generated artifact has no review chapters.',
  );

  await writeFile(
    chaptersPath,
    `${JSON.stringify(
      {
        title: 'Installed package smoke tour',
        summary: 'Exercises the installed collect, write, and viewer workflow.',
        prologue: generatedArtifact.tour.prologue,
        chapters: generatedArtifact.tour.chapters,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const writeResult = parseJson(
    runCli(
      [
        'write',
        '--draft',
        draftPath,
        '--chapters',
        chaptersPath,
        '--generator-mode',
        'codex-skill',
        '--model',
        'local-smoke-test',
        '--json',
      ],
      { cwd: fixtureRoot },
    ),
    'write',
  );
  assertArtifactResult(writeResult, 'write');

  const writtenArtifact = await readJson(writeResult.artifactPath);
  assert.equal(writtenArtifact.tour?.title, 'Installed package smoke tour');
  assert.equal(writtenArtifact.generator?.mode, 'codex-skill');
  assert.equal(writtenArtifact.generator?.model, 'local-smoke-test');

  step('Start the installed viewer and verify its HTTP surfaces');
  const viewerPort = await findAvailablePort();
  const viewerLogs = { stderr: '', stdout: '' };
  viewerProcess = spawn(cliPath, ['serve', '--port', String(viewerPort)], {
    cwd: fixtureRoot,
    env: smokeEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  collectOutput(viewerProcess.stdout, viewerLogs, 'stdout');
  collectOutput(viewerProcess.stderr, viewerLogs, 'stderr');

  const viewerOrigin = `http://127.0.0.1:${viewerPort}`;
  const health = await waitForViewer(viewerOrigin, viewerLogs);
  assert.equal(health.name, 'review-tour-viewer');
  assert.equal(health.schemaVersion, 'review-tour/v1');

  const apiResponse = await fetch(
    `${viewerOrigin}/api/tours/latest?repo=${encodeURIComponent(writeResult.repoHash)}`,
  );
  assert.equal(apiResponse.status, 200, `Viewer API returned HTTP ${apiResponse.status}.`);
  const apiArtifact = await apiResponse.json();
  assert.equal(apiArtifact.id, writeResult.tourId);
  assert.equal(apiArtifact.tour?.title, 'Installed package smoke tour');

  const tourResponse = await fetch(
    `${viewerOrigin}/tours/latest?repo=${encodeURIComponent(writeResult.repoHash)}`,
  );
  assert.equal(tourResponse.status, 200, `Viewer route returned HTTP ${tourResponse.status}.`);
  assert.match(tourResponse.headers.get('content-type') ?? '', /^text\/html\b/);
  const tourHtml = await tourResponse.text();
  assert.doesNotMatch(tourHtml, /Review Tour Error/);

  const assetPath = findAssetPath(tourHtml);
  assert.ok(assetPath, 'Viewer HTML does not reference a JavaScript or CSS asset.');
  const assetResponse = await fetch(new URL(assetPath, viewerOrigin));
  assert.equal(assetResponse.status, 200, `Viewer asset returned HTTP ${assetResponse.status}.`);

  succeeded = true;
  process.stdout.write('\nInstalled package smoke test passed.\n');
} catch (error) {
  process.stderr.write(`\nInstalled package smoke test failed: ${formatError(error)}\n`);
  process.stderr.write(`Temporary files were preserved at ${tempRoot}\n`);
  process.exitCode = 1;
} finally {
  await stopViewer(viewerProcess);
  if (succeeded && process.env.REVIEW_TOUR_SMOKE_KEEP_TEMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  } else if (succeeded) {
    process.stdout.write(`Temporary files were preserved at ${tempRoot}\n`);
  }
}

async function assertInstalledLayout() {
  const requiredPaths = [
    'bin/review-tour.js',
    'packages/cli/dist/index.js',
    'packages/schema/dist/reviewTourSchema.js',
    'packages/viewer/dist/server/server.js',
    'skills/review-tour/SKILL.md',
    'skill-data/core/SKILL.md',
    'skills-manifest.json',
  ];

  await access(cliPath);
  for (const relativePath of requiredPaths) {
    await access(path.join(installedPackageDir, relativePath));
  }
}

async function createFixtureRepository() {
  await mkdir(path.join(fixtureRoot, 'src'), { recursive: true });
  run(gitCommand, ['init', '--initial-branch', 'main'], { cwd: fixtureRoot });
  run(gitCommand, ['config', 'user.email', 'review-tour-smoke@example.com'], {
    cwd: fixtureRoot,
  });
  run(gitCommand, ['config', 'user.name', 'Review Tour Smoke'], { cwd: fixtureRoot });

  const sourcePath = path.join(fixtureRoot, 'src', 'example.js');
  await writeFile(sourcePath, "export const message = 'before';\n", 'utf8');
  run(gitCommand, ['add', 'src/example.js'], { cwd: fixtureRoot });
  run(gitCommand, ['commit', '-m', 'Initial fixture'], { cwd: fixtureRoot });
  await writeFile(sourcePath, "export const message = 'after';\n", 'utf8');
}

function assertArtifactResult(result, commandName) {
  assert.match(result.repoHash ?? '', /^[a-f0-9]{12}$/);
  assert.ok(path.isAbsolute(result.artifactPath ?? ''), `${commandName} returned a relative path.`);
  assertPathInside(cacheDir, result.artifactPath, `${commandName} artifact`);
  assertPathInside(cacheDir, result.latestPath, `${commandName} latest artifact`);

  const relativeToFixture = path.relative(fixtureRoot, result.artifactPath);
  assert.ok(
    relativeToFixture.startsWith('..') || path.isAbsolute(relativeToFixture),
    `${commandName} wrote its artifact inside the reviewed repository.`,
  );
}

function assertPathInside(parentPath, childPath, label) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  assert.ok(
    relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative),
    `${label} is outside ${parentPath}.`,
  );
}

function runCli(args, options = {}) {
  return run(cliPath, args, {
    cwd: options.cwd ?? repoRoot,
    env: smokeEnv,
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed (${result.status}): ${command} ${args.join(' ')}`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result.stdout ?? '';
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} did not return valid JSON: ${formatError(error)}\n${raw}`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Could not allocate a viewer port.');
  const port = address.port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForViewer(origin, logs) {
  const deadline = Date.now() + 10_000;
  let lastError;

  while (Date.now() < deadline) {
    if (viewerProcess?.exitCode !== null) {
      throw new Error(
        `Viewer exited before becoming healthy.\n${logs.stdout}${logs.stderr}`.trim(),
      );
    }

    try {
      const response = await fetch(`${origin}/__review-tour-health`);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`Health endpoint returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(
    [
      `Viewer did not become healthy: ${formatError(lastError)}`,
      logs.stdout.trim(),
      logs.stderr.trim(),
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

function collectOutput(stream, logs, key) {
  stream?.setEncoding('utf8');
  stream?.on('data', (chunk) => {
    logs[key] += chunk;
  });
}

async function stopViewer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2_000)]);

  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

function findAssetPath(html) {
  const match = html.match(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/i);
  return match?.[1];
}

function formatJsonFailure(message, value) {
  return `${message}:\n${JSON.stringify(value, null, 2)}`;
}

function formatError(error) {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function step(message) {
  process.stdout.write(`[smoke] ${message}\n`);
}
