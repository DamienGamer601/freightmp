import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

router.use(requireAuth);

/** Liste des notifications de l'utilisateur connecté + compteur non lu. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, read: false },
      }),
    ]);

    res.json({
      unreadCount,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        read: notification.read,
        createdAt: notification.createdAt,
      })),
    });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification || notification.userId !== req.user!.id) {
      throw new AppError(404, "NOT_FOUND", "Notification not found");
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });

    res.json({ id: updated.id, read: updated.read });
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  }),
);

export default router;
