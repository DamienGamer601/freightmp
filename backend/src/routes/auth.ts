import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { parseCookies } from "../lib/cookies";
import { buildSteamLoginUrl, getSteamProfile, verifySteamCallback } from "../auth/steam";
import { buildDiscordLoginUrl, exchangeDiscordCode, getDiscordUser } from "../auth/discord";
import { hashToken, issueTokenPair, verifyRefreshToken } from "../auth/tokens";
import { verifyLinkToken } from "../auth/linkTokens";
import { AppError, asyncHandler } from "../middleware/error";

const router = Router();

const ACCESS_COOKIE = "fmp_access";
const REFRESH_COOKIE = "fmp_refresh";

// Le refresh token reste accepté dans le corps (rétro-compatibilité),
// mais le flux privilégié est désormais le cookie HttpOnly.
const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    // `Secure` uniquement derrière HTTPS (déduit de l'URL publique de l'API).
    secure: env.apiUrl.startsWith("https://"),
  };
}

function tokenMaxAgeMs(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const seconds = Math.max((decoded?.exp ?? nowSeconds + 3600) - nowSeconds, 1);
  return seconds * 1000;
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBaseOptions(),
    maxAge: tokenMaxAgeMs(accessToken),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBaseOptions(),
    maxAge: tokenMaxAgeMs(refreshToken),
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, cookieBaseOptions());
  res.clearCookie(REFRESH_COOKIE, cookieBaseOptions());
}

function getRefreshToken(req: Request): string | undefined {
  const cookieToken = parseCookies(req.headers.cookie)[REFRESH_COOKIE];
  if (cookieToken) {
    return cookieToken;
  }

  const parsed = refreshSchema.safeParse(req.body);
  return parsed.success ? parsed.data.refreshToken : undefined;
}

function redirectToCallback(res: Response, error?: string): void {
  const url = error
    ? `${env.frontendUrl}/auth/callback?error=${encodeURIComponent(error)}`
    : `${env.frontendUrl}/auth/callback`;
  res.redirect(url);
}

function redirectLinked(res: Response, provider: "steam" | "discord"): void {
  res.redirect(`${env.frontendUrl}/auth/callback?linked=${provider}`);
}

/** Lie un compte Steam à l'utilisateur désigné par le jeton de liaison. */
async function linkSteamToUser(linkToken: string, steamId: string): Promise<void> {
  const payload = verifyLinkToken(linkToken);
  if (payload.provider !== "steam") {
    throw new AppError(400, "BAD_REQUEST", "Jeton de liaison invalide");
  }

  const existing = await prisma.user.findUnique({ where: { steamId } });
  if (existing && existing.id !== payload.sub) {
    throw new AppError(
      409,
      "ALREADY_LINKED",
      "Ce compte Steam est déjà lié à un autre compte FreightMP",
    );
  }

  const profile = await getSteamProfile(steamId, env.steamApiKey);
  await prisma.user.update({
    where: { id: payload.sub },
    data: {
      steamId,
      ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      ...(profile.country ? { country: profile.country } : {}),
    },
  });
}

/** Lie un compte Discord à l'utilisateur désigné par le jeton de liaison. */
async function linkDiscordToUser(
  linkToken: string,
  discordId: string,
  avatarUrl: string | null,
): Promise<void> {
  const payload = verifyLinkToken(linkToken);
  if (payload.provider !== "discord") {
    throw new AppError(400, "BAD_REQUEST", "Jeton de liaison invalide");
  }

  const existing = await prisma.user.findUnique({ where: { discordId } });
  if (existing && existing.id !== payload.sub) {
    throw new AppError(
      409,
      "ALREADY_LINKED",
      "Ce compte Discord est déjà lié à un autre compte FreightMP",
    );
  }

  await prisma.user.update({
    where: { id: payload.sub },
    data: { discordId, ...(avatarUrl ? { avatarUrl } : {}) },
  });
}

// ---- Steam (OpenID 2.0) ----
router.get("/steam", (_req, res) => {
  res.redirect(buildSteamLoginUrl(env.steamReturnUrl));
});

router.get(
  "/steam/callback",
  asyncHandler(async (req, res) => {
    try {
      const { steamId } = await verifySteamCallback(req.query as Record<string, unknown>);

      // Mode « liaison » : un jeton `link` accompagne la redirection de retour.
      const linkToken = typeof req.query.link === "string" ? req.query.link : null;
      if (linkToken) {
        await linkSteamToUser(linkToken, steamId);
        redirectLinked(res, "steam");
        return;
      }

      const profile = await getSteamProfile(steamId, env.steamApiKey);

      const user = await prisma.user.upsert({
        where: { steamId },
        update: {
          ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
          ...(profile.country ? { country: profile.country } : {}),
        },
        create: {
          steamId,
          username: `Steam_${steamId}`,
          role: "DRIVER",
          avatarUrl: profile.avatarUrl,
          country: profile.country,
        },
      });

      const tokens = await issueTokenPair(user.id, user.role);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      redirectToCallback(res);
    } catch (error) {
      redirectToCallback(
        res,
        error instanceof AppError ? error.message : "Steam authentication failed",
      );
    }
  }),
);

// ---- Discord (OAuth2) ----
router.get("/discord", (_req, res) => {
  res.redirect(buildDiscordLoginUrl(env.discordReturnUrl));
});

router.get(
  "/discord/callback",
  asyncHandler(async (req, res) => {
    try {
      const code = req.query.code;
      if (typeof code !== "string" || !code) {
        throw new AppError(400, "BAD_REQUEST", "Missing Discord authorization code");
      }

      const accessToken = await exchangeDiscordCode(code, env.discordReturnUrl);
      const discordUser = await getDiscordUser(accessToken);

      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

      // Mode « liaison » : le `state` contient le jeton de liaison.
      const linkToken = typeof req.query.state === "string" ? req.query.state : null;
      if (linkToken) {
        await linkDiscordToUser(linkToken, discordUser.id, avatarUrl);
        redirectLinked(res, "discord");
        return;
      }

      const user = await prisma.user.upsert({
        where: { discordId: discordUser.id },
        update: {},
        create: {
          discordId: discordUser.id,
          username: discordUser.username,
          avatarUrl,
          role: "DRIVER",
        },
      });

      const tokens = await issueTokenPair(user.id, user.role);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      redirectToCallback(res);
    } catch (error) {
      redirectToCallback(
        res,
        error instanceof AppError ? error.message : "Discord authentication failed",
      );
    }
  }),
);

// ---- Rotation des tokens ----
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Missing refresh token");
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revoked || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found");
    }

    const tokens = await issueTokenPair(user.id, user.role);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ success: true });
  }),
);

// ---- Déconnexion ----
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const refreshToken = getRefreshToken(req);
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (stored && !stored.revoked) {
        await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
      }
    }

    clearAuthCookies(res);
    res.json({ success: true });
  }),
);

export default router;
