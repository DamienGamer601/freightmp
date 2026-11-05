import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiresInOption(value: string): SignOptions["expiresIn"] {
  // The raw env string ("15m", "30d", ...) is a valid `expiresIn` value for
  // jsonwebtoken; assert the type since it originates from process.env.
  return value as unknown as SignOptions["expiresIn"];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: expiresInOption(env.jwtAccessExpires) });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: expiresInOption(env.jwtRefreshExpires) });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string") {
    throw new Error("Malformed access token");
  }
  return { sub: String(decoded.sub), role: String(decoded.role) };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string") {
    throw new Error("Malformed refresh token");
  }
  if (decoded.type !== "refresh") {
    throw new Error("Token is not a refresh token");
  }
  return { sub: String(decoded.sub), jti: String(decoded.jti), type: "refresh" };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function issueTokenPair(userId: string, role: string): Promise<TokenPair> {
  const jti = randomUUID();
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, jti, type: "refresh" });

  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  const fallbackExp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const expiresAt = new Date((decoded?.exp ?? fallbackExp) * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}
