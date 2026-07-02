---
"stanzachat": minor
---

Phase 1: Data & auth core — packages/db (Drizzle schema, migrations, db client), packages/auth (Better-Auth with organization + admin plugins, first-run promotion, permission helper), packages/shared (env schema, typed errors, domain constants). Sign-up/sign-in pages at /auth/sign-in and /auth/sign-up. First registered user becomes instance admin; personal org and default workspace auto-created; registration mode enforced.
