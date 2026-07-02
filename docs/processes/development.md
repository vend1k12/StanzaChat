# Development Process

## Branching

- **Trunk-based.** `main` is the only long-lived branch, always releasable.
- Feature branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, short-lived (days, not weeks).
- Merge via **squash-merge** only; the squash commit message must be a valid Conventional Commit (it feeds release-please).
- `main` is protected: required CI checks green, at least one review (maintainer may self-merge until there are co-maintainers), no force pushes.

## Definition of Done

A change is done when all of the following hold:

1. Behavior matches SPEC (or SPEC was updated in the same PR for approved scope changes).
2. Tests per the matrix in `docs/agents/workflow.md` exist and pass.
3. `lint`, `check-types`, `build` green in CI.
4. Docs updated (SPEC / self-hosting / agents rules as applicable).
5. Changeset added for user-facing changes.
6. For UI: screenshot or short clip in the PR.
7. For security-sensitive areas (sandbox, crypto, authz, migrations): PR explicitly lists which guardrails were considered.

## Scope-change protocol

New table, new env var, new dependency between packages, new service, or pulling a deferred feature forward → **SPEC.MD edit in the same or a preceding PR**, called out in the PR description. Reviewers reject scope creep that bypasses this.

## Issue → PR flow

1. Every non-trivial change starts as an issue (bug report / feature request template).
2. Maintainer triages: label (`bug`, `feature`, `good first issue`, `security`), milestone, and — for features — an accepted mini-design in the issue thread before code.
3. PR links the issue (`Closes #N`).
4. Post-MVP feature ideas accumulate as issues; the roadmap section of SPEC is revised per release cycle, not per idea.

## Local commands

```
bun install
bun run dev          # turbo dev
bun run lint         # eslint across workspace
bun run check-types  # tsc across workspace
bun run test         # bun test (unit)
bun run test:e2e     # playwright
bun run db:migrate   # drizzle-kit migrate (dev db via docker compose)
bun changeset        # add a changeset
```
