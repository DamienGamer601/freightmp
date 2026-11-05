import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/authorize";
import { AppError, asyncHandler } from "../middleware/error";
import { recordAudit } from "../lib/audit";
import { notifyUser } from "../lib/notifications";

const router = Router();

router.use(requireAuth);
router.use(requireRole("ADMIN", "MODERATOR"));

/* ---------- Schémas ---------- */

const listUsersQuerySchema = z.object({
  role: z.enum(["ADMIN", "DEV", "MODERATOR", "DRIVER"]).optional(),
  search: z.string().optional(),
});

const createBanSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["WARNING", "TEMPORARY", "PERMANENT"]),
  reason: z.string().min(3),
  expiresAt: z.string().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "DEV", "MODERATOR", "DRIVER"]),
});

const createServerSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits or dashes"),
  game: z.enum(["ETS2", "ATS"]),
  maxPlayers: z.number().int().min(1).max(1000).default(100),
  host: z.string().min(1).max(120),
  port: z.number().int().min(1).max(65535),
  region: z.string().max(60).optional(),
  version: z.string().max(30).optional(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE"]).optional(),
  maxPlayers: z.number().int().min(1).max(1000).optional(),
  region: z.string().max(60).nullable().optional(),
  version: z.string().max(30).nullable().optional(),
  host: z.string().min(1).max(120).optional(),
  port: z.number().int().min(1).max(65535).optional(),
});

const announcementSchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(5000),
  published: z.boolean().optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  body: z.string().min(10).max(5000).optional(),
  published: z.boolean().optional(),
});

/* ---------- Tableau de bord ---------- */

router.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const [
      users,
      servers,
      onlineServers,
      deliveries,
      activeBans,
      vtcs,
      kmSum,
      recentBans,
      recentDeliveries,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.server.count(),
      prisma.server.count({ where: { status: "ONLINE" } }),
      prisma.delivery.count(),
      prisma.ban.count({ where: { active: true } }),
      prisma.vTC.count(),
      prisma.delivery.aggregate({ _sum: { distanceKm: true } }),
      prisma.ban.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { username: true } } },
      }),
      prisma.delivery.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { username: true } } },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, username: true, role: true, createdAt: true },
      }),
    ]);

    res.json({
      users,
      servers,
      onlineServers,
      deliveries,
      activeBans,
      vtcs,
      totalKm: Math.round(kmSum._sum.distanceKm ?? 0),
      recentBans: recentBans.map((ban) => ({
        id: ban.id,
        targetUsername: ban.user.username,
        type: ban.type,
        reason: ban.reason,
        createdAt: ban.createdAt,
      })),
      recentDeliveries: recentDeliveries.map((delivery) => ({
        id: delivery.id,
        username: delivery.user.username,
        cargoName: delivery.cargoName,
        fromCity: delivery.fromCity,
        toCity: delivery.toCity,
        distanceKm: delivery.distanceKm,
        createdAt: delivery.createdAt,
      })),
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      })),
    });
  }),
);

/* ---------- Utilisateurs ---------- */

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse(req.query);

    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = query.role;
    }
    if (query.search) {
      where.username = { contains: query.search, mode: "insensitive" };
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        role: true,
        steamId: true,
        discordId: true,
        createdAt: true,
        kilometersDriven: true,
        deliveriesCompleted: true,
        totalPlayTimeSeconds: true,
        _count: { select: { bansReceived: true, deliveries: true } },
      },
    });

    res.json(
      users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        steamId: user.steamId,
        discordId: user.discordId,
        createdAt: user.createdAt,
        stats: {
          kilometersDriven: user.kilometersDriven,
          deliveriesCompleted: user.deliveriesCompleted,
          totalPlayTimeSeconds: user.totalPlayTimeSeconds,
        },
        banCount: user._count.bansReceived,
        deliveryCount: user._count.deliveries,
      })),
    );
  }),
);

router.patch(
  "/users/:id/role",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { role } = updateRoleSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "user.role",
      targetType: "user",
      targetId: updated.id,
      details: { from: user.role, to: role },
    });

    await notifyUser({
      userId: updated.id,
      type: "role",
      title: "Rôle modifié",
      body: `Votre rôle est désormais ${role}.`,
      link: "/profile",
    });

    res.json({ id: updated.id, username: updated.username, role: updated.role });
  }),
);

