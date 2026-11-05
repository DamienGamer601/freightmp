import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";
import { env } from "../config/env";
import { signLinkToken } from "../auth/linkTokens";
import { buildSteamLoginUrl } from "../auth/steam";
import { buildDiscordLoginUrl } from "../auth/discord";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { server: { select: { name: true, game: true } } },
        },
        bansReceived: {
          orderBy: { createdAt: "desc" },
          include: { issuer: { select: { username: true } } },
        },
        affiliations: { include: { vtc: true } },
        vtcOwned: { include: { _count: { select: { members: true } } } },
      },
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      steamId: user.steamId,
      discordId: user.discordId,
      avatarUrl: user.avatarUrl,
      country: user.country,
      bio: user.bio,
      bannerUrl: user.bannerUrl,
      title: user.title,
      accentColor: user.accentColor,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        kilometersDriven: user.kilometersDriven,
        deliveriesCompleted: user.deliveriesCompleted,
        totalPlayTimeSeconds: user.totalPlayTimeSeconds,
      },
      deliveries: user.deliveries.map(toDeliveryDto),
      bans: user.bansReceived.map((ban) => ({
        id: ban.id,
        type: ban.type,
        reason: ban.reason,
        active: ban.active,
        expiresAt: ban.expiresAt,
        createdAt: ban.createdAt,
        issuer: ban.issuer ? { username: ban.issuer.username } : null,
      })),
      affiliations: user.affiliations.map((affiliation) => ({
        vtcId: affiliation.vtcId,
        name: affiliation.vtc.name,
        tag: affiliation.vtc.tag,
        role: affiliation.role,
        joinedAt: affiliation.joinedAt,
      })),
      ownedVtcs: user.vtcOwned.map((vtc) => ({
        id: vtc.id,
        name: vtc.name,
        tag: vtc.tag,
        memberCount: vtc._count.members,
      })),
    });
  }),
);

const updateUsernameSchema = z.object({
  username: z.string().trim().min(3).max(32),
});

router.patch(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { username } = updateUsernameSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { username, NOT: { id: req.user!.id } },
    });
    if (existing) {
      throw new AppError(409, "USERNAME_TAKEN", "Username already taken");
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { username },
    });

    res.json({ id: updated.id, username: updated.username });
  }),
);

const updateProfileSchema = z.object({
  bio: z.string().max(160).nullable().optional(),
  bannerUrl: z.string().max(500).nullable().optional(),
  title: z.string().max(40).nullable().optional(),
  accentColor: z
    .enum(["rouge", "sky", "emerald", "amber", "violet", "zinc"])
    .nullable()
    .optional(),
  country: z.string().length(2).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
});

router.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = updateProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl || null } : {}),
        ...(body.title !== undefined ? { title: body.title || null } : {}),
        ...(body.accentColor !== undefined ? { accentColor: body.accentColor } : {}),
        ...(body.country !== undefined
          ? { country: body.country ? body.country.toUpperCase() : null }
          : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl || null } : {}),
      },
    });

    res.json({
      bio: updated.bio,
      bannerUrl: updated.bannerUrl,
      title: updated.title,
      accentColor: updated.accentColor,
      avatarUrl: updated.avatarUrl,
      country: updated.country,
    });
  }),
);

router.get(
  "/deliveries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
    );
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20),
    );
    const game = req.query.game;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const where: Prisma.DeliveryWhereInput = { userId: req.user!.id };
    if (game === "ETS2" || game === "ATS") {
      where.server = { game };
    }
    if (search) {
      where.OR = [
        { cargoName: { contains: search, mode: "insensitive" } },
        { fromCity: { contains: search, mode: "insensitive" } },
        { toCity: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, deliveries] = await Promise.all([
      prisma.delivery.count({ where }),
      prisma.delivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { server: { select: { name: true, game: true } } },
      }),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      deliveries: deliveries.map(toDeliveryDto),
    });
  }),
);

function toDeliveryDto(delivery: {
  id: string;
  cargoName: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  income: number;
  startedAt: Date;
  completedAt: Date | null;
  server: { name: string; game: string } | null;
}) {
  return {
    id: delivery.id,
    cargoName: delivery.cargoName,
    fromCity: delivery.fromCity,
    toCity: delivery.toCity,
    distanceKm: delivery.distanceKm,
    income: delivery.income,
    startedAt: delivery.startedAt,
    completedAt: delivery.completedAt,
    server: delivery.server
      ? { name: delivery.server.name, game: delivery.server.game }
      : null,
  };
}

/* ---------- Liaison de comptes (Steam ↔ Discord) ---------- */

/** POST /api/v1/me/link/steam — renvoie l'URL Steam pour lier un compte. */
router.post(
  "/link/steam",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = signLinkToken(req.user!.id, "steam");
    const url = buildSteamLoginUrl(
      `${env.steamReturnUrl}?link=${encodeURIComponent(token)}`,
    );
    res.json({ url });
  }),
);

/** POST /api/v1/me/link/discord — renvoie l'URL Discord pour lier un compte. */
router.post(
  "/link/discord",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = signLinkToken(req.user!.id, "discord");
    const url = buildDiscordLoginUrl(env.discordReturnUrl, undefined, token);
    res.json({ url });
  }),
);

/** POST /api/v1/me/unlink/:provider — délie Steam ou Discord. */
router.post(
  "/unlink/:provider",
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== "steam" && provider !== "discord") {
      throw new AppError(400, "BAD_REQUEST", "Fournisseur invalide");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { steamId: true, discordId: true },
    });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Utilisateur introuvable");
    }

    const target = provider === "steam" ? user.steamId : user.discordId;
    if (!target) {
      throw new AppError(400, "NOT_LINKED", "Ce fournisseur n'est pas lié");
    }

    const linkedCount = [user.steamId, user.discordId].filter(Boolean).length;
    if (linkedCount <= 1) {
      throw new AppError(
        409,
        "LAST_PROVIDER",
        "Impossible de délier votre dernière méthode de connexion",
      );
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: provider === "steam" ? { steamId: null } : { discordId: null },
    });

    res.json({ ok: true });
  }),
);

export default router;
