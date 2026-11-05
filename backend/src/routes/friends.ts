import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";
import { notifyUser } from "../lib/notifications";

const router = Router();

router.use(requireAuth);

function friendDto(user: {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

/** Liste des amis, demandes reçues et envoyées. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const userSelect = {
      select: { id: true, username: true, avatarUrl: true, role: true },
    } as const;

    const [accepted, incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: me }, { addresseeId: me }],
        },
        include: { requester: userSelect, addressee: userSelect },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.friendship.findMany({
        where: { status: "PENDING", addresseeId: me },
        include: { requester: userSelect },
        orderBy: { createdAt: "desc" },
      }),
      prisma.friendship.findMany({
        where: { status: "PENDING", requesterId: me },
        include: { addressee: userSelect },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      friends: accepted.map((friendship) => {
        const other =
          friendship.requesterId === me
            ? friendship.addressee
            : friendship.requester;
        return { ...friendDto(other), since: friendship.updatedAt };
      }),
      incoming: incoming.map((friendship) => ({
        id: friendship.id,
        user: friendDto(friendship.requester),
        createdAt: friendship.createdAt,
      })),
      outgoing: outgoing.map((friendship) => ({
        id: friendship.id,
        user: friendDto(friendship.addressee),
        createdAt: friendship.createdAt,
      })),
    });
  }),
);

/** Statut d'amitié avec un joueur (pour le bouton « Ajouter en ami »). */
router.get(
  "/status/:username",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const target = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!target) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    if (target.id === me) {
      res.json({ status: "SELF", requestId: null });
      return;
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me, addresseeId: target.id },
          { requesterId: target.id, addresseeId: me },
        ],
      },
    });

    res.json({
      status: !friendship
        ? "NONE"
        : friendship.status === "ACCEPTED"
          ? "FRIENDS"
          : friendship.requesterId === me
            ? "OUTGOING"
            : "INCOMING",
      requestId: friendship?.id ?? null,
    });
  }),
);

/** Envoyer une demande d'ami. */
router.post(
  "/requests",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { username } = z.object({ username: z.string().min(1) }).parse(req.body);

    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    if (target.id === me) {
      throw new AppError(400, "SELF", "Impossible de s'ajouter soi-même");
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me, addresseeId: target.id },
          { requesterId: target.id, addresseeId: me },
        ],
      },
    });
    if (existing) {
      throw new AppError(
        409,
        existing.status === "ACCEPTED" ? "ALREADY_FRIENDS" : "REQUEST_EXISTS",
        existing.status === "ACCEPTED"
          ? "Vous êtes déjà amis"
          : "Une demande est déjà en cours",
      );
    }

    const friendship = await prisma.friendship.create({
      data: { requesterId: me, addresseeId: target.id, status: "PENDING" },
    });

    const requester = await prisma.user.findUnique({
      where: { id: me },
      select: { username: true },
    });

    await notifyUser({
      userId: target.id,
      type: "friend",
      title: "Demande d'ami",
      body: `${requester?.username ?? "Un joueur"} souhaite vous ajouter en ami.`,
      link: "/friends",
    });

    res.json({ id: friendship.id, status: friendship.status });
  }),
);

/** Accepter une demande reçue. */
router.post(
  "/requests/:id/accept",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const friendship = await prisma.friendship.findUnique({
      where: { id: req.params.id },
    });
    if (!friendship || friendship.addresseeId !== me) {
      throw new AppError(404, "NOT_FOUND", "Demande introuvable");
    }
    if (friendship.status !== "PENDING") {
      throw new AppError(409, "NOT_PENDING", "Demande déjà traitée");
    }

    const updated = await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: "ACCEPTED" },
    });

    const accepter = await prisma.user.findUnique({
      where: { id: me },
      select: { username: true },
    });

    await notifyUser({
      userId: friendship.requesterId,
      type: "friend",
      title: "Demande acceptée",
      body: `${accepter?.username ?? "Un joueur"} a accepté votre demande d'ami.`,
      link: "/friends",
    });

    res.json({ id: updated.id, status: updated.status });
  }),
);

/** Refuser / supprimer une demande reçue. */
router.post(
  "/requests/:id/decline",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const friendship = await prisma.friendship.findUnique({
      where: { id: req.params.id },
    });
    if (!friendship || friendship.addresseeId !== me) {
      throw new AppError(404, "NOT_FOUND", "Demande introuvable");
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.json({ success: true });
  }),
);

/** Retirer un ami. */
router.delete(
  "/:friendId",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: me, addresseeId: req.params.friendId },
          { requesterId: req.params.friendId, addresseeId: me },
        ],
      },
    });
    if (!friendship) {
      throw new AppError(404, "NOT_FOUND", "Amitié introuvable");
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.json({ success: true });
  }),
);

export default router;
