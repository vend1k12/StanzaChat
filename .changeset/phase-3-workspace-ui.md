---
"stanzachat": minor
---

Phase 3: Workspace UI — split conversation + artifacts layout (SPEC §5.3),
chat streaming via Vercel AI SDK, per-mount token-validated postMessage
sandbox, artifact version history, model picker, chat sidebar. shadcn/ui
component set added under `apps/web/components/ui`. New API routes:
`/api/models`, `/api/artifacts/[id]` (+ `/versions`, `/versions/[versionId]`),
`/api/chats/[id]/artifacts`. Server-side mock provider wired via
`E2E_MOCK_PROVIDER=1` so Playwright covers the full round-trip (sign-up
→ chat → artifact renders in sandbox → version history navigates —
SPEC §10 Phase 3 done-when). `/api/chat` streaming/persistence logic
extracted into `packages/ai` (`resolveChatModel`, `persistAssistantTurn`)
so the route handler stays thin (architecture.md).
