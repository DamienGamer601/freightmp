import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { hashApiKey, looksLikeApiKey } from "../lib/apiKeys";

/**
 * Authentifie une requête via une clé API `Authorization: Bearer fmp_...`.
 * Les informations de la clé sont disponibles dans `res.locals.apiKey`.
 */
export const requireApiKey: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!looksLikeApiKey(key)) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Clé API requise (Bearer fmp_...)" },
    });
    return;
  }

  try {
    const record = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      include: { user: true },
    });

    if (!record || record.revokedAt) {
      res.status(401).json({
        error: { code: "INVALID_API_KEY", message: "Clé API invalide ou révoquée" },
      });
      return;
    }

    await prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    res.locals.apiKey = {
      id: record.id,
      userId: record.userId,
      name: record.name,
      scopes: record.scopes,
      user: record.user,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/** Exige au moins un scope (si la clé n'a aucun scope, tout est autorisé). */
export function requireScope(scope: string): RequestHandler {
  return (_req, res, next) => {
    const key = res.locals.apiKey as { scopes: string[] } | undefined;
    if (!key) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Clé API requise" },
      });
      return;
    }
    if (key.scopes.length > 0 && !key.scopes.includes(scope)) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: `Scope manquant : ${scope}` },
      });
      return;
    }
    next();
  };
}
