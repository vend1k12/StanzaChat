import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginSecurity from "eslint-plugin-security";
import pluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint flat configuration for the StanzaChat monorepo.
 *
 * Composition rationale:
 * - `js.configs.recommended` + `tseslint.configs.recommended` establish
 *   the language baseline.
 * - `eslintConfigPrettier` is placed near the end so it disables
 *   stylistic rules from every earlier plugin (Prettier owns formatting).
 * - `eslint-plugin-security` (recommended) enforces the SPEC §2 lint row
 *   security ruleset. Rules stay at their plugin-recommended severity
 *   (warn); a rule disable requires an inline reason per
 *   docs/agents/conventions.md.
 * - `eslint-plugin-simple-import-sort` is chosen over the older
 *   `eslint-plugin-import` + `import/order` pair because it is
 *   zero-config, deterministic, and does not depend on the fragile TS
 *   import resolver. Both `sort-imports` and `sort-exports` fire as
 *   errors so CI blocks unsorted import graphs.
 * - `eslint-plugin-only-warn` is intentionally NOT included: per
 *   docs/agents/conventions.md formatting rule, we "fix, don't disable"
 *   — silently downgrading every error to a warning is an anti-pattern
 *   that lets rot land in CI. Use `eslint --max-warnings=0` at the call
 *   site if you want warnings to gate.
 * - `eslint-plugin-drizzle` lives in a dedicated `./drizzle` export
 *   (see drizzle.js) so packages that never touch Drizzle do not pay
 *   the peer-rule cost; `packages/db` will opt in when it lands.
 * - `eslint-plugin-tailwindcss` is enabled in the `next-js` preset
 *   (see next.js) because it needs a `settings.tailwindcss.cssConfigPath`
 *   pointing at the Tailwind v4 CSS entrypoint (`apps/web/app/globals.css`).
 *   Packages that never emit UI classnames don't pay the peer-rule cost.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
      "simple-import-sort": pluginSimpleImportSort,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  eslintConfigPrettier,
  {
    ignores: ["dist/**", ".next/**", ".turbo/**", "coverage/**"],
  },
];
