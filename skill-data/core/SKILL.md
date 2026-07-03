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

## Routing

Read only the sections you need for the current step:

| Goal                                           | Section                             |
| ---------------------------------------------- | ----------------------------------- |
| Confirm the CLI is installed and healthy       | CLI Availability                    |
| Decide between viewer and chat output          | Choose The Output Mode              |
| Build the default AI-authored viewer tour      | Viewer Workflow                     |
| Recover when chapter generation fails          | Deterministic Fallback              |
| Author the chapters payload                    | Chapter JSON Shape                  |
| Explain the diff in chat instead               | Chat-Only Workflow                  |
| Understand storage paths and URLs              | Artifact Contract                   |
| Understand validation and security constraints | Validation Contract, Security Rules |

## Core Rules

- Do not modify source code in the target repository.
- Do not write review artifacts inside the target repository.
- Read git state and diffs only.
- Store viewer artifacts under the OS cache directory via the CLI.
- Use existing hunk IDs when writing viewer chapters.
- Do not invent line numbers or hunk IDs.
- Do not create a custom static HTML review page, `.review-tour.json`, Markdown artifact, or any other substitute viewer artifact when the `review-tour` CLI is unavailable.
- Use the CLI `--open` path for the viewer, then return the localhost URL and artifact path.
- Use the user's language for summaries, chapter titles, and review questions.

## CLI Availability

Before using viewer mode, confirm that the official CLI is available:

```bash
command -v review-tour
review-tour doctor --json
```

`review-tour doctor --json` reports Node.js, git, cache directory, skill data,
and GitHub CLI status in one machine-readable payload. It always exits 0 with
`--json`; read the `ok` field and the per-check `status` values instead of the
exit code.

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
- a GitHub pull request URL
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
   - prompt includes a GitHub pull request URL: `--pr <url>`
   - branch ahead of base: `base...head`
   - only unstaged changes: `working-tree`
   - only staged changes: `staged`
   - user-specified mode wins
3. Run the deterministic CLI collector once for the inferred diff mode. Use explicit flags for PRs and branch diffs; use bare `review-tour collect --json` only when the default working-tree/staged behavior is the intended scope.

```bash
review-tour collect --json
review-tour collect --pr https://github.com/owner/repo/pull/123 --json
review-tour collect --base origin/main --head HEAD --mode base...head --json
review-tour collect --mode working-tree --json
review-tour collect --mode staged --json
```

4. Read the draft JSON emitted by the collector. It contains files, hunks, hunk IDs, diff stats, repository metadata, optional `pullRequest` metadata, and warnings.
5. Review the code changes and generate a `{ title, prologue, chapters }` payload from the draft:
   - make `prologue.whyThisPr` explain the concrete reviewer-facing motivation or problem
   - make `prologue.whatItDoes` explain the new behavior or implementation outcome
   - write `prologue.whyThisPr` and `prologue.whatItDoes` as 1 to 3 short paragraphs separated by a blank line (`\n\n`), not as one long paragraph
   - use blank-line paragraph breaks in `prologue.reviewFocus[].summary` when one focus item needs more than one idea
   - make `prologue.reviewFocus` list the highest-value review concerns, each with a title, optional file path, and concrete thing to verify
   - order chapters by reviewer comprehension, not file order
   - when possible, order chapters by the processing flow a human reviewer would trace: entrypoint or user-facing surface, input parsing or validation, core behavior and data flow, state changes or external effects, outputs and error paths, then supporting tests or configuration
   - group hunks across files into the same chapter when they are part of one behavior step; do not split by directory, layer, or file type if that hides the flow
   - place setup, schema, migration, or configuration chapters before behavior only when they are necessary to understand the runtime flow; otherwise place them after the behavior they support
   - use 3 to 7 chapters for normal diffs
   - place tests after the behavior they protect
   - raise risk for public API, auth, payment, data mutation, migrations, async workflows, or persistence changes
   - include every hunk ID at least once unless the draft already marks it skipped
   - order `hunkIds` inside each chapter in the same sequence the reviewer should see the code, because the viewer uses that order to derive displayed files and hunks
   - assign each hunk to one primary chapter by default; reuse a hunk only when the same code must be inspected in multiple chapters
   - avoid reusing very large mixed-scope hunks across chapters; when a large hunk contains several concerns, assign it to one primary chapter and point reviewers to related behavior in the summary or review questions
   - include concrete review questions that help the user inspect risky behavior
6. Create a chapters JSON payload with only existing hunk IDs.
7. Run:

```bash
review-tour write --draft <draft.json> --chapters - --open --json <<'JSON'
{
  "title": "...",
  "summary": "...",
  "prologue": {
    "whyThisPr": "...",
    "whatItDoes": "...",
    "reviewFocus": []
  },
  "chapters": []
}
JSON
```

8. If the viewer did not open automatically and a browser-control tool is already available, open the returned URL there. Do not spend extra steps discovering browser tools just to display the viewer.
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
4. Build an overview first, then ordered chapters that follow reviewer comprehension and processing flow, anchored to verified files and line numbers.
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

When the user asks to clear Review Tour cache data, use the CLI cleanup path:

```bash
review-tour gc --all
```

Do not manually delete guessed cache paths.

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
