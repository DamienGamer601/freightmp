import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/error";

const router = Router();

/**
 * Classement public des joueurs.
 * `?metric=km|deliveries` et `?limit=N` (max 100).
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50),
    );
    const metric = req.query.metric === "deliveries" ? "deliveries" : "km";

    const users = await prisma.user.findMany({
      orderBy:
        metric === "deliveries"
          ? [{ deliveriesCompleted: "desc" }, { kilometersDriven: "desc" }]
          : [{ kilometersDriven: "desc" }, { deliveriesCompleted: "desc" }],
      take: limit,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        country: true,
        role: true,
        kilometersDriven: true,
        deliveriesCompleted: true,
        totalPlayTimeSeconds: true,
      },
    });

    res.json({
      metric,
      entries: users.map((user, index) => ({
        rank: index + 1,
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        country: user.country,
        role: user.role,
        kilometersDriven: user.kilometersDriven,
        deliveriesCompleted: user.deliveriesCompleted,
        totalPlayTimeSeconds: user.totalPlayTimeSeconds,
        level:
          Math.floor(
            (Math.round(user.kilometersDriven) + user.deliveriesCompleted * 100) / 1000,
          ) + 1,
      })),
    });
  }),
);

export default router;
