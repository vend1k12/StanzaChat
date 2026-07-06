<h1 align="center">StanzaChat</h1>

<p align="center">
  <strong>Self-hosted AI workspace with a split conversation-and-artifact UI.</strong>
</p>

<p align="center">
  <a href="https://github.com/vend1k12/StanzaChat/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/vend1k12/StanzaChat/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-informational"></a>
  <a href="SPEC.MD"><img alt="Spec" src="https://img.shields.io/badge/spec-v0.1-blue"></a>
  <a href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black"></a>
  <a href="https://sdk.vercel.ai"><img alt="Vercel AI SDK" src="https://img.shields.io/badge/AI%20SDK-7-black"></a>
  <a href="https://www.postgresql.org/"><img alt="Postgres" src="https://img.shields.io/badge/Postgres-17-336791"></a>
</p>

---

StanzaChat is an open-source, self-hosted AI workspace. It differs from
"just another chat UI" in three ways:

1. **Split workspace** — a conversation zone on the left, an interactive
   "Artifacts" zone on the right. When a model returns HTML, SVG, or
   Markdown wrapped in an `<artifact>` tag, it renders live in an
   origin-isolated iframe sandbox with a versions timeline.
2. **Multi-tenant from day one** — organizations → workspaces → chats,
   with strict scoping on every query. Personal use auto-provisions a
   single-user org; team deployments unlock invitations and roles
   without a schema migration.
3. **Self-host first** — one `docker compose up`, no external SaaS
   dependencies. Provider API keys are encrypted at rest with
   AES-256-GCM; the plaintext key exists only inside the request that
   uses it.

