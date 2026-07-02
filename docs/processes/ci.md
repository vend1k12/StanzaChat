# CI Specification

Platform: **GitHub Actions**. Caching: **Turborepo Remote Cache** (Vercel free tier; `TURBO_TOKEN`/`TURBO_TEAM` repo secrets). All jobs below are **required** on every PR to `main`.

## PR pipeline (`.github/workflows/ci.yml`)

| Job           | Contents                                                                          | Notes                                                 |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `lint`        | `bun run lint` + `prettier --check`                                               |                                                       |
| `typecheck`   | `bun run check-types`                                                             |                                                       |
| `unit`        | `bun run test`                                                                    | No network; provider calls mocked                     |
| `integration` | Testcontainers Postgres (pgvector image) suites in `packages/db`, `packages/auth` | Needs Docker on runner (default ubuntu runner has it) |
| `build`       | `bun run build` (turbo, cached)                                                   |                                                       |
| `e2e`         | Playwright against `next start` + compose Postgres, mocked LLM provider           | Uploads trace artifacts on failure                    |
| `docker`      | `docker build -f docker/app.Dockerfile .`                                         | Build only; no push on PRs                            |

Push to `main` additionally publishes the Docker image (`ghcr.io/<org>/stanzachat`) tagged `edge`; release tags publish semver tags + `latest`.

## Security & hygiene workflows

- **CodeQL** (`codeql.yml`): JS/TS analysis on PR + weekly schedule.
- **Semgrep** (`semgrep.yml`): default ruleset + custom rules for guardrails (e.g. flag `allow-same-origin`, raw `req.json()` field access, queries missing scope helper).
- **Dependabot** (`dependabot.yml`): monthly grouped minor/patch updates for bun/npm ecosystem + GitHub Actions; major version bumps are manual unless they are security updates.
- **DCO check**: enforced via the DCO app or `dco-check` action; contributors sign off commits (`git commit -s`).

## Conventions

- Workflows pin action versions by SHA.
- Fail fast: `lint`/`typecheck` run first; heavy jobs depend on them.
- Target: full PR pipeline ≤ 10 min warm-cache.
- A red required check is never bypassed with admin merge except for documented emergencies (revert PRs).
