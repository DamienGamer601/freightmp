import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function requireInternal(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-internal-key"];
  if (typeof key !== "string" || key !== env.internalApiKey) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Invalid internal API key" },
    });
    return;
  }
  next();
}
