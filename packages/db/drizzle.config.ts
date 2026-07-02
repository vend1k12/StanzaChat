import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for drizzle-kit commands");
}

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  out: "./migrations",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
