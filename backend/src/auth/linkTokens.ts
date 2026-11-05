import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type OAuthProvider = "steam" | "discord";

export interface LinkTokenPayload {
  sub: string;
  provider: OAuthProvider;
  purpose: "link";
}

const LINK_TOKEN_TTL = "10m";

/** Jeton signé court (10 min) pour lier un compte OAuth à l'utilisateur connecté. */
export function signLinkToken(userId: string, provider: OAuthProvider): string {
  return jwt.sign(
    { sub: userId, provider, purpose: "link" },
    env.jwtSecret,
    { expiresIn: LINK_TOKEN_TTL },
  );
}

export function verifyLinkToken(token: string): LinkTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string") {
    throw new Error("Malformed link token");
  }
  if (decoded.purpose !== "link") {
    throw new Error("Not a link token");
  }
  if (decoded.provider !== "steam" && decoded.provider !== "discord") {
    throw new Error("Unknown provider");
  }
  return {
    sub: String(decoded.sub),
    provider: decoded.provider,
    purpose: "link",
  };
}