router.delete(
  "/users/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (id === req.user!.id) {
      throw new AppError(400, "SELF_DELETE", "You cannot delete your own account");
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new AppError(409, "LAST_ADMIN", "Cannot delete the last administrator");
      }
    }

    try {
      await prisma.user.delete({ where: { id } });
    } catch {
      throw new AppError(
        409,
        "USER_DELETE_FAILED",
        "Cannot delete this user (they may have issued sanctions).",
      );
    }

    await recordAudit({
      actorId: req.user!.id,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      details: { username: target.username },
    });

    res.json({ success: true });
  }),
);

/* ---------- Sanctions ---------- */

router.get(
  "/bans",
  asyncHandler(async (_req, res) => {
    const bans = await prisma.ban.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { username: true } },
        issuer: { select: { username: true } },
      },
    });

    res.json(
      bans.map((ban) => ({
        id: ban.id,
        userId: ban.userId,
        targetUsername: ban.user.username,
        issuerId: ban.issuerId,
        issuerUsername: ban.issuer.username,
        type: ban.type,
        reason: ban.reason,
        active: ban.active,
        expiresAt: ban.expiresAt,
        createdAt: ban.createdAt,
      })),
    );
  }),
);

router.post(
  "/bans",
  asyncHandler(async (req, res) => {
    const body = createBanSchema.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!target) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const ban = await prisma.ban.create({
      data: {
        userId: body.userId,
        issuerId: req.user!.id,
        type: body.type,
        reason: body.reason,
        active: true,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: {
        user: { select: { username: true } },
        issuer: { select: { username: true } },
      },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "ban.create",
      targetType: "user",
      targetId: body.userId,
      details: { type: body.type, reason: body.reason },
    });

    await notifyUser({
      userId: body.userId,
      type: "ban",
      title: "Sanction reçue",
      body: `${body.type} : ${body.reason}`,
      link: "/profile",
    });

    res.json({
      id: ban.id,
      userId: ban.userId,
      targetUsername: ban.user.username,
      issuerId: ban.issuerId,
      issuerUsername: ban.issuer.username,
      type: ban.type,
      reason: ban.reason,
      active: ban.active,
      expiresAt: ban.expiresAt,
      createdAt: ban.createdAt,
    });
  }),
);

router.post(
  "/bans/:id/revoke",
  asyncHandler(async (req, res) => {
    const ban = await prisma.ban.findUnique({ where: { id: req.params.id } });
    if (!ban) {
      throw new AppError(404, "NOT_FOUND", "Ban not found");
    }

    const updated = await prisma.ban.update({
      where: { id: ban.id },
      data: { active: false },
      include: {
        user: { select: { username: true } },
        issuer: { select: { username: true } },
      },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "ban.revoke",
      targetType: "user",
      targetId: updated.userId,
      details: { banId: updated.id },
    });

    res.json({
      id: updated.id,
      userId: updated.userId,
      targetUsername: updated.user.username,
      issuerId: updated.issuerId,
      issuerUsername: updated.issuer.username,
      type: updated.type,
      reason: updated.reason,
      active: updated.active,
      expiresAt: updated.expiresAt,
      createdAt: updated.createdAt,
    });
  }),
);

/* ---------- Serveurs ---------- */

router.get(
  "/servers",
  asyncHandler(async (_req, res) => {
    const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
    res.json(servers);
  }),
);

router.post(
  "/servers",
  asyncHandler(async (req, res) => {
    const body = createServerSchema.parse(req.body);

    const existing = await prisma.server.findUnique({
      where: { slug: body.slug },
    });
    if (existing) {
      throw new AppError(409, "SLUG_TAKEN", "Server slug already in use");
    }

    const server = await prisma.server.create({
      data: {
        name: body.name,
        slug: body.slug,
        game: body.game,
        maxPlayers: body.maxPlayers,
        host: body.host,
        port: body.port,
        region: body.region ?? null,
        version: body.version ?? null,
        status: "OFFLINE",
      },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "server.create",
      targetType: "server",
      targetId: server.id,
      details: { slug: body.slug },
    });

    res.json(server);
  }),
);

router.patch(
  "/servers/:id",
  asyncHandler(async (req, res) => {
    const body = updateServerSchema.parse(req.body);

    const server = await prisma.server.findUnique({
      where: { id: req.params.id },
    });
    if (!server) {
      throw new AppError(404, "NOT_FOUND", "Server not found");
    }

    const updated = await prisma.server.update({
      where: { id: server.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.maxPlayers !== undefined ? { maxPlayers: body.maxPlayers } : {}),
        ...(body.region !== undefined ? { region: body.region } : {}),
        ...(body.version !== undefined ? { version: body.version } : {}),
        ...(body.host !== undefined ? { host: body.host } : {}),
        ...(body.port !== undefined ? { port: body.port } : {}),
      },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "server.update",
      targetType: "server",
      targetId: updated.id,
      details: body,
    });

    res.json(updated);
  }),
);

