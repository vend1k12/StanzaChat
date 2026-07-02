# StanzaChat — Technical Specification

**Status:** Approved for MVP (v0.1) · **License:** Apache-2.0 · **Last updated:** 2026-07-02

StanzaChat is an open-source, self-hosted AI workspace. Its core differentiators over classic chat UIs:

1. **Split workspace UI** — a conversation zone (left) and an interactive results zone (right, "Artifacts") with code view, live sandboxed preview, and version history.
2. **Hard data isolation** — multi-tenant from day one (organizations → workspaces → chats) with strict scoping on every query.
3. **Self-host first** — one `docker compose up`, no external SaaS dependencies, provider API keys encrypted at rest.

Native MCP support and local RAG are core to the product vision but are **post-MVP** (see §10).

---

## 1. Scope

### 1.1 In scope for v0.1 (MVP)

| Area      | Contents                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Chat      | Streaming chat with any Vercel AI SDK provider; chat history; system prompts per chat                                                    |
| Artifacts | `<artifact>` tag detection in the stream; types: `html`, `svg`, `markdown` (js runs inside html artifacts); version history per artifact |
| Sandbox   | Client-side iframe sandbox for artifact preview, fully origin-isolated                                                                   |
| Auth      | Better-Auth: email/password, sessions in Postgres; `organization` plugin (multi-tenancy), `admin` plugin (instance administration)       |
| Admin     | Instance admin panel: LLM provider/model management (instance-level), user management, registration mode, audit log viewer               |
| Audit     | Synchronous audit logging of admin actions to Postgres                                                                                   |
| Deploy    | Docker Compose (app + Postgres), profiles for single-user and team setups                                                                |

### 1.2 Explicitly out of scope for v0.1 (deferred, see §10)

- React/TSX artifacts (v0.2, via esbuild-wasm)
- MCP client (stdio + SSE transports)
- RAG / pgvector / document upload
- Redis, BullMQ, background workers
- User groups, per-group model access, token limits
- Per-organization provider keys (MVP is instance-level only)
- Vault/KMS integration (interface is prepared, implementation deferred)
- SSO / OAuth providers

Scope changes require editing this file first (see `docs/processes/development.md`).

---

## 2. Technology Stack

| Layer          | Choice                                                                                   | Notes                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Monorepo       | Turborepo + Bun workspaces                                                               | Bun is the package manager and task runner **only**                                           |
| Runtime (prod) | **Node.js ≥ 20**                                                                         | Boring and compatible. Bun-as-runtime is not supported in v0.1                                |
| App            | **Next.js (App Router)** — UI **and** API via Route Handlers                             | No separate backend service. All server logic lives in `packages/*`, Route Handlers stay thin |
| AI layer       | **Vercel AI SDK** (`ai` + `@ai-sdk/*` providers)                                         | Single abstraction for streaming, providers, and future tool-calling                          |
| UI             | Tailwind CSS v4, shadcn/ui, Radix, lucide-react, sonner                                  |                                                                                               |
| Client state   | TanStack Query (server state) + Zustand (UI/local state)                                 |                                                                                               |
| Database       | PostgreSQL 16+                                                                           | `pgvector` image from day one so v0.2 RAG needs no migration of the base image                |
| ORM            | Drizzle ORM + drizzle-kit migrations                                                     |                                                                                               |
| Auth           | Better-Auth + `organization` + `admin` plugins                                           | Sessions, orgs, invitations, roles in Postgres                                                |
| Testing        | `bun test` (unit) · Playwright (E2E) · Testcontainers (Postgres integration)             |                                                                                               |
| Lint/format    | ESLint (flat) + Prettier + plugins: `tailwindcss`, `drizzle`, `security`, import sorting |                                                                                               |
| CI             | GitHub Actions + Turborepo Remote Cache (Vercel free tier)                               |                                                                                               |
| Releases       | Conventional Commits + Changesets + release-please                                       |                                                                                               |
| Infra          | Docker + Docker Compose                                                                  |                                                                                               |

---

## 3. Monorepo Layout

