import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireInternal } from "../middleware/internalAuth";
import { asyncHandler } from "../middleware/error";
import { broadcastAll } from "../websocket/server";

const router = Router();

router.use(requireInternal);

router.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { discordId: { not: null } },
      select: { discordId: true, username: true, role: true },
    });

    res.json({ users });
  }),
);

const heartbeatSchema = z.object({
  slug: z.string().min(1),
  onlinePlayers: z.number().int().min(0),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE"]).optional(),
  version: z.string().optional(),
});

router.post(
  "/servers/heartbeat",
  asyncHandler(async (req, res) => {
    const body = heartbeatSchema.parse(req.body);

    const server = await prisma.server.upsert({
      where: { slug: body.slug },
      update: {
        onlinePlayers: body.onlinePlayers,
        status: body.status ?? "ONLINE",
        version: body.version,
        lastHeartbeatAt: new Date(),
      },
      create: {
        slug: body.slug,
        name: body.slug,
        game: "ETS2",
        status: body.status ?? "ONLINE",
        onlinePlayers: body.onlinePlayers,
        version: body.version,
        host: "127.0.0.1",
        port: 27015,
        lastHeartbeatAt: new Date(),
      },
    });

    broadcastAll({
      type: "server:status",
      server: {
        slug: server.slug,
        status: server.status,
        onlinePlayers: server.onlinePlayers,
        maxPlayers: server.maxPlayers,
      },
    });

    res.json(server);
  }),
);

/** GET /api/v1/internal/users — liste des comptes (diagnostic). */
router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        steamId: true,
        discordId: true,
        role: true,
        createdAt: true,
      },
    });
    res.json({ users });
  }),
);

const detachSchema = z.object({
  provider: z.enum(["steam", "discord"]),
  value: z.string().min(1),
});

/**
 * POST /api/v1/internal/users/detach — détache un fournisseur OAuth de tous les
 * comptes qui le portent (maintenance : résout les "déjà lié à un autre compte").
 */
router.post(
  "/users/detach",
  asyncHandler(async (req, res) => {
    const body = detachSchema.parse(req.body);
    const field = body.provider === "steam" ? "steamId" : "discordId";

    const result = await prisma.user.updateMany({
      where: { [field]: body.value },
      data: { [field]: null },
    });

    res.json({ ok: true, detached: result.count, provider: body.provider });
  }),
);

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["DRIVER", "MODERATOR", "ADMIN", "DEV"]),
});

/** POST /api/v1/internal/users/role — change le rôle d'un compte (bootstrap admin). */
router.post(
  "/users/role",
  asyncHandler(async (req, res) => {
    const body = roleSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: body.userId },
      data: { role: body.role },
      select: { id: true, username: true, role: true },
    });

    res.json({ ok: true, user });
  }),
);

export default router;