router.delete(
  "/servers/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const server = await prisma.server.findUnique({
      where: { id: req.params.id },
    });
    if (!server) {
      throw new AppError(404, "NOT_FOUND", "Server not found");
    }

    await prisma.server.delete({ where: { id: server.id } });

    await recordAudit({
      actorId: req.user!.id,
      action: "server.delete",
      targetType: "server",
      targetId: server.id,
      details: { slug: server.slug },
    });

    res.json({ success: true });
  }),
);

/* ---------- VTC ---------- */

router.get(
  "/vtcs/:id",
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, role: true },
            },
          },
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
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
    });
  }),
);

const addVtcMemberSchema = z.object({
  username: z.string().min(1),
  role: z.enum(["OWNER", "MANAGER", "MEMBER"]).default("MEMBER"),
});

router.post(
  "/vtcs/:id/members",
  asyncHandler(async (req, res) => {
    const body = addVtcMemberSchema.parse(req.body);

    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }

    const user = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    const existing = await prisma.vTC_Affiliation.findUnique({
      where: { userId_vtcId: { userId: user.id, vtcId: vtc.id } },
    });
    if (existing) {
      throw new AppError(409, "ALREADY_MEMBER", "User is already a member of this VTC");
    }

    const affiliation = await prisma.vTC_Affiliation.create({
      data: { userId: user.id, vtcId: vtc.id, role: body.role },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "vtc.member.add",
      targetType: "vtc",
      targetId: vtc.id,
      details: { username: user.username, role: body.role },
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
      avatarUrl: user.avatarUrl,
      role: affiliation.role,
      joinedAt: affiliation.joinedAt,
    });
  }),
);

const updateVtcMemberSchema = z.object({
  role: z.enum(["OWNER", "MANAGER", "MEMBER"]),
});

router.patch(
  "/vtcs/:id/members/:userId",
  asyncHandler(async (req, res) => {
    const body = updateVtcMemberSchema.parse(req.body);

    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }

    const existing = await prisma.vTC_Affiliation.findUnique({
      where: { userId_vtcId: { userId: req.params.userId, vtcId: vtc.id } },
    });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Member not found");
    }

    const updated = await prisma.vTC_Affiliation.update({
      where: { userId_vtcId: { userId: req.params.userId, vtcId: vtc.id } },
      data: { role: body.role },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "vtc.member.role",
      targetType: "vtc",
      targetId: vtc.id,
      details: { userId: req.params.userId, role: body.role },
    });

    res.json({ userId: updated.userId, role: updated.role });
  }),
);

router.delete(
  "/vtcs/:id/members/:userId",
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
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

    await recordAudit({
      actorId: req.user!.id,
      action: "vtc.member.remove",
      targetType: "vtc",
      targetId: vtc.id,
      details: { userId: req.params.userId },
    });

    await notifyUser({
      userId: req.params.userId,
      type: "vtc",
      title: "Retiré d'une VTC",
      body: `Vous avez été retiré de ${vtc.name}.`,
      link: "/vtcs",
    });

    res.json({ success: true });
  }),
);

router.delete(
  "/vtcs/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const vtc = await prisma.vTC.findUnique({ where: { id: req.params.id } });
    if (!vtc) {
      throw new AppError(404, "NOT_FOUND", "VTC not found");
    }

    await prisma.vTC.delete({ where: { id: vtc.id } });

    await recordAudit({
      actorId: req.user!.id,
      action: "vtc.delete",
      targetType: "vtc",
      targetId: vtc.id,
      details: { name: vtc.name, tag: vtc.tag },
    });

    res.json({ success: true });
  }),
);

/* ---------- Annonces ---------- */

router.get(
  "/announcements",
  asyncHandler(async (_req, res) => {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: { select: { username: true } } },
    });

    res.json(
      announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        published: announcement.published,
        authorUsername: announcement.author.username,
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt,
      })),
    );
  }),
);

router.post(
  "/announcements",
  asyncHandler(async (req, res) => {
    const body = announcementSchema.parse(req.body);

    const announcement = await prisma.announcement.create({
      data: {
        title: body.title,
        body: body.body,
        published: body.published ?? false,
        authorId: req.user!.id,
      },
      include: { author: { select: { username: true } } },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "announcement.create",
      targetType: "announcement",
      targetId: announcement.id,
      details: { title: announcement.title },
    });

    res.json({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      published: announcement.published,
      authorUsername: announcement.author.username,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    });
  }),
);

