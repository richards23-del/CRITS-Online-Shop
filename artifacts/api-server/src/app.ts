import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { configuredAppOrigin, validateRuntimeConfig } from "./lib/runtimeConfig";

const app: Express = express();
validateRuntimeConfig();
const configuredProxyHops = process.env.TRUST_PROXY_HOPS;
const trustProxyHops = configuredProxyHops === undefined ? 0 : Number(configuredProxyHops);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
}
app.set("trust proxy", trustProxyHops);
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
  const authorizedParty = configuredAppOrigin();
  app.use(clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    ...(authorizedParty ? { authorizedParties: [authorizedParty] } : {}),
  }));
}

app.use("/api", router);

if (process.env.SERVE_WEB === "true") {
  const webDirectory = path.resolve(process.env.WEB_DIST_DIR ?? "");
  const indexFile = path.join(webDirectory, "index.html");
  if (!existsSync(indexFile)) {
    throw new Error("The storefront build is missing; check WEB_DIST_DIR.");
  }
  app.use(express.static(webDirectory, {
    index: false,
    maxAge: "1d",
    setHeaders(res, filePath) {
      if (path.basename(filePath) === "index.html") {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      req.path === "/api" ||
      req.path.startsWith("/api/") ||
      path.extname(req.path) !== ""
    ) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexFile);
  });
}

app.use(
  (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (res.headersSent) {
      next(error);
      return;
    }
    req.log.error({ err: error }, "Unhandled API request error");
    res.status(500).json({ error: "An unexpected server error occurred." });
  },
);

export default app;
