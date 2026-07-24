# Review Tour System Contract

## Artifact Boundary

Artifacts must live in OS cache, not in the repository.

```text
{cacheDir}/repos/{repoHash}/metadata.json
{cacheDir}/repos/{repoHash}/tours/latest.json
{cacheDir}/repos/{repoHash}/tours/{tourId}.json
```

`repoHash` is `sha256(repoRoot).slice(0, 12)`.

## CLI Contract

The skill's default path must collect the diff, create AI-authored review
chapters with file-level review groups, and then write the official artifact:

```bash
review-tour collect --mode working-tree --include-untracked --output <draft.json>
review-tour write --draft <draft.json> --chapters <chapters.json> --open --json
```

The agent workflow stores the full collected draft under the OS temporary
directory instead of emitting it to stdout. `--include-untracked` ensures a
working-tree review includes non-ignored files that are not in Git yet.
Without that flag, collection must record an `UNTRACKED_FILES_SKIPPED` warning
instead of silently omitting those files.

The one-command deterministic path is a fallback only when AI chapter generation
fails:

```bash
review-tour generate --json
```

`collect` owns git and diff parsing. `write` owns validation, cache persistence, viewer startup, and URL output.

If the `review-tour` CLI is unavailable, the skill must stop and report the setup
problem. It must not create custom static HTML, Markdown, JSON, or other
substitute review artifacts.

## Validation Contract

The CLI must reject or repair invalid artifacts before the viewer opens:

- unknown chapter or review group hunk IDs
- empty chapters or review groups with no hunk IDs
- uncovered chapter hunks or file hunks not assigned to a review group
- duplicate review group IDs or hunk assignments within a file
- review groups that reference non-contiguous hunks
- invalid repo hash or tour ID
- invalid artifact schema

Unknown hunk IDs, authored group entries with no hunk IDs, duplicate group IDs
or assignments, and non-contiguous group assignments are hard errors. Uncovered chapter hunks are
repaired by fallback chapter generation plus an `LLM_PARTIAL_COVERAGE` warning.
When a file includes authored groups, hunks not assigned to one are repaired
with deterministic `Additional changes` groups.

`ReviewChapterFile.groups` remains optional in `review-tour/v1` so older cached
artifacts stay readable. The normal AI-authored workflow must include at least
one group for every file entry. Each group uses only existing hunk IDs from that
file, contains contiguous hunks in display order, does not overlap another group,
and collectively covers every hunk in the file entry.

`--open` starts or reuses the localhost viewer server and returns its URL. It
does not launch a system browser.

## Viewer Contract

The viewer reads only cache artifacts by `repoHash` and `tourId`. It must never accept arbitrary filesystem paths from URL input.

Allowed URL:

```text
/tours/latest?repo=8f3a1c9b2d4e
```

Disallowed design:

```text
/tour?path=/absolute/path/to/anything.json
```

## Security Rules

- Bind server to `127.0.0.1`.
- Default port: `4378`.
- Validate `repoHash` with `/^[a-f0-9]{12}$/`.
- Validate `tourId` with `/^[a-zA-Z0-9._-]+$/`.
- Schema-validate artifact JSON before returning it to the client.
