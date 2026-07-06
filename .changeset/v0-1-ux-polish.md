---
"stanzachat": minor
---

v0.1 UX polish + provider editing, model discovery, and per-model
settings.

**Workspace UX**

- `/` no longer serves a marketing landing — anonymous visitors redirect
  to `/auth/sign-in?redirect=/chats`, signed-in visitors go straight to
  `/chats`.
- The chat workspace opens in a **draft** state on `/chats` and only
  creates the DB row when the user submits the first message; the URL
  swaps to `/chats/{id}` via `router.replace` without remounting the
  stream (no lost tokens between "New chat" click and first response).
- Compact chat sidebar: tighter rows, grouped by `Today / Yesterday /
Previous 7 days / Older` with eyebrow headings.
- Admin sidebar now fills the viewport (sticky `h-dvh` grid + scrollable
  main) instead of hugging the content height.
- New segmented `Cards / Table` view toggle on `/admin/users` and
  `/admin/audit`, persisted per-surface in `localStorage`.

**Admin: full provider editing**

- New `ProviderFormDialog` handles Add + Edit — `label`, `baseUrl`,
  `apiKey` (blank = keep stored), `isDefault`, model list. Provider kind
  is locked after creation (changing the wire-format would break chat
  history). The old inline "Rotate key" row action is folded into Edit.
- Every deletion (chat, provider) uses the new focus-trapped
  `<AlertDialog>` instead of browser `confirm()`, wired through a single
  imperative `useConfirm()` hook mounted at the root.

**Admin: model discovery**

- New helper `packages/ai/src/discover-models.ts` probes an OpenAI-family
  provider's `GET {baseUrl}/models` server-side (openai,
  openai-compatible, ollama). Anthropic / Google stay manual — their
  catalogues use different shapes and aren't listed in v0.1.
- Two routes: `POST /api/admin/providers/discover` for the Add dialog
  (key sent in body) and `POST /api/admin/providers/:id/discover` for
  Edit (uses the stored key so admins don't re-enter it).
- The dialog surfaces a `Discover from /v1/models` button (spinner while
  probing, merged into the chip-editor); helpful codes on failure
  (`discover.http_error` → 401 rejected the key, 404 → wrong base URL,
  etc.).

**Admin: per-model settings**

- New table `provider_models(provider_id, model_id, display_name,
enabled, temperature, top_p, max_output_tokens, system_prompt)` with
  `unique(provider_id, model_id)` and `ON DELETE CASCADE` from the
  provider. Drizzle migration `0001_provider_models` backfills the
  legacy `enabled_models: string[]` column before dropping it — clean
  cutover, forward-only.
- `resolveChatModel` now returns `{ modelInstance, modelId, settings }`;
  `/api/chat` passes `temperature / topP / maxOutputTokens /
systemPrompt` into `streamText`. Chat-level `systemPrompt` still wins
  over the model default.
- New `ModelSettingsDialog` (accordion per model) + `GET
/api/admin/providers/:id/models` and `PATCH
/api/admin/providers/:id/models/:modelId`. Every mutation writes a
  `model.update` audit row in the same transaction.

**Errors + validation**

- `ValidationError` now carries `details: { fieldErrors, formErrors }`;
  server routes parse via a single `parseWithSchema(schema, body)`
  helper that flattens `ZodError` into that shape. Client `ApiError.details`
  is surfaced under each form input via a `FieldError` component, and a
  human-friendly `errorMessage(err)` maps common codes (including
  `discover.*`) to plain sentences for toasts.

**Chat streaming provider compat**

- `provider-registry.resolveModel` uses `openai.chat(modelId)` for every
  OpenAI-flavoured provider (`openai`, `openai-compatible`, `ollama`)
  so requests hit `/v1/chat/completions` instead of the newer
  `/responses` endpoint most self-hosted gateways (LiteLLM, LocalAI,
  vLLM, one-api, Ollama, custom proxies) don't implement.

**Rule compliance clean-up**

- Removed `ReturnType<typeof …>` exposures from `apps/web/lib/auth-client.ts`
  and `apps/web/app/api/auth/[...all]/route.ts` (project rule
  `ts-no-return-type`).
- Single named-const `as LanguageModel` inside `packages/ai/src/model-resolver.ts`
  (library type isn't exportable as a single alias); no inline casts on
  property access elsewhere (project rule `ts-no-inline-cast-access`).

**Testing**

- `admin.spec.ts` updated for the tokenised chip editor.
- `workspace.spec.ts` updated for the draft-mode URL flow and the
  renamed `models` field.
- E2E `admin` (3/3) and `workspace` (1/1) pass locally against Postgres.
