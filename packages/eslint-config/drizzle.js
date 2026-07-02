import pluginDrizzle from "eslint-plugin-drizzle";

import { config as baseConfig } from "./base.js";

/**
 * ESLint flat configuration for packages that consume Drizzle ORM
 * (currently only `packages/db`, opting in once Phase 1 lands).
 *
 * Kept in a dedicated export so pre-Phase-1 packages never pull in the
 * plugin. When `packages/db` exists, its `eslint.config.js` becomes:
 *
 *   import { config } from "@repo/eslint-config/drizzle";
 *   export default config;
 *
 * `drizzleObjectName` is set to the canonical Drizzle db handle name we
 * expect throughout the codebase; adjust here if the convention changes.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...baseConfig,
  {
    plugins: {
      drizzle: pluginDrizzle,
    },
    rules: {
      "drizzle/enforce-delete-with-where": [
        "error",
        { drizzleObjectName: ["db"] },
      ],
      "drizzle/enforce-update-with-where": [
        "error",
        { drizzleObjectName: ["db"] },
      ],
    },
  },
];
