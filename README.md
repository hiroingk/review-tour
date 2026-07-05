# Review Tour

<img width="2434" height="1574" alt="review-tour-thumbnail" src="https://github.com/user-attachments/assets/81ab6111-39a9-4ff4-94bc-3a607938847c" />

Review Tour turns local git diffs into guided, browser-based review tours.
It is designed for reviewing AI-generated or branch-sized changes by moving from
high-level chapters to the exact files and hunks that need attention.

[Review Tour Website](https://hiroingk.github.io/review-tour/)

[![skills.sh](https://skills.sh/b/hiroingk/review-tour)](https://skills.sh/hiroingk/review-tour)

Install the agent skill once, then ask Codex or Claude Code to open the current
diff as a guided review tour. The agent uses the `review-tour` npm package and
local viewer under the hood, so day-to-day usage starts from your coding agent
rather than from CLI flags.

## Highlights

- Review the current branch, staged changes, or working tree from Codex or
  Claude Code.
- Open an interactive local viewer with AI-authored chapters, file navigation,
  and diff review.
- Keep runtime artifacts out of the reviewed repository.
- Keep the CLI, viewer, schema, and skill instructions version-aligned through
  the npm package.
- Serve the viewer on `127.0.0.1` and validate artifact identifiers before reading.

## Requirements

- Node.js `>=22.12.0`
- Git
- Codex or Claude Code
- GitHub CLI (`gh`) for GitHub pull request URLs

pnpm `10` is only required when developing this repository from source.

## Quick Start

Install the agent skill from the GitHub source:

```bash
npx skills add hiroingk/review-tour
```

Install the public npm package that provides the CLI and local viewer:

```bash
npm install -g review-tour
```

The skill command uses the GitHub repository as its source. The npm package name
is `review-tour`.

From the repository you want to review, invoke the skill for your agent:

```text
Codex: $review-tour
Claude Code: /review-tour
```

## Updating

Update the CLI, viewer, schema, and bundled skill workflow:

```bash
review-tour update
```

Update the installed skill stub:

```bash
npx skills update review-tour
```

## How It Works

Review Tour has three pieces:

- `review-tour`: the npm CLI package used by agents. It also bundles the viewer and schema runtime.
- `packages/viewer`: the local browser UI opened by the CLI.
- `skills/review-tour`: the agent-facing skill stub.

The installed skill loads versioned workflow instructions from the installed CLI
with `review-tour skills get core`. This keeps the agent workflow aligned with
the CLI, viewer, and artifact schema you have installed.

By default, the skill reviews the collected diff, creates AI-authored chapters,
stores the official artifact in the OS cache, and opens the local viewer.

## Manual CLI Usage

Most users do not need to run the CLI directly. These commands are useful for
debugging, scripting, or developing Review Tour itself.

Run the CLI from the git repository you want to review:

```bash
cd /path/to/your/git-repo
review-tour generate
```

By default, Review Tour infers the most useful diff mode, writes the artifact to
the OS cache, starts the local viewer if needed, and prints a URL.

Open the latest generated tour again:

```bash
review-tour open latest
```

Review unstaged working tree changes:

```bash
review-tour generate --mode working-tree
```

Review staged changes:

```bash
review-tour generate --mode staged
```

Review a branch-like diff against an explicit base:

```bash
review-tour generate --base origin/main --head HEAD --mode base...head
```

Review a GitHub pull request without checking it out:

```bash
review-tour generate --pr https://github.com/owner/repo/pull/123
```

Generate without opening the browser and print machine-readable output:

```bash
review-tour generate --no-open --json
```

## CLI Commands

```text
review-tour generate [--pr <url|number>] [--base origin/main] [--head HEAD] [--mode base...head|working-tree|staged|custom] [--no-open] [--json]
review-tour collect --json [--pr <url|number>] [--base origin/main] [--head HEAD] [--mode base...head|working-tree|staged|custom]
review-tour write --draft <path|-> --chapters <path|-> [--open] [--json]
review-tour open [latest|tourId] [--json]
review-tour serve [--port 4378]
review-tour skills list|get|check
review-tour doctor [--json]
review-tour gc [--days 30] [--keep 20] [--all]
review-tour update
review-tour version
```

### `generate`

Collects the diff, creates deterministic file-based chapters, validates the
artifact, stores it in the OS cache, and opens the viewer by default.

### `collect`

Collects repository metadata, base branch information, parsed diff files, hunks,
and hunk IDs. With `--pr`, it uses the GitHub CLI to collect a pull request diff
without checking it out. This command emits a draft JSON payload that can be used
by tools or skills to create custom chapters.

### `write`

Merges a collected draft with a chapters JSON file, validates hunk coverage,
writes the final artifact, and optionally opens the viewer. Use `-` for either
input to read that JSON from stdin, such as `--chapters -` to pass AI-authored
chapters without writing a temporary chapters file.

### `open`

Starts the viewer server if needed and opens an existing artifact, such as
`latest` or a specific tour ID.

### `serve`

Runs the local viewer host on `127.0.0.1`. The default port is `4378`.

### `skills`

Prints versioned skill content bundled with the installed CLI:

```bash
review-tour skills list
review-tour skills get core
```

Verify that the bundled skill content matches the shipped manifest:

```bash
review-tour skills check
```

### `doctor`

Checks the local environment: Node.js version, git, the current repository,
cache directory writability, bundled skill data, and the GitHub CLI.

```bash
review-tour doctor
review-tour doctor --json
```

With `--json`, `doctor` always exits `0`; read the `ok` field in the payload.
Without `--json`, it exits `1` when a check fails.

### `gc`

Removes old cached review artifacts. Use `--all` to clear the entire Review
Tour cache directory.

### `update`

Updates the globally installed `review-tour` npm package to the latest version.
The viewer, schema, and bundled skill data are npm dependencies of the CLI
package, so they are updated together.

## Development Installation

Clone the repository and link the local CLI while developing Review Tour:

```bash
git clone https://github.com/hiroingk/review-tour.git
cd review-tour
pnpm install
pnpm run install:local
```

The install script places the `review-tour` command in `~/.local/bin`. If that
directory is not on your `PATH`, add it:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

After changing CLI, viewer, or bundled skill workflow code, rerun:

```bash
pnpm run install:local
```

That rebuilds the packages and refreshes the `~/.local/bin/review-tour` symlink,
so any repository on the same machine can use the latest local CLI:

```bash
cd /path/to/another/git-repo
review-tour --help
```

If you change the distributed skill stub under `skills/`, reinstall the local
skill as well:

```bash
npx skills add /path/to/review-tour
```

For local distribution checks while developing this repository:

```bash
pnpm run skills:check
```

## How Artifacts Work

Review artifacts are written to the OS cache, not to the repository being
reviewed. The viewer reads artifacts by repository hash and tour ID:

```text
http://127.0.0.1:4378/tours/latest?repo=<repoHash>
```

The viewer does not accept arbitrary filesystem paths from URL input.

## Base Branch Detection

When `--base` is not provided, the CLI infers a base branch from the current git
state. It prefers the current branch upstream, common default branches such as
`origin/main`, and finally a fallback commit. If the inferred base has already
been merged into a default branch candidate, the CLI updates the base to that
merged target.

Inferred bases are recorded as `BASE_BRANCH_GUESSED` warnings in the artifact.

## Architecture

```text
Codex / Claude Code skill or user
  -> review-tour CLI
     -> git diff collection
     -> artifact validation and cache write
     -> localhost viewer
        -> TanStack Start UI and API routes
```

Workspace packages:

- `@review-tour/schema`: shared artifact schema and validation
- `@review-tour/cli`: command-line interface
- `@review-tour/viewer`: local browser viewer

## Development

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm run dev
```

Run checks:

```bash
pnpm run check
pnpm run test
pnpm run build
```

Before opening a pull request, run:

```bash
pnpm run verify
```

`pnpm run build` builds the TanStack Start viewer, CLI, and schema packages.

## Release Layout

Review Tour follows the CLI + skill layout used by projects such as
`vercel-labs/agent-browser`:

- `review-tour`: the npm CLI package. It includes `bin/review-tour.js`,
  the compiled CLI, schema runtime, viewer runtime, `skills/`, and `skill-data/`.
- `@review-tour/schema`: private workspace package for shared artifact schema and validation.
- `@review-tour/viewer`: private workspace package for the localhost viewer used by the CLI.

Use pnpm for release packing so `workspace:*` and catalog dependencies are
converted to concrete package versions:

```bash
pnpm pack
```

## Releasing

All packages share one version. To cut a release:

```bash
pnpm run changelog:draft
pnpm run set-version 0.2.0
git commit -am "Release v0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

Pushing the tag runs the publish workflow, which verifies the tag matches
`package.json`, runs the full verification suite, packs the publishable root
tarball with pnpm, and publishes `review-tour` to npm through trusted publishing
with OIDC. Configure the `review-tour` package on npmjs.com with GitHub Actions
as the trusted publisher for `hiroingk/review-tour`, workflow file
`publish.yml`, no environment name, and the `npm publish` action allowed before
cutting a release. Pre-release versions such as `0.2.0-beta.1` publish under
the matching npm dist-tag instead of `latest`.

## Security

Review Tour is intended for local review workflows.

- The viewer binds to `127.0.0.1` by default.
- Runtime artifacts are stored in the OS cache.
- Artifacts should not be committed to the reviewed repository.
- The viewer validates `repoHash` and `tourId` before reading cached artifacts.
- Generated artifacts may include source code from diffs; avoid generating tours
  for changes containing secrets.

See [`SECURITY.md`](SECURITY.md) for reporting guidance.

## Contributing

Issues and pull requests are welcome. Please keep changes focused, update tests
when behavior changes, and run `pnpm run verify` before requesting review.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for details.

## License

Apache License 2.0
