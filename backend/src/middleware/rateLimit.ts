import type { RequestHandler } from "express";

interface Entry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const hits = new Map<string, Entry>();

// Nettoyage périodique pour éviter une croissance non bornée de la Map.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) {
      hits.delete(key);
    }
  }
}, 5 * 60_000);
cleanup.unref();

/**
 * Rate limiter simple en mémoire (fenêtre fixe par IP).
 * Suffisant pour un environnement de développement / petit déploiement.
 */
export const rateLimiter: RequestHandler = (req, res, next) => {
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();

  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many requests, please slow down" },
    });
    return;
  }

  entry.count += 1;
  next();
};
