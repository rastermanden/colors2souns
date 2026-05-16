# Repository instructions for Claude

## Versioning on merge

This repo auto-tags a SemVer release every time a PR is merged into `main`
(see `.github/workflows/auto-tag.yml`). The bump is chosen by a PR label:

- `major` — breaking change (e.g. URL/storage format change, removed feature)
- `minor` — new feature, backwards-compatible
- `patch` — bug fix, refactor, docs, chores, dependency bumps (default)

### Rules when opening a PR

1. Apply **exactly one** of `major`, `minor`, `patch` to every PR targeting `main`.
2. If unsure, default to `patch`.
3. Use `major` only when an existing user's data or URL would break.
4. Set the label as part of opening the PR — not after merge (too late).
