import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
      return;
    }

    next();
  };
}
