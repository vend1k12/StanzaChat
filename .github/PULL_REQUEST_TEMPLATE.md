<!--
Thanks for contributing to StanzaChat. Please fill in every section below.
PR title MUST be a valid Conventional Commit (e.g. `feat(web): add artifact versions panel`).
Allowed scopes: web, db, auth, ai, shared, docker, docs, repo.
-->

## What

<!-- One or two sentences describing the change from a user or system perspective. -->

## Why

<!-- Motivation. Link the issue this closes with `Closes #N`. -->

Closes #

## How

<!-- Implementation notes: key design choices, files of interest, migrations touched, etc. -->

## Verification

<!-- Commands you ran locally, test names added, screenshots or clips for UI changes. -->

- Commands:
- Tests added/updated:
- Manual checks:

## Definition of Done checklist

Mirrors `docs/processes/development.md` §"Definition of Done" and §"Review policy". Tick every box or explain why it does not apply.

- [ ] Behavior matches `SPEC.MD` (or SPEC was updated in this PR for an approved scope change).
- [ ] Tests exist per the matrix in `docs/agents/workflow.md` and pass locally on touched packages.
- [ ] `bun run lint`, `bun run check-types`, and `bun run build` are green in CI.
- [ ] Docs updated where applicable (SPEC, `docs/self-hosting.md`, `docs/agents/*`).
- [ ] Changeset added for user-facing changes (`bun changeset`).
- [ ] For UI changes: screenshot or short clip attached below.
- [ ] For security-sensitive areas (sandbox, crypto, authz, migrations): guardrails from `docs/agents/guardrails.md` explicitly considered and listed below.
- [ ] All commits are signed off (DCO): `git commit -s`.
- [ ] Review evidence is attached: human review, AI review artifact/check, or solo-maintainer review note per `docs/processes/development.md`.
- [ ] PR title follows Conventional Commits and squash-merge will produce a valid release-please commit.

## Review evidence

<!-- Required before merge. In solo-maintainer mode, link an AI review artifact/check or write a maintainer review note explaining why this is trivial and CI/security checks are sufficient. -->

## Guardrails considered

<!-- Required for changes touching sandbox, crypto, authz, tenancy, migrations, or provider keys.
     List which numbered guardrails from docs/agents/guardrails.md apply and how this PR respects them.
     Delete this section only for changes with no security-sensitive surface. -->

## Screenshots / clips

<!-- UI changes only. Delete otherwise. -->
