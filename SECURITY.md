# Security Policy

Review Tour is designed to inspect local git diffs and serve review artifacts
through a localhost-only viewer.

## Supported Versions

Until the first stable release, security fixes target the default branch.

## Reporting a Vulnerability

Please report vulnerabilities privately by opening a GitHub security advisory when
the repository is public. If advisories are unavailable, contact the maintainer
privately before publishing details.

Please include:

- Affected command or viewer route
- Reproduction steps
- Expected and actual behavior
- Any relevant artifact or diff shape, with secrets removed

## Security Expectations

- The viewer binds to `127.0.0.1` by default.
- Review artifacts are stored in the OS cache, not in the target repository.
- The viewer must not read arbitrary filesystem paths from URL input.
- Generated artifacts should not contain secrets.
