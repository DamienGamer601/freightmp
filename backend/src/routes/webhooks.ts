import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";
import { deliverWebhook, generateWebhookSecret } from "../lib/webhooks";

const router = Router();

/** Événements auxquels un intégrateur peut s'abonner. */
export const WEBHOOK_EVENTS = [
  "event.created",
  "event.updated",
  "announcement.created",
  "player.joined",
  "delivery.completed",
] as const;

const createSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(20).optional(),
});

/** GET /api/v1/webhooks — liste mes webhooks. */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const hooks = await prisma.webhook.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      webhooks: hooks.map((hook) => ({
        id: hook.id,
        url: hook.url,
        events: hook.events,
        active: hook.active,
        lastFiredAt: hook.lastFiredAt,
        lastStatus: hook.lastStatus,
        createdAt: hook.createdAt,
      })),
    });
  }),
);

/** POST /api/v1/webhooks — crée un webhook. */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "URL ou événements invalides");
    }

    const hook = await prisma.webhook.create({
      data: {
        userId: req.user!.id,
        url: parsed.data.url,
        secret: generateWebhookSecret(),
        events: parsed.data.events ?? [...WEBHOOK_EVENTS],
      },
    });

    res.status(201).json({
      id: hook.id,
      url: hook.url,
      events: hook.events,
      active: hook.active,
      secret: hook.secret,
      warning:
        "Le secret de signature n'est affiché qu'une fois. Utilisez-le pour vérifier X-FMP-Signature.",
    });
  }),
);

/** DELETE /api/v1/webhooks/:id — supprime un webhook. */
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await prisma.webhook.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Webhook introuvable");
    }
    res.json({ ok: true });
  }),
);

/** POST /api/v1/webhooks/:id/test — envoie un événement de test. */
router.post(
  "/:id/test",
  requireAuth,
  asyncHandler(async (req, res) => {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!hook) {
      throw new AppError(404, "NOT_FOUND", "Webhook introuvable");
    }

    const status = await deliverWebhook({
      url: hook.url,
      secret: hook.secret,
      event: "webhook.test",
      data: { message: "Ceci est un test FreightMP", hookId: hook.id },
    });

    await prisma.webhook.update({
      where: { id: hook.id },
      data: { lastFiredAt: new Date(), lastStatus: status },
    });

    res.json({ ok: status !== null && status < 400, status });
  }),
);

export default router;
