const errors = [];
const checks = [];

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function check(name, passed, message) {
  if (passed) checks.push(name);
  else errors.push(`${name}: ${message}`);
}

function placeholder(candidate) {
  return /(?:REPLACE_|CHANGE_ME|YOUR_|PRIVATE_DATABASE_HOST|\/\/USER:PASSWORD@|example\.com)/i.test(candidate);
}

for (const name of [
  "DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "CRITS_ADMIN_USER_IDS",
  "MEDIA_UPLOAD_SIGNING_KEY",
  "RESTIC_REPOSITORY",
  "RESTIC_PASSWORD",
  "APP_ORIGIN",
  "DOMAIN",
]) {
  const candidate = value(name);
  check(name, candidate.length > 0 && !placeholder(candidate), "set a real value in the private production environment file.");
}

const databaseUrl = value("DATABASE_URL");
let database;
try {
  database = new URL(databaseUrl);
} catch {
  // The required-value check above reports missing or placeholder values.
}
check(
  "DATABASE_URL",
  Boolean(database && ["postgres:", "postgresql:"].includes(database.protocol)),
  "use a valid PostgreSQL URL.",
);
const sslMode = database?.searchParams.get("sslmode")?.toLowerCase();
check(
  "PostgreSQL TLS",
  Boolean(sslMode && !["disable", "allow", "prefer"].includes(sslMode)),
  "the managed database URL must enable TLS with sslmode=require, verify-ca, or verify-full.",
);

const clerkPublishableKey = value("CLERK_PUBLISHABLE_KEY");
const frontendClerkKey = value("VITE_CLERK_PUBLISHABLE_KEY");
const clerkSecretKey = value("CLERK_SECRET_KEY");
check("Clerk production instance", clerkPublishableKey.startsWith("pk_live_") && clerkSecretKey.startsWith("sk_live_"), "use matching Clerk Production instance keys, never development keys.");
check("Clerk public key consistency", frontendClerkKey === clerkPublishableKey, "VITE_CLERK_PUBLISHABLE_KEY and CLERK_PUBLISHABLE_KEY must be the same production publishable key.");

const adminIds = value("CRITS_ADMIN_USER_IDS").split(",").map((id) => id.trim()).filter(Boolean);
check("Approved staff", adminIds.length > 0 && adminIds.every((id) => /^user_[A-Za-z0-9]+$/.test(id)), "provide at least one Clerk user ID (user_...), not an email address.");
check("Media signing key", Buffer.byteLength(value("MEDIA_UPLOAD_SIGNING_KEY")) >= 32, "use a unique random secret of at least 32 bytes.");

const backupRepository = value("RESTIC_REPOSITORY");
check(
  "Off-host backup repository",
  /^(?:s3|b2|azure|gs|rclone|rest|sftp|swift):/i.test(backupRepository),
  "configure a remote Restic repository; local paths are not an off-host backup.",
);
check(
  "Backup encryption password",
  Buffer.byteLength(value("RESTIC_PASSWORD")) >= 32,
  "use a unique random password of at least 32 bytes and keep it in the host secret manager.",
);

let appOrigin;
try {
  appOrigin = new URL(value("APP_ORIGIN"));
} catch {
  // The required-value check above reports missing or placeholder values.
}
check(
  "Public app origin",
  Boolean(appOrigin && appOrigin.protocol === "https:" && appOrigin.pathname === "/" && !appOrigin.search && !appOrigin.hash && !appOrigin.username && !appOrigin.password),
  "set APP_ORIGIN to the exact HTTPS origin, such as https://shop.example.com, with no path.",
);
const domain = value("DOMAIN");
check("Public domain", Boolean(domain && /^[a-z0-9.-]+$/i.test(domain) && !domain.includes("..")), "set DOMAIN to the same hostname as APP_ORIGIN, without a scheme or path.");
check("Domain matches origin", Boolean(appOrigin && domain && appOrigin.host.toLowerCase() === domain.toLowerCase()), "DOMAIN and APP_ORIGIN must name the same host.");

const proxyHops = value("TRUST_PROXY_HOPS");
check("Trusted proxy count", /^\d+$/.test(proxyHops) && Number.isSafeInteger(Number(proxyHops)) && Number(proxyHops) > 0, "set the exact positive count of trusted reverse proxies (1 for the included Caddy proxy).");

const mediaDirectory = value("MEDIA_DIR");
check("Persistent media directory", mediaDirectory.startsWith("/") || /^[A-Za-z]:[\\/]/.test(mediaDirectory), "use an absolute path mounted to persistent storage.");

if (errors.length > 0) {
  console.error("Production deployment preflight failed:");
  for (const error of errors) console.error(`- ${error}`);
  console.error("Secret values were not printed.");
  process.exit(1);
}

console.log(`Production deployment preflight passed (${checks.length} checks).`);
console.log("Clerk keys, database URLs, signing keys, and staff IDs were checked without printing their values.");
