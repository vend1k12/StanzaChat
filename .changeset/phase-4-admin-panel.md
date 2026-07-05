---
"stanzachat": minor
---

Phase 4: Admin panel & audit (SPEC §5.5, §5.6, §10) with full
warm-canvas editorial redesign (DESIGN.md).

**Backend — audit + admin API + rate-limit**

Every mutating admin action writes an `audit_logs` row in the SAME
transaction as its state change (guardrails #9 append-only): provider
create/update/delete, user role change, ban/unban, settings update.
Rate-limiting on `/api/chat` (per user) and all `/api/admin/*` routes
(per IP) via a new `@repo/shared/rate-limit` in-memory fixed-window
helper — the Redis-swap seam for v0.2. New API: `GET /api/admin/users`,
`PATCH /api/admin/users/[id]` (role + ban), `GET/PATCH /api/admin/settings`,
`GET /api/admin/audit-logs`.

**Security fixes**

- Admin cannot demote or ban themselves (self-lockout guard, 403).
- Admin cannot demote the last remaining instance admin (last-admin
  guard inside the same transaction as the role update, with a 409
  ConflictError surface to the UI).
- Both guards covered by a new E2E test in `admin.spec.ts`.

**Frontend — warm-canvas editorial design system**

Full redesign anchored on `docs/agents/DESIGN.md` (Claude/Anthropic
warm-canvas palette): cream canvas `#faf9f5`, coral primary `#cc785c`,
dark-navy product surfaces `#181715`. Fraunces variable serif (open-
source substitute for Copernicus) + Inter + JetBrains Mono loaded via
next/font. CSS custom-properties wire directly into shadcn token slots
so every existing component inherits the palette without class changes.
Theme default set to `light` (canvas-first; dark toggles to navy).

- `/` — editorial hero: serif headline, coral span, spike-mark brand
  mark, navy terminal mockup card.
- `/auth/sign-in` + `/auth/sign-up` — two-column shell: brand serif
  panel left, form right; cream canvas, no Card wrapper.
- `/admin` — sidebar layout with icon-rail nav, coral user-avatar,
  dashboard with serif stats + navy recent-activity panel.
- `/admin/providers` — stat strip, empty state, card list, "Rotate key"
  inline input, Add-provider modal dialog.
- `/admin/users` — stat strip, role badge pill, self-row highlighted
  coral, self-guard buttons disabled with descriptive titles.
- `/admin/settings` — three-card selector for registration mode (active
  card gets coral ring + glow), readable state section below.
- `/admin/audit` — navy code surface table, action colourised by type,
  IP badge, filter strip above.
- Chat workspace — cream sidebar with spike-mark, coral "admin" badge
  via `ViewerContext` (server-injected role), coral "New chat" CTA,
  serif "A blank page, on purpose" empty state, status dot in header,
  floating composer with focus-ring highlight, coral user bubbles,
  surface-card assistant bubbles with "assistant" eyebrow label, navy
  artifact chip with coral hover, dark code-surface in artifact panel.
