import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/error";

const router = Router();

/** Annonces publiées (pour la landing page). */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const announcements = await prisma.announcement.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { author: { select: { username: true } } },
    });

    res.json(
      announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        authorUsername: announcement.author.username,
        createdAt: announcement.createdAt,
      })),
    );
  }),
);

export default router;
