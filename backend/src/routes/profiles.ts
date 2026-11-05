import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

/**
 * Profil public d'un joueur, accessible par pseudo (page partageable /p/<pseudo>).
 * N'expose pas les identifiants Steam/Discord ni les sanctions levées.
 */
router.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { server: { select: { name: true, game: true } } },
        },
        affiliations: { include: { vtc: true } },
        vtcOwned: { include: { _count: { select: { members: true } } } },
        bansReceived: {
          where: { active: true },
          select: { id: true, type: true, reason: true, expiresAt: true },
        },
      },
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Player not found");
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
      country: user.country,
      bio: user.bio,
      bannerUrl: user.bannerUrl,
      title: user.title,
      accentColor: user.accentColor,
      createdAt: user.createdAt,
      stats: {
        kilometersDriven: user.kilometersDriven,
        deliveriesCompleted: user.deliveriesCompleted,
        totalPlayTimeSeconds: user.totalPlayTimeSeconds,
      },
      linkedAccounts: {
        steam: Boolean(user.steamId),
        discord: Boolean(user.discordId),
      },
      deliveries: user.deliveries.map((delivery) => ({
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
      activeBans: user.bansReceived.map((ban) => ({
        id: ban.id,
        type: ban.type,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
      })),
    });
  }),
);

export default router;
