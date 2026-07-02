# Architecture Rules

## Package boundaries

```
apps/web        → may import: all packages/*
packages/ai     → may import: shared, db          (NEVER auth)
packages/auth   → may import: shared, db          (NEVER ai)
packages/db     → may import: shared
packages/shared → imports nothing from the repo
```

Violations are review-blocking. If a feature seems to need `ai` ↔ `auth` coupling, the shared piece belongs in `shared` or the composition belongs in `apps/web`.

## Where code goes

| Kind of code                                                                             | Location           |
| ---------------------------------------------------------------------------------------- | ------------------ |
| Drizzle schema, migrations, seeds, db client factory                                     | `packages/db`      |
| Better-Auth config, first-run promotion, permission helper (`can(actor, action, scope)`) | `packages/auth`    |
| Provider registry, model resolution, `KeyStore` crypto, artifact tag parser              | `packages/ai`      |
| Zod schemas (API DTOs, env), shared types, constants, audit action enum                  | `packages/shared`  |
| Route Handlers (auth check → zod parse → call package fn → shape response)               | `apps/web/app/api` |
| React components, hooks, Zustand stores                                                  | `apps/web`         |

A Route Handler longer than ~40 lines is a smell: extract logic into a package.

## Non-negotiable patterns

- **Tenancy scoping:** every data-access function in `packages/*` takes an explicit scope argument (e.g. `{ userId, organizationId, workspaceId }`). No function may query tenant data without it. Do not "temporarily" query by bare id.
- **Authorization:** one helper in `packages/auth` implements the matrix from SPEC §5.4. Route Handlers call it; they never re-implement role checks inline.
- **Validation:** every API input parses through a zod schema from `packages/shared`. Handlers never touch `req.json()` raw fields.
- **Errors:** API errors are `{ error: { code, message } }` with proper HTTP status. Never leak stack traces, SQL, or provider error bodies to clients.
- **Secrets:** decrypted provider keys exist only inside the request that uses them. Never returned in any API response, never logged, never put in React props.
- **Streaming:** `/api/chat` uses Vercel AI SDK data streams on the Node runtime. Persistence happens server-side in `onFinish`; never rely on the client to post back the assistant message.
- **Artifact parser:** pure incremental function of chunks → events, no I/O. All behavior changes come with unit tests for chunk-split and unterminated-tag cases.

## Frontend

- shadcn/ui components live under `apps/web/components/ui` and are owned by us after generation — edit freely, don't re-generate over local changes.
- Server state via TanStack Query; UI state via Zustand. No new state libraries.
- The artifact sandbox iframe never gets `allow-same-origin`. postMessage payloads always carry the mount-scoped secret token. Treat any change to sandbox code as security-sensitive (see `guardrails.md`).
