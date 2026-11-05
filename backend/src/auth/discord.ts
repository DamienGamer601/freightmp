import { env } from "../config/env";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_API_URL = "https://discord.com/api";

export function buildDiscordLoginUrl(
  returnUrl: string,
  scope = "identify guilds.members.read",
  state?: string,
): string {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: returnUrl,
    response_type: "code",
    scope,
  });
  if (state) {
    params.set("state", state);
  }

  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string, returnUrl: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: returnUrl,
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Discord token exchange response missing access_token");
  }

  return data.access_token;
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Discord user fetch failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    id: string;
    username: string;
    avatar: string | null;
  };

  return { id: data.id, username: data.username, avatar: data.avatar };
}
