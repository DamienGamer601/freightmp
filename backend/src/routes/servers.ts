import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/error";

const router = Router();

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const servers = await prisma.server.findMany({
      orderBy: [{ game: "asc" }, { name: "asc" }],
    });

    const totalOnline = servers.reduce((sum, server) => sum + server.onlinePlayers, 0);

    res.json({
      updatedAt: new Date().toISOString(),
      totalOnline,
      totalServers: servers.length,
      servers: servers.map((server) => ({
        id: server.id,
        name: server.name,
        slug: server.slug,
        game: server.game,
        status: server.status,
        onlinePlayers: server.onlinePlayers,
        maxPlayers: server.maxPlayers,
        region: server.region,
        version: server.version,
        host: server.host,
        port: server.port,
        lastHeartbeatAt: server.lastHeartbeatAt,
      })),
    });
  }),
);

export default router;
