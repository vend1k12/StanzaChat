import js from "@eslint/js";
import pluginNext from "@next/eslint-plugin-next";
import { globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginTailwind from "eslint-plugin-tailwindcss";
import globals from "globals";
import tseslint from "typescript-eslint";

import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },
  // ── Tailwind CSS v4 lint rules ────────────────────────────────────────────
  // Enabled in Phase 3, once the Tailwind v4 CSS entrypoint exists.
  // `cssConfigPath` is resolved relative to `process.cwd()` at lint time; in
  // this monorepo lint always runs from the consuming app's directory
  // (e.g. `apps/web`) via turbo, so the relative path resolves correctly.
  // The plugin's `configs.recommended` is inlined rather than spread so
  // `tsc --allowJs --checkJs` can reconcile the flat-config type through
  // `@eslint/core` (spreading it copies an incompatible `languageOptions`
  // shape from `@typescript-eslint/utils`).
  {
    plugins: {
      // The plugin is typed against `@typescript-eslint/utils` flat-config
      // types, which have an incompatible `languageOptions` shape vs.
      // `@eslint/core` used elsewhere in this array. The runtime object is
      // fine; the cast is purely for `tsc --checkJs`.
      tailwindcss: /** @type {import("eslint").ESLint.Plugin} */ (
        /** @type {unknown} */ (pluginTailwind)
      ),
    },
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    settings: {
      tailwindcss: {
        cssConfigPath: "app/globals.css",
      },
    },
    rules: {
      // Rules mirror `pluginTailwind.configs.recommended.rules` (see the
      // plugin's exported preset). Kept explicit so a plugin upgrade that
      // ships a stricter default cannot silently fail our CI.
      "tailwindcss/classnames-order": "warn",
      "tailwindcss/enforces-negative-arbitrary-values": "warn",
      "tailwindcss/enforces-shorthand": "warn",
      "tailwindcss/no-arbitrary-value": "off",
      "tailwindcss/no-contradicting-classname": "error",
      "tailwindcss/no-unnecessary-arbitrary-value": "warn",
      // Whitelist custom classnames that ship with shadcn/ui components
      // (e.g. sonner's `toaster` group hook). Keep the list tight so that
      // real typos still surface.
      "tailwindcss/no-custom-classname": [
        "warn",
        {
          whitelist: [
            // sonner `<Toaster/>` receives `className="toaster group"`
            "toaster",
            // warm-canvas design-system utilities declared in
            // apps/web/app/globals.css `@layer components` (DESIGN.md).
            "spike-mark",
            "eyebrow",
            "hairline",
            "surface-card",
            "surface-dark",
            "surface-dark-elevated",
          ],
        },
      ],
    },
  },
];
