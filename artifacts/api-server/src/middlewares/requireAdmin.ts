import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function getConfiguredAdminIds(): Set<string> {
  return new Set(
    (process.env.CRITS_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    res.status(503).json({ error: "Staff sign-in is not configured." });
    return;
  }

  const adminIds = getConfiguredAdminIds();
  if (adminIds.size === 0) {
    res.status(503).json({ error: "No approved staff accounts are configured." });
    return;
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    const host = req.get("host");
    let sameOrigin = false;
    try {
      sameOrigin =
        typeof origin === "string" &&
        typeof host === "string" &&
        new URL(origin).origin.toLowerCase() ===
          (process.env.APP_ORIGIN
            ? new URL(process.env.APP_ORIGIN).origin.toLowerCase()
            : `${req.protocol}://${host}`.toLowerCase()) &&
        new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      res.status(403).json({ error: "Cross-origin write requests are not allowed." });
      return;
    }
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }

  if (!adminIds.has(userId)) {
    res.status(403).json({ error: "This Clerk account is not approved for staff access." });
    return;
  }

  next();
}
