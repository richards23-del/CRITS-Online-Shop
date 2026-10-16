import { spawnSync } from "node:child_process";
import path from "node:path";

const apiDirectory = import.meta.dirname;
const env = {
  ...process.env,
  NODE_ENV: "development",
  PORT: process.env.PORT ?? "8080",
};

const build = spawnSync(
  process.execPath,
  [path.join(apiDirectory, "build.mjs")],
  { cwd: apiDirectory, env, stdio: "inherit" },
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawnSync(
  process.execPath,
  ["--enable-source-maps", path.join(apiDirectory, "dist", "index.mjs")],
  { cwd: apiDirectory, env, stdio: "inherit" },
);

process.exitCode = server.status ?? 1;
