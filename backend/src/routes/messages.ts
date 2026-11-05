import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";
import { notifyUser } from "../lib/notifications";

const router = Router();

router.use(requireAuth);

/** Liste des conversations (dernier message + non-lus). */
router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;

    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: me }, { receiverId: me }] },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
        receiver: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    const map = new Map<
      string,
      {
        user: { id: string; username: string; avatarUrl: string | null };
        lastMessage: (typeof messages)[number];
        unread: number;
      }
    >();

    for (const message of messages) {
      const other = message.senderId === me ? message.receiver : message.sender;
      let conversation = map.get(other.id);
      if (!conversation) {
        conversation = {
          user: { id: other.id, username: other.username, avatarUrl: other.avatarUrl },
          lastMessage: message,
          unread: 0,
        };
        map.set(other.id, conversation);
      }
      if (message.receiverId === me && !message.read) {
        conversation.unread += 1;
      }
    }

    res.json(
      Array.from(map.values()).map((conversation) => ({
        user: conversation.user,
        lastMessage: {
          body: conversation.lastMessage.body,
          createdAt: conversation.lastMessage.createdAt,
          fromMe: conversation.lastMessage.senderId === me,
        },
        unread: conversation.unread,
      })),
    );
  }),
);

/** Conversation avec un utilisateur (marque les messages reçus comme lus). */
router.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;

    const other = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, username: true, avatarUrl: true },
    });
    if (!other) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    if (other.id === me) {
      throw new AppError(400, "SELF", "Impossible de discuter avec soi-même");
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: me, receiverId: other.id },
          { senderId: other.id, receiverId: me },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    await prisma.message.updateMany({
      where: { senderId: other.id, receiverId: me, read: false },
      data: { read: true },
    });

    res.json({
      user: { id: other.id, username: other.username, avatarUrl: other.avatarUrl },
      messages: messages.map((message) => ({
        id: message.id,
        fromMe: message.senderId === me,
        body: message.body,
        createdAt: message.createdAt,
      })),
    });
  }),
);

const sendMessageSchema = z.object({ body: z.string().min(1).max(2000) });

/** Envoie un message à un utilisateur. */
router.post(
  "/:username",
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { body } = sendMessageSchema.parse(req.body);

    const other = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!other) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    if (other.id === me) {
      throw new AppError(400, "SELF", "Impossible de s'envoyer un message");
    }

    const message = await prisma.message.create({
      data: { senderId: me, receiverId: other.id, body },
    });

    const sender = await prisma.user.findUnique({
      where: { id: me },
      select: { username: true },
    });

    await notifyUser({
      userId: other.id,
      type: "message",
      title: "Nouveau message",
      body: `${sender?.username ?? "Un joueur"} : ${body.slice(0, 80)}`,
      link: `/messages/${encodeURIComponent(sender?.username ?? "")}`,
    });

    res.json({ id: message.id, body: message.body, createdAt: message.createdAt });
  }),
);

export default router;
