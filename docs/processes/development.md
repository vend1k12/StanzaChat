# Development Process

## Branching

- **Trunk-based.** `main` is the only long-lived branch, always releasable.
- Feature branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, short-lived (days, not weeks).
- Merge via **squash-merge** only; the squash commit message must be a valid Conventional Commit (it feeds release-please).
- `main` is protected: required CI/security checks green, no force pushes. Human approval is required once there is more than one maintainer; while the project has a solo maintainer, self-merge is allowed only after the PR includes a maintainer review note plus an AI review artifact/check.

## Definition of Done

A change is done when all of the following hold:

1. Behavior matches SPEC (or SPEC was updated in the same PR for approved scope changes).
2. Tests per the matrix in `docs/agents/workflow.md` exist and pass.
3. `lint`, `check-types`, `build` green in CI.
4. Docs updated (SPEC / self-hosting / agents rules as applicable).
5. Changeset added for user-facing changes.
6. For UI: screenshot or short clip in the PR.
7. For security-sensitive areas (sandbox, crypto, authz, migrations): PR explicitly lists which guardrails were considered.

## Review policy

- **Solo-maintainer mode:** until there is a second maintainer, GitHub branch protection does not require a human approving review. The maintainer may self-merge only after documenting review evidence in the PR.
- Required review evidence for every non-trivial PR: either an AI review artifact (for example `.rpiv/artifacts/reviews/...`) or a passing AI Review workflow/check. Critical or important findings must be fixed or explicitly rebutted in the PR before merge.
- Trivial dependency, documentation, or hygiene PRs may use the maintainer review note alone when all required CI/security checks are green and no product behavior changes.
- **Multi-maintainer mode:** once another maintainer exists, enable branch protection with at least one required approving human review before merge.

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
