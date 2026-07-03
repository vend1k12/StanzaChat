import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for drizzle-kit commands");
}

export default defineConfig({
  dialect: "postgresql",
  // SPEC §4 / schema.ts header: table/column names are snake_case even
  // though Drizzle objects use camelCase keys. Without this, `db:push`
  // materialises camelCase columns (e.g. `emailVerified`) that don't
  // match the snake_case SQL Better-Auth generates (`email_verified`),
  // breaking signup. `casing: "snake_case"` makes Drizzle map camelCase
  // keys → snake_case column names consistently across the schema.
  casing: "snake_case",
  dbCredentials: {
    url: databaseUrl,
  },
  out: "./migrations",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
