import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        affiliations: { include: { vtc: true } },
        deliveries: { orderBy: { createdAt: "desc" }, take: 5 },
        bansReceived: { where: { active: true } },
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
      steamId: user.steamId,
      stats: {
        kilometersDriven: user.kilometersDriven,
        deliveriesCompleted: user.deliveriesCompleted,
        totalPlayTimeSeconds: user.totalPlayTimeSeconds,
      },
      vtcs: user.affiliations.map((affiliation) => ({
        name: affiliation.vtc.name,
        tag: affiliation.vtc.tag,
        role: affiliation.role,
      })),
      recentDeliveries: user.deliveries.map((delivery) => ({
        id: delivery.id,
        cargoName: delivery.cargoName,
        fromCity: delivery.fromCity,
        toCity: delivery.toCity,
        distanceKm: delivery.distanceKm,
        income: delivery.income,
        startedAt: delivery.startedAt,
        completedAt: delivery.completedAt,
      })),
      banCount: user.bansReceived.length,
    });
  }),
);

export default router;
