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
chapters, and then write the official artifact:

```bash
review-tour collect --json
review-tour write --draft <draft.json> --chapters <chapters.json> --open --json
```

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

- unknown hunk IDs
- empty chapters
- uncovered hunks
- invalid repo hash or tour ID
- invalid artifact schema

Unknown hunk IDs are hard errors. Uncovered hunks are repaired by fallback chapter generation plus an `LLM_PARTIAL_COVERAGE` warning.

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
