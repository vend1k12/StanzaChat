---
"stanzachat": minor
---

Phase 4: Admin panel & audit (SPEC §5.5, §5.6, §10). New instance-admin
UI at `/admin` covering providers, users, instance settings, and an
audit-log viewer with actor/action/date filters and offset pagination.
Every mutating admin action writes an `audit_logs` row in the SAME
transaction as its state change (guardrails #9 append-only): provider
create/update/delete, user role change, ban/unban, settings update.
Rate-limiting added to `/api/chat` (per authenticated user) and to
every `/api/admin/*` route (per IP) via a new in-memory fixed-window
limiter in `@repo/shared/rate-limit` — the SPEC §7 interface seam that
swaps to a Redis backend in v0.2. New API surface: `GET /api/admin/users`,
`PATCH /api/admin/users/[id]` (role + ban), `GET/PATCH /api/admin/settings`,
`GET /api/admin/audit-logs`. Role changes now evict `resolveScope`'s
in-process cache for the target user. Playwright `admin.spec.ts` covers
the SPEC Phase 4 done-when: admin adds a provider (key masked in UI +
audit row appears), non-admin gets `redirect → /chats` on the UI and a
403 from `/api/admin/providers`. Playwright configured with `workers: 1`
so specs that rely on first-run promotion don't race.
