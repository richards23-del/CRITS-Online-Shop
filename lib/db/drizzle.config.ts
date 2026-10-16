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
  schema: path.resolve(__dirname, "./src/schema/crits.ts").replaceAll("\\", "/"),
  out: path.resolve(__dirname, "./migrations").replaceAll("\\", "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
