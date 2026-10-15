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
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }

  if (!getConfiguredAdminIds().has(userId)) {
    res.status(403).json({ error: "Staff access is not configured" });
    return;
  }

  next();
}
