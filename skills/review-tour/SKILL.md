---
name: review-tour
description: Create guided review tours for local git diffs and GitHub pull request URLs. By default, generate and open a browser-based review tour. Use chat-only output only when the user explicitly asks to explain the diff in chat or text.
allowed-tools: Bash(review-tour:*), Bash(npx review-tour:*)
---

# Review Tour

Create guided review tours from local git diffs and GitHub pull request URLs.

This file is a distribution stub. Before running review workflows, load the
versioned workflow instructions from the installed CLI:

```bash
review-tour skills get core
```

The CLI serves skill content that matches the installed `review-tour` version,
so workflow details stay aligned with the available commands and artifact
schema.

## Install The CLI

If `review-tour` is not available, install the CLI first:

```bash
npm install -g review-tour
```

When working from a source checkout, this local development command is also
valid:

```bash
pnpm run install:local
```

Do not create a custom static HTML review page, `.review-tour.json`, Markdown
artifact, or substitute viewer artifact when the CLI is unavailable. The
supported path is the official CLI writing an OS cache artifact and opening the
local viewer.

## Quick Start

After loading the core workflow with `review-tour skills get core`, the normal
AI-authored viewer path is:

```bash
review-tour collect --json
review-tour write --draft <draft.json> --chapters - --open --json
```

Use the deterministic one-command path only as a fallback when AI chapter
generation cannot complete:

```bash
review-tour generate --json
```
