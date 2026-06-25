# Review Tour Agent Guide

Review Tour is a CLI + local viewer + distributable agent skill. Keep those three surfaces aligned whenever behavior changes.

## Package Manager

Use `pnpm` for installs, scripts, builds, and release packing. This matters because `pnpm pack` rewrites `workspace:*` and catalog dependencies to concrete versions for publishable tarballs.

Required runtime: Node.js `>=22.12.0`, pnpm `10`.

## Architecture Boundaries

- `review-tour` is the root npm CLI package. It publishes `bin/review-tour.js`, compiled CLI files under `packages/cli/dist`, `skill-data/`, and `skills/`.
- `@review-tour/schema` owns the artifact types and validation.
- `@review-tour/viewer` owns the localhost TanStack Start viewer.
- `@review-tour/cli` is an internal workspace package. Do not treat it as the public npm entrypoint.
- Runtime review artifacts must be written to the OS cache, never into the reviewed repository.
- The viewer must read artifacts only by `repoHash` and `tourId`; do not add URL-driven arbitrary file path reads.
- The viewer server should bind to `127.0.0.1` unless a deliberate security review changes that.

## Skill Distribution

This repo follows the same CLI + skill pattern as `vercel-labs/agent-browser`:

- `skills/review-tour/SKILL.md` is a thin distribution stub.
- Real workflow instructions live in `skill-data/core/SKILL.md`.
- The CLI serves version-matched skill instructions with `review-tour skills get core`.
- When the review workflow changes, update `skill-data/core/SKILL.md`; keep the stub short and stable.
- Keep `skills/review-tour/agents/openai.yaml` aligned with the public skill name and purpose.

Run `pnpm run skills:check` after changing `skills/`, `skill-data/`, or `review-tour skills`.

## CLI Changes

When adding or changing CLI behavior:

- Update `packages/cli/src/index.ts` help text.
- Add or update tests under `packages/cli/test`.
- Keep JSON output stable for commands that support `--json`.
- Prefer explicit validation errors over silent fallbacks.
- For generated review chapters, use existing hunk IDs only.
- Do not add static HTML, Markdown, or custom JSON fallback viewers. The supported viewer path is the official artifact plus localhost viewer.

Useful checks:

```bash
pnpm --filter @review-tour/cli build
node bin/review-tour.js skills list
node bin/review-tour.js skills get core
```

## Viewer Changes

When changing viewer behavior:

- Keep source changes in `packages/viewer/src`; do not hand-edit `packages/viewer/dist`.
- Use existing UI primitives in `packages/viewer/src/components/ui` before introducing new component patterns.
- Preserve keyboard, mobile, and split-diff usability.
- Keep code syntax colors available for highlighting; avoid overriding code token colors broadly.
- Validate visual loading states with the existing COSS UI skeleton components where loading UI is needed.

## Schema And Artifact Changes

If the artifact shape changes:

- Update `packages/schema/src/reviewTourSchema.ts`.
- Update schema tests.
- Update CLI `collect`, `write`, or `generate` code that produces or validates the artifact.
- Update viewer code that reads the artifact.
- Update `skill-data/core/SKILL.md` if agents must produce new JSON fields.

## Documentation Surfaces

Public documentation lives in `README.md`, `skills/`, and `skill-data/`.

The `docs/` directory is local planning material and is ignored. Do not rely on it as public documentation.

When behavior changes, update every public surface that users or agents will see:

- `README.md`
- CLI help text
- `skill-data/core/SKILL.md`
- `skills/review-tour/SKILL.md` only when the distribution stub itself changes

## Release Checks

Before treating packaging work as complete, run:

```bash
pnpm run check
pnpm run test
pnpm run build
pnpm run skills:check
```

For release layout changes, also verify the publishable tarballs:

```bash
pnpm pack
pnpm --dir packages/schema pack
pnpm --dir packages/viewer pack
```

The root tarball must include:

- `bin/review-tour.js`
- `packages/cli/dist`
- `skills/review-tour/SKILL.md`
- `skill-data/core/SKILL.md`

Install the packed tarballs into a temporary project when changing package metadata or runtime dependencies, then run:

```bash
./node_modules/.bin/review-tour skills list
./node_modules/.bin/review-tour skills get core
```

## Style

- Keep public repo text in English.
- Write pull request titles and descriptions in English. Do not use `[codex]` in pull request titles.
- Do not add emoji to CLI output, README text, or skill instructions.
- Keep command examples copy-pasteable.
- Prefer concise docs that point to the authoritative command or file.
- Preserve generated files by regenerating them through the normal build commands.
