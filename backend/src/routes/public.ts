import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/error";
import { requireApiKey, requireScope } from "../middleware/apiKey";

const router = Router();

/**
 * Ces routes constituent l'API publique (authentification par clé API).
 * Documentation : GET /api/v1/openapi.json
 */

/** GET /api/v1/public/servers — état des serveurs. */
router.get(
  "/servers",
  requireApiKey,
  requireScope("servers:read"),
  asyncHandler(async (_req, res) => {
    const servers = await prisma.server.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        game: true,
        status: true,
        region: true,
        maxPlayers: true,
        onlinePlayers: true,
        version: true,
      },
    });
    res.json({ servers });
  }),
);

/** GET /api/v1/public/leaderboard — classement des joueurs. */
router.get(
  "/leaderboard",
  requireApiKey,
  requireScope("players:read"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const players = await prisma.user.findMany({
      orderBy: { kilometersDriven: "desc" },
      take: limit,
      select: {
        id: true,
        username: true,
        country: true,
        avatarUrl: true,
        kilometersDriven: true,
        deliveriesCompleted: true,
      },
    });
    res.json({ players });
  }),
);

/** GET /api/v1/public/events — événements à venir. */
router.get(
  "/events",
  requireApiKey,
  requireScope("events:read"),
  asyncHandler(async (_req, res) => {
    const events = await prisma.event.findMany({
      where: { startAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        location: true,
        game: true,
        organizer: { select: { username: true } },
      },
    });
    res.json({ events });
  }),
);

/** GET /api/v1/public/me — informations de la clé utilisée. */
router.get(
  "/me",
  requireApiKey,
  asyncHandler(async (_req, res) => {
    const key = res.locals.apiKey as {
      id: string;
      name: string;
      scopes: string[];
      user: { id: string; username: string; role: string };
    };
    res.json({
      keyId: key.id,
      keyName: key.name,
      scopes: key.scopes,
      owner: {
        id: key.user.id,
        username: key.user.username,
        role: key.user.role,
      },
    });
  }),
);

export default router;
