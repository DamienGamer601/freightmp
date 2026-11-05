import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

type EventWithRelations = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  game: string | null;
  published: boolean;
  createdAt: Date;
  server: { id: string; name: string } | null;
  organizer: { username: string } | null;
  _count: { participants: number };
};

function toEventDto(event: EventWithRelations) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    status: event.status,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
    game: event.game,
    server: event.server,
    organizerUsername: event.organizer?.username ?? null,
    participantCount: event._count.participants,
    published: event.published,
    createdAt: event.createdAt,
  };
}

/** Événements publiés (public). */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const events = await prisma.event.findMany({
      where: { published: true },
      orderBy: { startAt: "asc" },
      include: {
        server: { select: { id: true, name: true } },
        organizer: { select: { username: true } },
        _count: { select: { participants: true } },
      },
    });

    res.json(events.map(toEventDto));
  }),
);

/** IDs des événements rejoints par l'utilisateur connecté. */
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const participations = await prisma.eventParticipant.findMany({
      where: { userId: req.user!.id },
      select: { eventId: true },
    });
    res.json(participations.map((participation) => participation.eventId));
  }),
);

/** Détail d'un événement (public) avec participants. */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, published: true },
      include: {
        server: { select: { id: true, name: true } },
        organizer: { select: { username: true } },
        participants: {
          include: { user: { select: { username: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!event) {
      throw new AppError(404, "NOT_FOUND", "Event not found");
    }

    res.json({
      ...toEventDto({ ...event, _count: { participants: event.participants.length } }),
      participants: event.participants.map((participant) => ({
        username: participant.user.username,
        joinedAt: participant.createdAt,
      })),
    });
  }),
);

/** S'inscrire à un événement. */
router.post(
  "/:id/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, published: true },
    });
    if (!event) {
      throw new AppError(404, "NOT_FOUND", "Event not found");
    }

    const existing = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: req.user!.id } },
    });
    if (existing) {
      throw new AppError(409, "ALREADY_JOINED", "Vous êtes déjà inscrit");
    }

    await prisma.eventParticipant.create({
      data: { eventId: event.id, userId: req.user!.id },
    });

    res.json({ success: true, eventId: event.id });
  }),
);

/** Annuler son inscription. */
router.delete(
  "/:id/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findFirst({ where: { id: req.params.id } });
    if (!event) {
      throw new AppError(404, "NOT_FOUND", "Event not found");
    }

    const existing = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: req.user!.id } },
    });
    if (!existing) {
      throw new AppError(404, "NOT_JOINED", "Vous n'êtes pas inscrit");
    }

    await prisma.eventParticipant.delete({
      where: { eventId_userId: { eventId: event.id, userId: req.user!.id } },
    });

    res.json({ success: true });
  }),
);

export default router;
