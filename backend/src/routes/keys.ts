import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";
import { generateApiKey } from "../lib/apiKeys";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(60),
  scopes: z.array(z.string().min(1).max(40)).max(20).optional(),
});

/** GET /api/v1/keys — liste mes clés (masquées). */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
      })),
    });
  }),
);

/** POST /api/v1/keys — crée une clé (la valeur en clair n'est renvoyée qu'une fois). */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Données invalides");
    }

    const generated = generateApiKey();
    const record = await prisma.apiKey.create({
      data: {
        userId: req.user!.id,
        name: parsed.data.name,
        prefix: generated.prefix,
        keyHash: generated.hash,
        scopes: parsed.data.scopes ?? [],
      },
    });

    res.status(201).json({
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes,
      key: generated.key,
      warning: "Conservez cette clé : elle ne sera plus jamais affichée.",
    });
  }),
);

/** DELETE /api/v1/keys/:id — révoque une clé. */
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await prisma.apiKey.updateMany({
      where: { id: req.params.id, userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Clé introuvable");
    }
    res.json({ ok: true });
  }),
);

export default router;
