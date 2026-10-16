import { existsSync, accessSync, constants } from "node:fs";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured in production.`);
  return value;
}

function validateAppOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN must be a valid HTTPS origin in production.");
  }
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("APP_ORIGIN must be an HTTPS origin without a path in production.");
  }
  return url.origin;
}

export function validateRuntimeConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const databaseUrl = required("DATABASE_URL");
  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (!(["postgres:", "postgresql:"].includes(database.protocol))) {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }
  const sslMode = database.searchParams.get("sslmode")?.toLowerCase();
  if (!sslMode || ["disable", "allow", "prefer"].includes(sslMode)) {
    throw new Error("DATABASE_URL must enable PostgreSQL TLS with sslmode=require, verify-ca, or verify-full.");
  }

  const publishableKey = required("CLERK_PUBLISHABLE_KEY");
  const secretKey = required("CLERK_SECRET_KEY");
  if (!publishableKey.startsWith("pk_live_") || !secretKey.startsWith("sk_live_")) {
    throw new Error("Production requires Clerk live keys; development keys are not accepted.");
  }

  const adminIds = required("CRITS_ADMIN_USER_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (adminIds.length === 0 || adminIds.some((id) => !/^user_[A-Za-z0-9]+$/.test(id))) {
    throw new Error("CRITS_ADMIN_USER_IDS must contain one or more valid Clerk user IDs.");
  }

  const signingKey = required("MEDIA_UPLOAD_SIGNING_KEY");
  if (Buffer.byteLength(signingKey) < 32) {
    throw new Error("MEDIA_UPLOAD_SIGNING_KEY must contain at least 32 bytes.");
  }

  validateAppOrigin(required("APP_ORIGIN"));

  const rawProxyHops = required("TRUST_PROXY_HOPS");
  const proxyHops = Number(rawProxyHops);
  if (!/^\d+$/.test(rawProxyHops) || !Number.isSafeInteger(proxyHops) || proxyHops < 1) {
    throw new Error("TRUST_PROXY_HOPS must be set to the positive number of trusted HTTPS proxy hops.");
  }

  const mediaDirectory = path.resolve(required("MEDIA_DIR"));
  if (!path.isAbsolute(process.env.MEDIA_DIR!.trim()) || !existsSync(mediaDirectory)) {
    throw new Error("MEDIA_DIR must be an existing persistent directory in production.");
  }
  try {
    accessSync(mediaDirectory, constants.W_OK);
  } catch {
    throw new Error("MEDIA_DIR must be writable by the application user.");
  }

  if (process.env.SERVE_WEB !== "true") {
    throw new Error("SERVE_WEB=true is required for the single-origin production deployment.");
  }
  const webDirectory = path.resolve(required("WEB_DIST_DIR"));
  if (!existsSync(path.join(webDirectory, "index.html"))) {
    throw new Error("WEB_DIST_DIR must point to the built storefront containing index.html.");
  }
}

export function configuredAppOrigin(): string | undefined {
  const value = process.env.APP_ORIGIN?.trim();
  if (!value) return undefined;
  if (process.env.NODE_ENV === "production") return validateAppOrigin(value);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN must be a valid origin.");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("APP_ORIGIN must not contain a path, query, or credentials.");
  }
  return url.origin;
}