**Native MCP support and local RAG** are core to the roadmap but
deliberately deferred past v0.1 (see [`SPEC.MD`](SPEC.MD#10-roadmap)).

---

## Highlights

- **Bring-your-own model provider** — OpenAI, Anthropic, Google, Ollama,
  and any OpenAI-compatible endpoint (LiteLLM, LocalAI, vLLM, one-api,
  custom proxies). Add a base URL and an API key in the admin panel and
  StanzaChat wires the rest through the Vercel AI SDK.
- **Model discovery** — for OpenAI-family providers the admin UI can
  probe `GET {base}/models` server-side and pre-fill the enabled-model
  list. No hand-typing model ids.
- **Per-model settings** — attach `temperature`, `topP`,
  `maxOutputTokens`, and a default `systemPrompt` to each enabled model.
  Chats inherit the defaults; a chat-level override still wins.
- **Draft chats** — the workspace opens on `/chats` in a draft state; the
  DB row is created on the first submit and the URL swaps in place, no
  page reload, no lost tokens.
- **Live artifact sandbox** — `<iframe sandbox="allow-scripts">` on an
  opaque origin; `postMessage` is validated on both sides with a
  mount-scoped UUID token, so model-generated code can't reach host
  storage or the top frame.
- **Instance admin panel** — provider CRUD (edit + rotate key + discover
  models + per-model settings), user management with self-lockout guards,
  invite-only / open / closed registration modes, and an append-only
  audit log viewer for every mutating action.
- **First-run promotion** — the first successful sign-up is atomically
  promoted to instance admin (single transaction, count-guarded), and
  `registration_mode` flips to `invite_only`. No console step required.

---

## Stack

| Layer          | Choice                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| Monorepo       | Turborepo + Bun workspaces                                                           |
| Runtime (prod) | Node.js ≥ 20                                                                         |
| App            | Next.js 15 (App Router) — UI **and** API via Route Handlers                          |
| AI             | Vercel AI SDK 7 (`ai` + `@ai-sdk/*` providers)                                       |
| UI             | Tailwind CSS v4, shadcn/ui, Radix, lucide-react, sonner                              |
| Client state   | TanStack Query (server state) + Zustand (UI/local state)                             |
| Database       | PostgreSQL 17 (`pgvector` image from day one, ready for v0.2 RAG)                    |
| ORM            | Drizzle ORM + drizzle-kit migrations                                                 |
| Auth           | Better-Auth with `organization` and `admin` plugins                                  |
| Testing        | `bun test` (unit) · Playwright (E2E) · Testcontainers (Postgres integration)         |
| Lint/format    | ESLint (flat) + Prettier + `tailwindcss`, `drizzle`, `security`, import-sort plugins |
| CI             | GitHub Actions + Turborepo Remote Cache · DCO · CodeQL · Semgrep                     |
| Releases       | Conventional Commits + Changesets + release-please                                   |
| Infra          | Docker + Docker Compose                                                              |

**Dependency rule** — `apps/web` may import any package; packages may
depend on `shared` and `db` only; `packages/ai` and `packages/auth`
never import each other. Enforced by convention, reviewed on PR.

---

## Repository layout

```
apps/
  web/                  # Next.js app: UI + Route Handlers (the only deployable)
    app/                #   App Router: pages + /api routes
    components/         #   App components (shadcn/ui under components/ui/*)
    e2e/                #   Playwright specs
    lib/                #   Client hooks, error surfaces, session helpers
packages/
  ai/                   # Provider registry, model resolver, artifact parser, crypto
  auth/                 # Better-Auth config, first-run promotion, permission helper
  db/                   # Drizzle schema, migrations, seeds, db client factory
  shared/               # Shared types, zod schemas, env schema, error classes
docker/
  docker-compose.dev.yml # Postgres only, for `bun run dev`
docs/
  agents/               # CANONICAL rules for humans + AI agents
  processes/            # Development, CI, release processes
  self-hosting.md       # (WIP) production deploy guide
```

Full monorepo contract is in [`SPEC.MD` §3](SPEC.MD).

---

## Quick start (dev)

**Requirements:** Bun ≥ 1.3, Node.js ≥ 20, Docker.

```sh
# 1. Install deps
bun install

# 2. Start Postgres (development database only)
docker compose -f docker/docker-compose.dev.yml up -d

# 3. Copy env template and fill secrets
cp .env.example .env
#   BETTER_AUTH_SECRET      openssl rand -base64 48
#   ENCRYPTION_MASTER_KEY   openssl rand -base64 32

# 4. Apply migrations
bun run db:push

# 5. Boot the dev server
bun run dev

# → http://localhost:3000
```

The first account you register at `/auth/sign-up` is automatically the
instance admin. Once you're in, hit **Admin → Providers → Add provider**
to wire a model.

**Local mock model.** For development against an offline LLM (deterministic
`<artifact>` output for parser testing), set `E2E_MOCK_PROVIDER=1` in
`.env` and `NODE_ENV=test` or `development`. This is rejected in production
by the env schema.

---

## Development workflow

```sh
bun run dev             # start the Next.js app (turbo dev)
bun run build           # production build
bun run lint            # ESLint --max-warnings=0 across the monorepo
bun run check-types     # tsc --noEmit across every package
bun run test            # bun test in every package that has tests
bun run db:generate     # drizzle-kit generate (after editing schema.ts)
bun run db:push         # push schema to the local dev database
```

Playwright E2E:

```sh
cd apps/web
bunx playwright install --with-deps chromium   # first time only
NODE_ENV=test E2E_MOCK_PROVIDER=1 bunx playwright test
```

The E2E job runs against a real Postgres in CI; locally point
`DATABASE_URL` at the dev Postgres and Playwright will start
`bun run dev` for you (or `next start` when `CI` is set).

**Adding a schema change**

1. Edit `packages/db/src/schema.ts`.
2. `bun run db:generate` (drizzle-kit produces `packages/db/migrations/N_<name>.sql`).
3. Read the generated SQL. Adjust if you need a backfill step, then
   apply with `bun run db:push` in dev.
4. Migrations are **forward-only**; never edit after merge (guardrails #8).

---

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first.

- Fork → feature branch (`feat/<slug>` / `fix/<slug>`) → PR to `main`.
- Every commit must be **signed off** (DCO): `git commit -s`.
- Follow **Conventional Commits** — `feat|fix|docs|refactor|test|chore|ci|perf(scope): subject`.
- Add a **changeset** (`bun changeset`) for user-facing changes.
- CI must be green: DCO, lint, typecheck, unit, integration, docker, E2E, CodeQL, Semgrep.

### Working with AI agents

AI-assisted contributions are welcome. Agents must follow the
[`docs/agents/`](docs/agents/) rules — the root `AGENTS.md` and
`CLAUDE.md` are thin pointers to that directory. You own what you
submit: PRs showing signs of unreviewed generation (dead code, invented
APIs, guardrail violations) will be closed.

---

## Security

- Every provider API key is encrypted at rest with AES-256-GCM
  (see [`SPEC.MD` §7](SPEC.MD)).
- The artifact sandbox is `<iframe sandbox="allow-scripts">` on an
  opaque origin; the host validates a mount-scoped UUID token on every
  `postMessage`. Model output is treated as untrusted input across the
  whole surface.
- Boot-time refuses to start in production with default or missing
  `BETTER_AUTH_SECRET` / `ENCRYPTION_MASTER_KEY`.
- No telemetry, no phone-home.

Report vulnerabilities privately per [`SECURITY.md`](SECURITY.md).

---

## Roadmap

**Phase 0 — Foundation** (done)
Linters, formatters, CI, changesets, release-please, OSS files.

**Phase 1 — Data & auth core** (done)
Drizzle schema, migrations, Better-Auth with `organization` and
`admin` plugins, first-run promotion, permission helper.

**Phase 2 — AI core** (done)
Provider registry over the Vercel AI SDK, `KeyStore` crypto, artifact
tag parser, `/api/chat` streaming with `onEnd` persistence.

**Phase 3 — Workspace UI** (done)
Two-panel layout, chat stream, artifact panel with Preview/Code/Versions,
iframe sandbox with token-validated `postMessage`, model picker.

**Phase 4 — Admin panel & audit** (done)
Instance admin: provider CRUD (with model discovery + per-model
settings), user management, registration modes, append-only audit log
viewer, rate limiting.

**Phase 5 — Ship** (in progress)
Full Dockerfile + compose profiles, `docs/self-hosting.md`, README
polish, seed demo data, tag `v0.1.0`, repo goes public.

**Post-MVP** (v0.2+)
React/TSX artifacts via esbuild-wasm · MCP client (stdio + SSE) · RAG
(pgvector, uploads, Redis + BullMQ, worker) · groups & token limits ·
per-org provider overrides · Vault/KMS `KeyStore` backend · SSO ·
workspace-level roles.

Full details: [`SPEC.MD` §10](SPEC.MD).

---

## License

[Apache-2.0](LICENSE).
