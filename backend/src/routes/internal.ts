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

export default router;
