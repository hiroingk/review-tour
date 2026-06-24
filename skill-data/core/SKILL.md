---
name: core
description: Core Review Tour workflow. Read this after the review-tour distribution stub. Covers collecting local git diffs, generating AI-authored chapters, writing official viewer artifacts, opening the localhost viewer, and falling back safely when AI chapter generation cannot complete.
---

# Review Tour Core

Create a guided review experience from a local git diff.

The default experience is the Review Tour viewer: collect the diff, create
chapters, store the artifact in the OS cache, and open the localhost browser UI.
Use a chat-only review only when the user explicitly asks for an explanation in
the chat, text, or "this conversation" instead of opening the viewer.

## Core Rules

- Do not modify source code in the target repository.
- Do not write review artifacts inside the target repository.
- Read git state and diffs only.
- Store viewer artifacts under the OS cache directory via the CLI.
- Use existing hunk IDs when writing viewer chapters.
- Do not invent line numbers or hunk IDs.
- Do not create a custom static HTML review page, `.review-tour.json`, Markdown artifact, or any other substitute viewer artifact when the `review-tour` CLI is unavailable.
- Open the viewer in the Codex right-pane browser when browser control is available; otherwise return the localhost URL.
- Use the user's language for summaries, chapter titles, and review questions.

## CLI Availability

Before using viewer mode, confirm that the official CLI is available:

```bash
command -v review-tour
review-tour --help
```

If `review-tour` is not found or fails to start, stop and tell the user to
install or relink the CLI:

```bash
npm install -g review-tour
```

When working from a source checkout, this local development command is also valid:

```bash
pnpm run install:local
```

Do not generate a replacement static HTML viewer or self-contained review file.
The only supported viewer path is the official `review-tour` CLI writing an OS
cache artifact and opening the local viewer.

## Choose The Output Mode

Use viewer mode by default when the user asks to review:

- the current branch
- staged changes
- working tree changes
- a PR-like diff
- AI-generated code
- a local git diff

Use chat-only mode only when the user explicitly says things like:

- "in chat"
- "as text"
- "without opening the viewer"
- "in this conversation"
- "explain it here"
- "do not open a browser"

## Viewer Workflow

The default viewer workflow must review the code and create AI-authored chapters
before opening the viewer. Do not use `review-tour generate --json` as the normal
path, because it only creates deterministic file-based chapters.

1. Confirm the current directory is a git repository.
2. Infer the diff mode:
   - branch ahead of base: `base...head`
   - only unstaged changes: `working-tree`
   - only staged changes: `staged`
   - user-specified mode wins
3. Run the deterministic CLI collector:

```bash
review-tour collect --json
```

Use explicit flags when needed:

```bash
review-tour collect --base origin/main --head HEAD --mode base...head --json
review-tour collect --mode working-tree --json
review-tour collect --mode staged --json
```

4. Read the draft JSON emitted by the collector. It contains files, hunks, hunk IDs, diff stats, repository metadata, and warnings.
5. Review the code changes and generate a `{ title, prologue, chapters }` payload from the draft:
   - make `prologue.whyThisPr` explain the concrete reviewer-facing motivation or problem
   - make `prologue.whatItDoes` explain the new behavior or implementation outcome
   - write `prologue.whyThisPr` and `prologue.whatItDoes` as 1 to 3 short paragraphs separated by a blank line (`\n\n`), not as one long paragraph
   - use blank-line paragraph breaks in `prologue.reviewFocus[].summary` when one focus item needs more than one idea
   - make `prologue.reviewFocus` list the highest-value review concerns, each with a title, optional file path, and concrete thing to verify
   - order chapters by reviewer comprehension, not file order
   - use 3 to 7 chapters for normal diffs
   - place tests after the behavior they protect
   - raise risk for public API, auth, payment, data mutation, migrations, async workflows, or persistence changes
   - include every hunk ID at least once unless the draft already marks it skipped
   - include concrete review questions that help the user inspect risky behavior
6. Write a chapters JSON file with only existing hunk IDs.
7. Run:

```bash
review-tour write --draft <draft.json> --chapters <chapters.json> --open --json
```

8. Open the returned URL in the right-pane browser when available.
9. Return the URL and artifact path briefly.

## Deterministic Fallback

Use `review-tour generate --json` only if AI chapter generation fails after
`collect` succeeds, and tell the user that the viewer was opened with
deterministic file-based chapters instead of AI-authored review chapters.

```bash
review-tour generate --json
```

## Chapter JSON Shape

```ts
type ReviewChaptersPayload = {
  title?: string;
  summary?: string;
  prologue: {
    whyThisPr: string;
    whatItDoes: string;
    reviewFocus: Array<{
      title: string;
      path?: string;
      summary: string;
      hunkIds?: string[];
    }>;
  };
  chapters: ReviewChapter[];
};

type ReviewChapter = {
  id: string;
  index: number;
  title: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  rationale: string;
  reviewQuestions: string[];
  hunkIds: string[];
  files: Array<{
    path: string;
    hunkIds: string[];
  }>;
};
```

## Chat-Only Workflow

Use this path only when the user explicitly asks for a chat response.

1. Inspect the repository before explaining. Prefer `git diff --name-status`, `git diff --stat`, `git diff --numstat`, `git log`, `rg`, and targeted file reads.
2. Determine the scope: current working tree, current branch, named branch, PR-like diff, or specific feature path.
3. Infer the base branch from repo conventions when the user does not specify it.
4. Build an overview first, then ordered chapters anchored to verified files and line numbers.
5. Prefer a review-oriented narrative over a flat file list.
6. Clearly label inferred background when no issue, PR description, or design doc is available.

For requests that should be answered in prose, use this overview shape unless the
user asks for a shorter format:

```text
Background
...

What changed
...

Key changes
...

Review focus
...
```

Use this chapter shape:

```text
Chapter N

<chapter title>
Risk: Low | Medium | Medium-High | High
Status: +X / -Y

<what changed, how it works, and why it matters>
[file.ts (line 123)](/absolute/path/file.ts:123)

Review points

- <specific question or risk>
- <specific edge case or behavior to verify>
```

## Artifact Contract

Artifacts must live in OS cache, not in the repository:

```text
{cacheDir}/repos/{repoHash}/metadata.json
{cacheDir}/repos/{repoHash}/tours/latest.json
{cacheDir}/repos/{repoHash}/tours/{tourId}.json
```

`repoHash` is `sha256(repoRoot).slice(0, 12)`.

The viewer reads only cache artifacts by `repoHash` and `tourId`. It must never
accept arbitrary filesystem paths from URL input.

Allowed URL:

```text
/tours/latest?repo=8f3a1c9b2d4e
```

Disallowed design:

```text
/tour?path=/absolute/path/to/anything.json
```

## Validation Contract

The CLI must reject or repair invalid artifacts before the viewer opens:

- unknown hunk IDs
- empty chapters
- uncovered hunks
- invalid repo hash or tour ID
- invalid artifact schema

Unknown hunk IDs are hard errors. Uncovered hunks are repaired by fallback
chapter generation plus an `LLM_PARTIAL_COVERAGE` warning.

## Security Rules

- Bind server to `127.0.0.1`.
- Default port: `4378`.
- Validate `repoHash` with `/^[a-f0-9]{12}$/`.
- Validate `tourId` with `/^[a-zA-Z0-9._-]+$/`.
- Schema-validate artifact JSON before returning it to the client.
