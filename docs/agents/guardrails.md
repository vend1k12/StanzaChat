# Guardrails — Hard Constraints

Violating any of these is a P0. When in doubt, stop and ask the maintainer.

## Security

1. **Sandbox:** `<iframe sandbox="allow-scripts">` and nothing more. Never add `allow-same-origin`, `allow-popups`, or `allow-top-navigation`. Never render model output outside the sandbox without strict sanitization (markdown allowlist).
2. **postMessage:** every message between host and sandbox carries the mount-scoped UUID token and is validated on both sides; `event.source` is checked. No token → drop silently.
3. **Provider keys:** encrypted at rest (AES-256-GCM via `KeyStore`), decrypted only server-side within a request, never in responses/logs/client bundles. Admin UI shows only a masked fingerprint.
4. **Boot secrets:** app must refuse to start in production with missing/default `BETTER_AUTH_SECRET` or `ENCRYPTION_MASTER_KEY`.
5. **Model output is untrusted input** — everywhere: chat pane, artifact content, titles, identifiers. Sanitize/escape accordingly.

## Tenancy

6. Every tenant-data query filters by the scope chain (org → workspace → chat). New data-access functions without a scope parameter don't merge.
7. Authorization goes through the single `packages/auth` helper. No inline role checks in handlers/components.

## Data

8. Migrations are forward-only, generated, and never edited after merge. Destructive migrations (drop/rename with data) require an explicit maintainer sign-off in the PR.
9. `audit_logs` is append-only. No updates, no deletes, no "cleanup" endpoints.

## Scope

10. Deferred features (SPEC §1.2) are not implemented "while we're at it" — not even behind flags. SPEC edit first.
11. No new services (Redis, workers, external SaaS) in v0.1. The compose file stays two services: `postgres`, `app`.
12. No telemetry/analytics/phone-home of any kind without an explicit opt-in feature spec.

## Process

13. Never commit secrets, `.env` files, or real API keys — including in tests and fixtures (use obvious fakes).
14. Never force-push `main` or edit released tags/changelogs.
