const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const OPENID_IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";

export function buildSteamLoginUrl(returnUrl: string, realm?: string): string {
  // `openid.realm` DOIT correspondre au domaine qui reçoit le callback.
  // On le dérive de l'URL de retour (localhost en dev, domaine Railway en prod).
  let resolvedRealm = realm;
  if (!resolvedRealm) {
    try {
      resolvedRealm = new URL(returnUrl).origin;
    } catch {
      resolvedRealm = "http://localhost:4000";
    }
  }

  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnUrl,
    "openid.realm": resolvedRealm,
    "openid.identity": OPENID_IDENTIFIER_SELECT,
    "openid.claimed_id": OPENID_IDENTIFIER_SELECT,
  });

  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

export async function verifySteamCallback(
  query: Record<string, unknown>,
): Promise<{ steamId: string }> {
  const checkParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("openid.") && key !== "openid.mode" && typeof value === "string") {
      checkParams.set(key, value);
    }
  }

  // openid.mode must be check_authentication for the verification request.
  checkParams.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: checkParams.toString(),
  });

  const text = await response.text();
  if (!/is_valid\s*:\s*true/i.test(text)) {
    throw new Error("Steam OpenID check_authentication returned is_valid != true");
  }

  return { steamId: extractSteamIdFromClaimedId(query["openid.claimed_id"]) };
}

/** Récupère l'avatar + le pays d'un joueur via la Web API Steam. */
export async function getSteamProfile(
  steamId: string,
  apiKey: string,
): Promise<{ avatarUrl: string | null; country: string | null }> {
  if (!apiKey) {
    return { avatarUrl: null, country: null };
  }

  try {
    const url =
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/" +
      `?key=${encodeURIComponent(apiKey)}&steamids=${steamId}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { avatarUrl: null, country: null };
    }

    const data = (await response.json()) as {
      response?: {
        players?: Array<{ avatarfull?: string; loccountrycode?: string }>;
      };
    };
    const player = data.response?.players?.[0];

    return {
      avatarUrl: player?.avatarfull ?? null,
      country: player?.loccountrycode ?? null,
    };
  } catch {
    return { avatarUrl: null, country: null };
  }
}

/** Extrait un SteamID64 (17 chiffres) depuis un `openid.claimed_id`. */
export function extractSteamIdFromClaimedId(claimedId: unknown): string {
  if (typeof claimedId !== "string") {
    throw new Error("Steam OpenID callback missing openid.claimed_id");
  }

  const match = claimedId.match(/\/id\/(\d{17})$/);
  if (!match) {
    throw new Error(`Could not extract SteamID64 from claimed_id: ${claimedId}`);
  }

  return match[1];
}