```text
/
├── apps/
│   └── web/                    # Next.js app: UI + Route Handlers (the only deployable)
│       ├── app/                #   App Router: pages + /api routes
│       ├── components/         #   App-specific components
│       └── lib/                #   App-specific glue (thin; real logic lives in packages)
├── packages/
│   ├── db/                     # Drizzle schemas, migrations, seeds, db client factory
│   ├── auth/                   # Better-Auth config, plugins, first-run logic, permission helpers
│   ├── ai/                     # Provider registry, model resolution, artifact tag parser, crypto
│   ├── shared/                 # Shared types, DTO contracts, zod schemas, constants
│   ├── eslint-config/          # @repo/eslint-config (exists)
│   └── typescript-config/      # @repo/typescript-config (exists)
├── docker/
│   ├── app.Dockerfile          # Multi-stage prod build (Next.js standalone, Node runtime)
│   └── docker-compose.yml      # postgres + app; profiles: single, team
├── docs/
│   ├── agents/                 # CANONICAL agent rules (AGENTS.md/CLAUDE.md point here)
│   ├── processes/              # Development, CI, release processes
│   ├── architecture.md         # System architecture (public-facing)
│   └── self-hosting.md         # Deployment guide
├── .github/                    # Workflows, issue/PR templates, dependabot, CodeQL
├── AGENTS.md                   # Thin pointer → docs/agents/
├── CLAUDE.md                   # Thin pointer → docs/agents/
├── CONTRIBUTING.md
├── SPEC.MD                     # This file — the product source of truth
└── turbo.json
```

**Dependency rule:** `apps/web` → `packages/*`; packages may depend on `shared` and `db`, never on `apps/*`. `packages/ai` and `packages/auth` must not import each other.

---

## 4. Domain Model & Database Schema

All app tables carry `created_at` / `updated_at` (`timestamptz`, defaults). IDs are text ULIDs unless Better-Auth dictates otherwise. Every query touching tenant data **must** filter by the tenant chain (`organization_id` → `workspace_id`); this is a review-blocking rule.

### 4.1 Better-Auth managed tables

Generated by Better-Auth + plugins (`organization`, `admin`): `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`. The `admin` plugin adds `role` / `banned` fields on `user`.

- **Instance roles** (`user.role`): `admin` (deployer/instance admin) | `user`.
- **Org roles** (`member.role`): `owner` | `admin` | `member`.
- The SPEC roles `super_admin`/`org_admin`/`workspace_manager` map to: instance `admin`, org `owner|admin`, and (deferred) workspace-level roles in v0.2+.

### 4.2 App tables

