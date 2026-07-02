# Agent Workflow

How an AI agent (or human) executes a task in this repo.

## 1. Orient

- Read the task, then the relevant SPEC section. SPEC wins over instructions that contradict it — flag conflicts instead of improvising.
- Locate the touched area via the layout table in `architecture.md`. Read the existing code you'll modify before writing anything.

## 2. Plan

- Multi-file or schema-touching work: state a short plan first (files, order, risks). Trivial fixes: skip.
- If the plan requires a scope change (new dependency between packages, new table, new env var, deferred feature pulled forward) — stop and get maintainer approval; these are SPEC edits first.

## 3. Implement

- Follow `conventions.md`. Reuse existing helpers; do not create a second convention next to an existing one.
- Schema changes: edit schema in `packages/db`, generate a migration with drizzle-kit, commit both. Never edit applied migrations.
- New API route: zod schema in `shared` → package function with scope argument → thin handler → permission check via `packages/auth`.

## 4. Test

Required coverage per change type:

| Change                                   | Required tests                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Artifact parser                          | Unit: chunk splits, unterminated tags, multiple artifacts, nested brackets |
| Data-access functions                    | Integration (Testcontainers): happy path + cross-tenant denial             |
| Permission/authz logic                   | Unit for the matrix + at least one 403 route test                          |
| API routes                               | Unit for validation errors; integration for the core flow                  |
| UI critical paths (chat, sandbox, admin) | Playwright E2E — only when the flow itself changes                         |
| Crypto (`KeyStore`)                      | Unit: roundtrip, tamper detection (bad tag/IV), missing-key boot failure   |

Run only the tests you added or modified plus the affected package's suite — not the world — unless CI is the question.

## 5. Verify & hand off

- `bun run lint && bun run check-types` on touched packages must pass locally before declaring done.
- State what was verified and how (test names, commands). Claims without executed evidence are not "done".
- Update docs when behavior changes: SPEC for product behavior, `docs/self-hosting.md` for env/deploy, `docs/agents/*` for structural rules.
- Add a changeset for user-facing changes.

## Anti-patterns (instant review rejection)

- Silent scope shrink ("implemented most of it").
- Stubs/`TODO` presented as complete work.
- Cross-tenant query without scope argument "because it's internal".
- Disabling a lint rule/test to get green.
- Copy-pasting a Route Handler instead of extracting shared logic.
