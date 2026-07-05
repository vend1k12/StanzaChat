# Conventions

## TypeScript

- `strict` everywhere; no `any` (use `unknown` + narrowing). `@ts-expect-error` requires a comment explaining why.
- Named exports only; no default exports (exception: Next.js pages/layouts/route files where the framework requires them).
- Prefer plain functions and object literals over classes. Classes only where identity + lifecycle warrants it (e.g. the artifact parser state machine).
- No barrel files (`index.ts` re-export hubs) inside packages except the package entry point declared in `package.json#exports`.
- Types shared between client and server go in `packages/shared`; do not duplicate DTO shapes.

## Naming

- Files: `kebab-case.ts`. React components: `kebab-case.tsx` exporting `PascalCase`.
- DB: `snake_case` tables/columns; Drizzle objects `camelCase`.
- Zod schemas: `xxxSchema`; inferred types: `Xxx`.
- Audit actions: `noun.verb` (`provider.create`), registered in the enum in `packages/shared`.

## Error handling

- Package functions throw typed errors (`NotFoundError`, `ForbiddenError`, `ValidationError` from `packages/shared`); a single mapper in `apps/web` converts them to HTTP responses.
- Never swallow errors. No empty `catch`. If deliberately ignoring, comment why.

## Dependencies

- Adding a dependency requires justification in the PR description (what it does, why not stdlib/existing dep, size).
- No deps with install scripts unless unavoidable. Pin via lockfile only; no `^` removal churn.

## Commits & PRs

- Conventional Commits: `feat|fix|docs|refactor|test|chore|ci|perf(scope): subject`. Scopes: `web`, `db`, `auth`, `ai`, `shared`, `docker`, `docs`, `repo`.
- One logical change per PR. User-facing changes need a changeset (`bun changeset`).
- PR description states: what, why, how verified. Screenshots for UI changes.

## Formatting

Prettier is the single source of formatting truth; never hand-format against it. ESLint enforces import order, tailwind class order, drizzle safety rules, and security rules — fix, don't disable. A rule disable requires an inline comment with a reason.

## Admin mutations

- Every mutating admin action (SPEC §5.5) is composed of two writes in
  the SAME transaction: the state change and its `audit_logs` row. The
  package-level helper owns the `db.transaction(...)` block and accepts
  an `AuditContext` (`actorUserId`, `ip`); the Route Handler builds the
  context via `auditContextFor(session)` and passes it in. `audit_logs`
  is append-only (guardrails #9) — no update/delete helpers exist and
  none should be added.
- Rate-limiters (`chatLimiter`, `adminLimiter` in `apps/web/lib/rate-limit.ts`)
  are the ONLY place limits are enforced. Route Handlers `consume` at
  the top of the block and return `rateLimitResponse(gate)` on failure
  BEFORE any DB work. Swap to Redis in v0.2 by changing the limiter
  factory only.