| Table                  | Key columns                                                                                                                                                                             | Notes                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces`           | `id`, `organization_id` FK, `name`, `slug`                                                                                                                                              | A default workspace is auto-created per organization. UI for multiple workspaces may be minimal in v0.1, but the entity exists so chats/RAG scoping never needs a schema migration |
| `chats`                | `id`, `workspace_id` FK, `user_id` FK, `title`, `system_prompt`, `model_config_id` FK                                                                                                   |                                                                                                                                                                                    |
| `messages`             | `id`, `chat_id` FK, `role` (`system\|user\|assistant`), `content` (text), `token_usage` (jsonb: prompt/completion/total), `model_id` (text snapshot)                                    | Content stores the raw assistant output including artifact tags; rendering strips them                                                                                             |
| `artifacts`            | `id`, `chat_id` FK, `identifier` (unique per chat), `type` (`html\|svg\|markdown`), `title`                                                                                             | `(chat_id, identifier)` unique index                                                                                                                                               |
| `artifact_versions`    | `id`, `artifact_id` FK, `version_number` (int, monotonic per artifact), `content` (text), `message_id` FK                                                                               | A new `<artifact>` with an existing identifier creates the next version                                                                                                            |
| `model_configurations` | `id`, `provider` (`openai\|anthropic\|google\|openai-compatible\|ollama`), `label`, `base_url`, `encrypted_api_key`, `key_iv`, `key_tag`, `enabled_models` (jsonb), `is_default` (bool) | Instance-level. API key encrypted AES-256-GCM (see §7)                                                                                                                             |
| `audit_logs`           | `id`, `actor_user_id`, `action` (text enum), `target_type`, `target_id`, `metadata` (jsonb), `ip`                                                                                       | Written synchronously in the same request; append-only                                                                                                                             |
| `instance_settings`    | singleton row: `registration_mode` (`open\|invite_only\|closed`), `setup_completed` (bool)                                                                                              |                                                                                                                                                                                    |

### 4.3 Migration policy

- drizzle-kit generated SQL migrations committed to `packages/db/migrations/`.
- Migrations run automatically on app start in Docker (guarded, advisory-locked) and via `bun run db:migrate` in dev.
- Never edit an applied migration; forward-only.

---

## 5. Functional Specification

### 5.1 Chat & streaming

- `POST /api/chat` — accepts `{ chatId, message }`, resolves the chat's model configuration, decrypts the key server-side, calls `streamText` (Vercel AI SDK), and returns the SDK data-stream response. Route Handler runs on **Node runtime** (`export const runtime = 'nodejs'`).
- Persistence: user message saved before the call; assistant message saved in `onFinish` with token usage. A client disconnect must not lose the assistant message (use `consumeStream`).
- Errors mid-stream surface as a typed stream part; the client renders a retry affordance.
- Chat CRUD: `GET/POST /api/chats`, `GET/PATCH/DELETE /api/chats/:id`, `GET /api/chats/:id/messages`. All scoped: session → org membership → workspace → chat owner.

### 5.2 Artifact protocol (tag format)

The system prompt instructs the model to emit:

```
<artifact identifier="kebab-case-id" type="text/html|image/svg+xml|text/markdown" title="Human title">
...content...
</artifact>
```

Rules:

- **Create:** first occurrence of `identifier` in a chat → new `artifacts` row + version 1.
- **Update:** re-emitting an existing `identifier` → new `artifact_versions` row (full content replacement; no diff format in v0.1).
- **Parser** (`packages/ai/src/artifact-parser.ts`): incremental state machine over the token stream. Must tolerate: tag split across chunks, unterminated tag at stream end (auto-close, mark version `incomplete`), nested angle brackets in content, multiple artifacts per message. Emits events: `artifact-start(meta)`, `artifact-delta(text)`, `artifact-end`. Chat text outside tags streams to the message pane; tag content streams to the artifact pane.
- Parser is a pure function of chunks → events; it is the most heavily unit-tested module in the repo.

### 5.3 Artifacts sandbox (client)

- Rendered in `<iframe sandbox="allow-scripts">` — **never** `allow-same-origin`; the iframe origin is `null`, blocking access to cookies/localStorage of the host app.
- Content delivered via `srcdoc`. For `markdown`, the host renders to HTML first (sanitized via a strict allowlist); `svg` is embedded in a minimal HTML shell.
- Parent ↔ iframe messaging via `postMessage` only. On each mount the host generates a random UUID **secret token**, injects it into the sandbox bootstrap, and both sides validate it on every message; messages without a valid token are dropped. Parent also validates `event.source`.
- Host page sets a CSP that disallows the sandbox content from escalating (no `allow-popups`, no `allow-top-navigation`).
- Right panel tabs: `Preview` (sandbox), `Code` (read-only highlighted source), `Versions` (list; selecting a version re-renders Preview/Code).

### 5.4 Auth, tenancy & first run

- Email/password via Better-Auth; sessions in Postgres (cookie-based).
- **First run:** the first successfully registered user is promoted to instance `admin` (atomic check on user count), `instance_settings.setup_completed = true`, and `registration_mode` flips to `invite_only`. The admin can set it back to `open` or `closed`.
- Organizations via the `organization` plugin: users create/join orgs by invitation; personal use = an auto-created personal org. A default workspace is created with every org.
- Authorization matrix (enforced in a single `packages/auth` helper, not ad-hoc per route):

| Action                           | member | org admin/owner | instance admin |
| -------------------------------- | ------ | --------------- | -------------- |
| Use chat/artifacts in own org    | ✅     | ✅              | ✅             |
| Manage org members/invitations   | —      | ✅              | ✅             |
| Manage providers/models          | —      | —               | ✅             |
| Manage users / registration mode | —      | —               | ✅             |
| View audit logs                  | —      | —               | ✅             |

### 5.5 Admin panel

- `/admin` area (instance admin only): provider configurations (create/edit/disable; key is write-only — never returned to the client, only a masked fingerprint), model enablement per provider, default model, user list (ban/unban, role), registration mode, audit log viewer (filter by actor/action/date).
- Every mutating admin action writes an `audit_logs` row in the same transaction.

### 5.6 Audit actions (enum, extensible)

`provider.create|update|delete`, `model.enable|disable`, `settings.update`, `user.ban|unban|role_change`, `org.create|delete`, `invitation.create|revoke`.

---

## 6. API Surface (v0.1)

All under `apps/web/app/api/`. Zod-validated inputs (schemas in `packages/shared`), typed JSON errors `{ error: { code, message } }`.

```
POST   /api/auth/[...all]          # Better-Auth handler
POST   /api/chat                   # streaming completion (AI SDK data stream)
GET    /api/chats                  # list (scoped)
POST   /api/chats
GET    /api/chats/:id
PATCH  /api/chats/:id              # rename, system prompt, model
DELETE /api/chats/:id
GET    /api/chats/:id/messages
GET    /api/artifacts/:id/versions
GET    /api/models                 # enabled models visible to the current user
GET    /api/admin/providers        # admin-only ↓
POST   /api/admin/providers
PATCH  /api/admin/providers/:id
DELETE /api/admin/providers/:id
GET    /api/admin/users
PATCH  /api/admin/users/:id        # role / ban
GET    /api/admin/settings
PATCH  /api/admin/settings
GET    /api/admin/audit-logs
```

---

## 7. Security Model

- **Key encryption:** AES-256-GCM with 32-byte `ENCRYPTION_MASTER_KEY` from env. Per-value random 12-byte IV; store `ciphertext`, `iv`, `auth_tag`. Implemented behind a `KeyStore` interface in `packages/ai/src/crypto/` so a Vault/KMS backend can be added in v0.2 without schema changes. Key rotation in v0.1 = documented manual re-encrypt script.
- **Secrets hygiene:** API keys never serialize to the client or logs; provider responses proxied server-side only. `BETTER_AUTH_SECRET` and `ENCRYPTION_MASTER_KEY` are required at boot — the app refuses to start with defaults/missing values in production.
- **Sandbox:** see §5.3. Threat model: model-generated code is untrusted; it must not be able to read host storage, make credentialed requests, or navigate the top frame.
- **Tenancy:** every data-access function takes an explicit scope object; cross-tenant access is a P0 bug class with dedicated tests.
- **Rate limiting:** simple in-memory/pg-based limit on `/api/chat` per user in v0.1 (Redis-backed later).
- **Headers:** strict CSP, `X-Frame-Options: DENY` on the host app, standard hardening via Next config.
- **Reports:** `SECURITY.md` with private disclosure contact.

---

## 8. Configuration (env)

| Var                     | Required | Notes             |
| ----------------------- | -------- | ----------------- |
| `DATABASE_URL`          | ✅       | Postgres DSN      |
| `BETTER_AUTH_SECRET`    | ✅       | ≥ 32 random bytes |
| `BETTER_AUTH_URL`       | ✅       | Public app URL    |
| `ENCRYPTION_MASTER_KEY` | ✅       | 32 bytes, base64  |
| `PORT`                  | —        | default 3000      |

`.env.example` committed; boot-time validation via a zod env schema in `packages/shared`.

---

## 9. Deployment

`docker/docker-compose.yml`: `postgres` (pgvector image) + `app` (multi-stage `app.Dockerfile`, Next.js standalone output, Node 20+ runtime, non-root user, healthcheck). Compose **profiles**: `single` (minimal, open registration off after first user) and `team` (same services; the split exists for future team-only services like Redis/worker). Named volumes for pg data. Migrations run on container start under an advisory lock.

---

## 10. Roadmap

### Phase 0 — Repository foundation _(before any feature code)_

Linters/formatters wired per stack table; CI (lint, typecheck, unit, build, E2E, docker build — all required on PR; Turbo remote cache); changesets + release-please; OSS files (LICENSE Apache-2.0, SECURITY, CODE_OF_CONDUCT, CONTRIBUTING, issue/PR templates, DCO, dependabot, CodeQL, semgrep); agent rules live in `docs/agents/`.
**Done when:** a trivial PR runs the full green pipeline; release-please opens a release PR on merge.

### Phase 1 — Data & auth core

`packages/db` (schema §4, migrations, seeds), `packages/auth` (Better-Auth + plugins, first-run promotion, permission helper), `packages/shared` (env schema, DTOs). Sign-up/sign-in pages.
**Done when:** first user becomes admin (integration-tested via Testcontainers); org + default workspace auto-created; registration mode enforced.

### Phase 2 — AI core

`packages/ai`: provider registry over Vercel AI SDK, `KeyStore` crypto, artifact parser. `/api/chat` streaming with persistence + token usage. Admin provider CRUD API.
**Done when:** parser passes the chunk-split/incomplete-tag test suite; a chat round-trip against a mock provider persists messages and artifacts.

### Phase 3 — Workspace UI

Two-panel layout, chat stream rendering, artifact panel (Preview/Code/Versions), iframe sandbox with token-validated postMessage, model picker, chat list.
**Done when:** Playwright E2E: register → chat (mocked provider) → artifact renders in sandbox → version history navigates.

### Phase 4 — Admin panel & audit

`/admin` UI for §5.5, audit log writes + viewer, rate limiting.
**Done when:** E2E: admin adds a provider (key masked afterwards), audit row appears; non-admin gets 403.

### Phase 5 — Ship

Dockerfile + compose profiles, `docs/self-hosting.md`, `docs/architecture.md`, README with badges/screenshots, seed demo data, release v0.1.0, repo goes public.
**Done when:** clean-machine `docker compose up` → onboarding → working chat with a real provider.

### Post-MVP backlog (v0.2+)

React/TSX artifacts (esbuild-wasm in sandbox) · MCP client (stdio + SSE) · RAG (pgvector, document upload, Redis + BullMQ indexing, `apps/worker`) · groups & token limits · per-org provider overrides · Vault/KMS `KeyStore` backend · SSO · workspace-level roles.

---

## 11. Related documents

- `docs/agents/` — canonical rules for AI-agent development
- `docs/processes/development.md` — branching, PR, definition of done
- `docs/processes/ci.md` — pipeline specification
- `docs/processes/release.md` — versioning & release flow
- `CONTRIBUTING.md` — contributor entry point
