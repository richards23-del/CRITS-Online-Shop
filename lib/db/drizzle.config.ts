import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import path from "path";
import { loadEnvFile } from "node:process";

const localEnvPath = path.resolve(process.cwd(), "../../.env.local");
if (existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/crits.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
