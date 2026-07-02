# Contributing to StanzaChat

Thanks for your interest! This document is the entry point; details live in `docs/`.

## TL;DR

1. Discuss first: open or pick an issue before non-trivial PRs.
2. Fork → branch (`feat/<slug>` / `fix/<slug>`) → PR to `main`.
3. Sign off your commits (DCO): `git commit -s`.
4. Follow Conventional Commits; squash-merge titles must conform.
5. Add a changeset (`bun changeset`) for user-facing changes.
6. CI must be green; see the test matrix in `docs/agents/workflow.md`.

## Setup

```sh
bun install
docker compose -f docker/docker-compose.yml up -d postgres
cp .env.example .env   # fill secrets
bun run db:migrate
bun run dev
```

Requirements: Bun ≥ 1.3, Node.js ≥ 20, Docker.

## Project map

- `SPEC.MD` — product source of truth. PRs conflicting with SPEC need a SPEC change first.
- `docs/agents/` — architecture, conventions, workflow, guardrails (canonical for humans **and** AI agents).
- `docs/processes/` — branching, CI, releases.

## Working with AI agents

AI-assisted contributions are welcome. Agents must follow `docs/agents/` (root `AGENTS.md`/`CLAUDE.md` point there). You own what you submit: review generated code before opening a PR; PRs showing signs of unreviewed generation (dead code, invented APIs, guardrail violations) will be closed.

## Security issues

Do **not** open public issues for vulnerabilities — see `SECURITY.md`.

## Code of Conduct

By participating you agree to `CODE_OF_CONDUCT.md`.
