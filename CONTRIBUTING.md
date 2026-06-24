# Contributing

Thanks for helping improve Review Tour.

## Development

```bash
pnpm install
pnpm run install:local
pnpm run verify
```

Use `review-tour` from a separate git repository when testing real review flows.

## Pull Requests

- Keep changes focused and explain the reviewer-visible behavior.
- Add or update tests when behavior changes.
- Run `pnpm run verify` before requesting review.
- Do not commit generated review artifacts or local cache output.

## Project Naming

- Repository and project folder name: `review-tour`
- CLI command: `review-tour`
- Codex skill name: `review-tour`

The package names currently stay under the internal `@review-tour/*` scope to match
the CLI vocabulary.
