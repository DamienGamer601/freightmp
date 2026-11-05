import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notifyUser } from "../lib/notifications";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

const createVtcSchema = z.object({
  name: z.string().min(1),
  tag: z
    .string()
    .min(1)
    .max(8)
    .transform((tag) => tag.toUpperCase()),
});

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, tag } = createVtcSchema.parse(req.body);

    const existing = await prisma.vTC.findUnique({ where: { tag } });
    if (existing) {
      throw new AppError(409, "TAG_TAKEN", "VTC tag already in use");
    }

    const vtc = await prisma.vTC.create({
      data: {
        name,
        tag,
        ownerId: req.user!.id,
        members: {
          create: { userId: req.user!.id, role: "OWNER" },
        },
      },
      include: { members: true },
    });

    res.json({
      vtc: {
        id: vtc.id,
        name: vtc.name,
        tag: vtc.tag,
        ownerId: vtc.ownerId,
        createdAt: vtc.createdAt,
      },
      affiliation: vtc.members[0],
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const vtcs = await prisma.vTC.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { username: true } },
        _count: { select: { members: true } },
      },
    });

    res.json(
      vtcs.map((vtc) => ({
        id: vtc.id,
        name: vtc.name,
        tag: vtc.tag,
        ownerId: vtc.ownerId,
        ownerUsername: vtc.owner.username,
        memberCount: vtc._count.members,
        createdAt: vtc.createdAt,
      })),
    );
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { username: true } },
        members: {
          include: { user: { select: { username: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }

    res.json({
      id: vtc.id,
      name: vtc.name,
      tag: vtc.tag,
      ownerId: vtc.ownerId,
      ownerUsername: vtc.owner.username,
      createdAt: vtc.createdAt,
      members: vtc.members.map((member) => ({
        userId: member.userId,
        username: member.user.username,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
    });
  }),
);

router.post(
  "/:id/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }

    const affiliation = await prisma.vTC_Affiliation.upsert({
      where: { userId_vtcId: { userId: req.user!.id, vtcId: vtc.id } },
      update: {},
      create: { userId: req.user!.id, vtcId: vtc.id, role: "MEMBER" },
    });

    res.json(affiliation);
  }),
);

router.delete(
  "/:id/leave",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }

    if (vtc.ownerId === req.user!.id) {
      throw new AppError(409, "OWNER_CANNOT_LEAVE", "VTC owners cannot leave their VTC");
    }

    const result = await prisma.vTC_Affiliation.deleteMany({
      where: { userId: req.user!.id, vtcId: vtc.id },
    });

    if (result.count === 0) {
      throw new AppError(404, "NOT_FOUND", "Not a member of this VTC");
    }

    res.json({ success: true });
  }),
);

/* ---------- Gestion par le propriétaire / manager ---------- */

async function requireVtcManager(vtcId: string, userId: string) {
  const vtc = await prisma.vTC.findUnique({ where: { id: vtcId } });
  if (!vtc) {
    throw new AppError(404, "NOT_FOUND", "VTC not found");
  }
  if (vtc.ownerId === userId) {
    return vtc;
  }
  const affiliation = await prisma.vTC_Affiliation.findUnique({
    where: { userId_vtcId: { userId, vtcId } },
  });
  if (!affiliation || affiliation.role !== "MANAGER") {
    throw new AppError(403, "FORBIDDEN", "Réservé au propriétaire ou à un manager");
  }
  return vtc;
}

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await requireVtcManager(req.params.id, req.user!.id);
    const { name } = z.object({ name: z.string().min(1).max(60) }).parse(req.body);

    const updated = await prisma.vTC.update({
      where: { id: vtc.id },
      data: { name },
    });

    res.json({ id: updated.id, name: updated.name, tag: updated.tag });
  }),
);

router.post(
  "/:id/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await requireVtcManager(req.params.id, req.user!.id);
    const { username } = z.object({ username: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const existing = await prisma.vTC_Affiliation.findUnique({
      where: { userId_vtcId: { userId: user.id, vtcId: vtc.id } },
    });
    if (existing) {
      throw new AppError(409, "ALREADY_MEMBER", "User is already a member");
    }

    const affiliation = await prisma.vTC_Affiliation.create({
      data: { userId: user.id, vtcId: vtc.id, role: "MEMBER" },
    });

    await notifyUser({
      userId: user.id,
      type: "vtc",
      title: "Nouvelle VTC",
      body: `Vous avez été ajouté à ${vtc.name}.`,
      link: `/vtc/${vtc.id}`,
    });

    res.json({
      userId: user.id,
      username: user.username,
      role: affiliation.role,
      joinedAt: affiliation.joinedAt,
    });
  }),
);

router.patch(
  "/:id/members/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await requireVtcManager(req.params.id, req.user!.id);
    const { role } = z
      .object({ role: z.enum(["MANAGER", "MEMBER"]) })
      .parse(req.body);

    if (req.params.userId === vtc.ownerId) {
      throw new AppError(403, "OWNER_ROLE", "Impossible de changer le rôle du propriétaire");
    }

    const existing = await prisma.vTC_Affiliation.findUnique({
      where: { userId_vtcId: { userId: req.params.userId, vtcId: vtc.id } },
    });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Member not found");
    }

    const updated = await prisma.vTC_Affiliation.update({
      where: { userId_vtcId: { userId: req.params.userId, vtcId: vtc.id } },
      data: { role },
    });

    res.json({ userId: updated.userId, role: updated.role });
  }),
);

router.delete(
  "/:id/members/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await requireVtcManager(req.params.id, req.user!.id);

    if (req.params.userId === vtc.ownerId) {
      throw new AppError(403, "OWNER_CANNOT_BE_REMOVED", "Impossible de retirer le propriétaire");
    }

    const existing = await prisma.vTC_Affiliation.findUnique({
      where: { userId_vtcId: { userId: req.params.userId, vtcId: vtc.id } },
    });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Member not found");
    }

    await prisma.vTC_Affiliation.delete({
      where: { userId_vtcId: { userId: req.params.userId, vtcId: vtc.id } },
    });

    res.json({ success: true });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }
    if (vtc.ownerId !== req.user!.id) {
      throw new AppError(403, "FORBIDDEN", "Seul le propriétaire peut supprimer la VTC");
    }

    await prisma.vTC.delete({ where: { id: vtc.id } });
    res.json({ success: true });
  }),
);

export default router;
