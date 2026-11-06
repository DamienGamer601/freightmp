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

/* ---------- Bans (utilisés par le serveur multijoueur) ---------- */

/** GET /api/v1/internal/bans/check?userId=… — un compte est-il banni ? */
router.get(
  "/bans/check",
  asyncHandler(async (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    if (!userId) {
      res.json({ banned: false });
      return;
    }

    const now = new Date();
    const ban = await prisma.ban.findFirst({
      where: {
        userId,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!ban) {
      res.json({ banned: false });
      return;
    }

    res.json({
      banned: true,
      type: ban.type,
      reason: ban.reason,
      expiresAt: ban.expiresAt,
    });
  }),
);

const createBanSchema = z.object({
  userId: z.string().min(1),
  issuerId: z.string().min(1),
  type: z.enum(["WARNING", "TEMPORARY", "PERMANENT"]).optional(),
  reason: z.string().min(3).max(500),
  expiresAt: z.string().optional(),
});

/** POST /api/v1/internal/bans — crée un ban (panneau admin in-game). */
router.post(
  "/bans",
  asyncHandler(async (req, res) => {
    const body = createBanSchema.parse(req.body);

    const ban = await prisma.ban.create({
      data: {
        userId: body.userId,
        issuerId: body.issuerId,
        type: body.type ?? "PERMANENT",
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    res.json({ ok: true, ban: { id: ban.id, type: ban.type, reason: ban.reason } });
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

/* ---------- Données de démonstration ---------- */

const DEMO_DRIVERS = [
  { username: "Lucas_Martin", country: "FR", km: 48250, deliveries: 96, hours: 142 },
  { username: "Sophie_Duval", country: "FR", km: 39120, deliveries: 78, hours: 118 },
  { username: "Max_Trucker", country: "BE", km: 31480, deliveries: 61, hours: 95 },
  { username: "Nils_Autobahn", country: "DE", km: 27890, deliveries: 54, hours: 88 },
  { username: "Emma_Roads", country: "CA", km: 22340, deliveries: 47, hours: 71 },
  { username: "Tom_Longhaul", country: "GB", km: 19870, deliveries: 39, hours: 63 },
];

const CARGO = [
  "Acier laminé",
  "Produits frais",
  "Électronique",
  "Bois de construction",
  "Carburant",
  "Machines agricoles",
];

const ROUTES = [
  ["Paris", "Lyon"],
  ["Marseille", "Bordeaux"],
  ["Lille", "Strasbourg"],
  ["Toulouse", "Nantes"],
  ["Bruxelles", "Amsterdam"],
  ["Berlin", "Munich"],
];

/** POST /api/v1/internal/seed-demo — crée des joueurs/livraisons de démo. */
router.post(
  "/seed-demo",
  asyncHandler(async (_req, res) => {
    let created = 0;
    for (const driver of DEMO_DRIVERS) {
      const existing = await prisma.user.findUnique({
        where: { username: driver.username },
      });
      if (existing) {
        continue;
      }

      const user = await prisma.user.create({
        data: {
          username: driver.username,
          country: driver.country,
          role: "DRIVER",
          kilometersDriven: driver.km,
          deliveriesCompleted: driver.deliveries,
          totalPlayTimeSeconds: driver.hours * 3600,
          bio: `Chauffeur ${driver.country} · ${driver.deliveries} livraisons au compteur.`,
        },
      });
      created += 1;

      const count = Math.min(6, driver.deliveries);
      for (let index = 0; index < count; index += 1) {
        const [fromCity, toCity] = ROUTES[index % ROUTES.length];
        const distance = 400 + ((index * 137 + driver.km) % 900);
        const completedAt = new Date(Date.now() - (index + 1) * 86_400_000);
        await prisma.delivery.create({
          data: {
            userId: user.id,
            cargoName: CARGO[index % CARGO.length],
            fromCity,
            toCity,
            distanceKm: distance,
            income: Math.round(distance * 2.4),
            startedAt: new Date(completedAt.getTime() - 3 * 3_600_000),
            completedAt,
          },
        });
      }
    }

    res.json({ ok: true, usersCreated: created });
  }),
);

export default router;
