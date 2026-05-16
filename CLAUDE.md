# Repository instructions for Claude

## Versioning on merge

This repo auto-tags a SemVer release every time a PR is merged into `main`
(see `.github/workflows/auto-tag.yml`). The bump is chosen by a PR label:

- `major` — breaking change (e.g. URL/storage format change, removed feature)
- `minor` — new feature, backwards-compatible
- `patch` — bug fix, refactor, dependency bumps that affect the app (default)
- `no-release` — **skip tagging entirely**; use for changes that don't affect
  app behavior (docs-only, CI/workflow tweaks, repo housekeeping, Claude
  skills/instructions)

### Rules when opening a PR

1. Apply **exactly one** of `major`, `minor`, `patch`, or `no-release` to
   every PR targeting `main`.
2. If the change touches app code or user-visible behavior, pick `major` /
   `minor` / `patch`. If unsure between those, default to `patch`.
3. If the change is purely docs, CI, workflows, or Claude tooling and
   produces no behavior change for end users, use `no-release`.
4. Use `major` only when an existing user's data or URL would break.
5. Set the label as part of opening the PR — not after merge (too late).
