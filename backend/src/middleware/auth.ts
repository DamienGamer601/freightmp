import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/tokens";
import { parseCookies } from "../lib/cookies";
import { prisma } from "../lib/prisma";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : undefined;
    // Cookie HttpOnly prioritaire ; fallback Bearer pour la rétro-compatibilité.
    const cookieToken = parseCookies(req.headers.cookie)["fmp_access"];
    const token = cookieToken ?? bearerToken;

    if (!token) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Missing or malformed authorization" },
      });
      return;
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User not found" } });
      return;
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}
