import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

const MP_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 h

/**
 * Délivre un jeton signé pour le serveur multijoueur (mp-server).
 * Le serveur MP vérifie ce JWT avec le même `JWT_SECRET`.
 */
router.post(
  "/token",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        username: true,
        role: true,
        country: true,
        avatarUrl: true,
        vtcOwned: { select: { tag: true }, take: 1 },
        affiliations: {
          include: { vtc: { select: { tag: true } } },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const tag = user.vtcOwned[0]?.tag ?? user.affiliations[0]?.vtc.tag ?? null;

    const token = jwt.sign(
      {
        sub: req.user!.id,
        username: user.username,
        role: user.role,
        country: user.country,
        tag,
        kind: "mp",
      },
      env.jwtSecret,
      { expiresIn: MP_TOKEN_TTL_SECONDS },
    );

    res.json({
      token,
      expiresIn: MP_TOKEN_TTL_SECONDS,
      username: user.username,
      tag,
      country: user.country,
      avatarUrl: user.avatarUrl,
    });
  }),
);

export default router;