router.patch(
  "/announcements/:id",
  asyncHandler(async (req, res) => {
    const body = updateAnnouncementSchema.parse(req.body);

    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
    });
    if (!announcement) {
      throw new AppError(404, "NOT_FOUND", "Announcement not found");
    }

    const updated = await prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
      },
      include: { author: { select: { username: true } } },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "announcement.update",
      targetType: "announcement",
      targetId: updated.id,
      details: body,
    });

    res.json({
      id: updated.id,
      title: updated.title,
      body: updated.body,
      published: updated.published,
      authorUsername: updated.author.username,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }),
);

router.delete(
  "/announcements/:id",
  asyncHandler(async (req, res) => {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
    });
    if (!announcement) {
      throw new AppError(404, "NOT_FOUND", "Announcement not found");
    }

    await prisma.announcement.delete({ where: { id: announcement.id } });

    await recordAudit({
      actorId: req.user!.id,
      action: "announcement.delete",
      targetType: "announcement",
      targetId: announcement.id,
      details: { title: announcement.title },
    });

    res.json({ success: true });
  }),
);

/* ---------- Journal d'audit ---------- */

router.get(
  "/audit-log",
  asyncHandler(async (req, res) => {
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "100"), 10) || 100),
    );

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { username: true } } },
    });

    res.json(
      logs.map((log) => ({
        id: log.id,
        actorUsername: log.actor?.username ?? "système",
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        details: log.details,
        createdAt: log.createdAt,
      })),
    );
  }),
);

/* ---------- Événements ---------- */

const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(5000),
  type: z.enum(["CONVOY", "DELIVERY", "SPECIAL"]).default("CONVOY"),
  status: z.enum(["UPCOMING", "ONGOING", "FINISHED", "CANCELLED"]).default("UPCOMING"),
  startAt: z.string(),
  endAt: z.string().optional(),
  location: z.string().max(200).optional(),
  game: z.enum(["ETS2", "ATS"]).optional(),
  serverId: z.string().optional(),
  published: z.boolean().optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(3).max(5000).optional(),
  type: z.enum(["CONVOY", "DELIVERY", "SPECIAL"]).optional(),
  status: z.enum(["UPCOMING", "ONGOING", "FINISHED", "CANCELLED"]).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  location: z.string().max(200).optional(),
  game: z.enum(["ETS2", "ATS"]).optional(),
  serverId: z.string().optional(),
  published: z.boolean().optional(),
});

function adminEventDto(event: {
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
}) {
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

const eventInclude = {
  server: { select: { id: true, name: true } },
  organizer: { select: { username: true } },
  _count: { select: { participants: true } },
};

router.get(
  "/events",
  asyncHandler(async (_req, res) => {
    const events = await prisma.event.findMany({
      orderBy: { startAt: "desc" },
      include: eventInclude,
    });
    res.json(events.map(adminEventDto));
  }),
);

router.post(
  "/events",
  asyncHandler(async (req, res) => {
    const body = createEventSchema.parse(req.body);

    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        startAt: new Date(body.startAt),
        endAt: body.endAt ? new Date(body.endAt) : null,
        location: body.location ?? null,
        game: body.game ?? null,
        serverId: body.serverId ?? null,
        organizerId: req.user!.id,
        published: body.published ?? true,
      },
      include: eventInclude,
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "event.create",
      targetType: "event",
      targetId: event.id,
      details: { title: event.title },
    });

    res.json(adminEventDto(event));
  }),
);

router.patch(
  "/events/:id",
  asyncHandler(async (req, res) => {
    const body = updateEventSchema.parse(req.body);

    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Event not found");
    }

    const event = await prisma.event.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.startAt !== undefined ? { startAt: new Date(body.startAt) } : {}),
        ...(body.endAt !== undefined
          ? { endAt: body.endAt ? new Date(body.endAt) : null }
          : {}),
        ...(body.location !== undefined ? { location: body.location } : {}),
        ...(body.game !== undefined ? { game: body.game } : {}),
        ...(body.serverId !== undefined ? { serverId: body.serverId || null } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
      },
      include: eventInclude,
    });

    await recordAudit({
      actorId: req.user!.id,
      action: "event.update",
      targetType: "event",
      targetId: event.id,
      details: { title: event.title },
    });

    res.json(adminEventDto(event));
  }),
);

router.delete(
  "/events/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Event not found");
    }

    await prisma.event.delete({ where: { id: existing.id } });

    await recordAudit({
      actorId: req.user!.id,
      action: "event.delete",
      targetType: "event",
      targetId: existing.id,
      details: { title: existing.title },
    });

    res.json({ success: true });
  }),
);

export default router;
