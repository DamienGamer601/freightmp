/**
 * Helpers d'authentification côté client.
 *
 * L'authentification repose sur des cookies HttpOnly posés par l'API :
 * le navigateur les envoie automatiquement (via `credentials: "include"`),
 * le JavaScript ne manipule donc plus aucun jeton.
 */

import { getApiUrl } from "./api";

export type UserRole = "ADMIN" | "DEV" | "MODERATOR" | "DRIVER";

export interface MeStats {
  kilometersDriven: number;
  deliveriesCompleted: number;
  totalPlayTimeSeconds: number;
}

export interface DeliveryItem {
  id: string;
  cargoName: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  income: number;
  startedAt: string;
  completedAt: string | null;
  server: { name: string; game: string } | null;
}

export interface Ban {
  id: string;
  type: string;
  reason: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  issuer: { username: string } | null;
}

export interface Affiliation {
  vtcId: string;
  name: string;
  tag: string;
  role: string;
  joinedAt: string;
}

export interface OwnedVtc {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
}

export interface MeResponse {
  id: string;
  username: string;
  role: UserRole;
  steamId: string | null;
  discordId: string | null;
  avatarUrl: string | null;
  country: string | null;
  bio: string | null;
  bannerUrl: string | null;
  title: string | null;
  accentColor: string | null;
  createdAt: string;
  updatedAt: string;
  stats: MeStats;
  deliveries: DeliveryItem[];
  bans: Ban[];
  affiliations: Affiliation[];
  ownedVtcs: OwnedVtc[];
}

class UnauthorizedError extends Error {}

async function fetchMeOnce(): Promise<MeResponse> {
  const res = await fetch(`${getApiUrl()}/api/v1/me`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new UnauthorizedError("Session expirée");
  }

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as MeResponse;
}

/**
 * Rafraîchit la session via `/api/v1/auth/refresh` (cookie HttpOnly).
 * Retourne `true` si le rafraîchissement a réussi.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Récupère le profil connecté. Sur un 401, tente un unique
 * rafraîchissement puis réessaie. Retourne `null` si déconnecté.
 */
export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await fetchMeOnce();
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      // Erreur réseau / serveur : on ne conclut pas à une déconnexion.
      return null;
    }
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return null;
  }

  try {
    return await fetchMeOnce();
  } catch {
    return null;
  }
}

/** Met à jour le pseudo (PATCH /api/v1/me). Lève une erreur en cas d'échec. */
export async function updateUsername(
  username: string,
): Promise<{ id: string; username: string }> {
  const res = await fetch(`${getApiUrl()}/api/v1/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      data?.error?.message ?? `Impossible de mettre à jour le pseudo (${res.status})`,
    );
  }

  return (await res.json()) as { id: string; username: string };
}

/** Déconnecte l'utilisateur (le serveur révoque et efface les cookies). */
export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiUrl()}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Erreur réseau ignorée volontairement.
  }
}

/* ---------- Liaison de comptes (Steam ↔ Discord) ---------- */

/** Récupère l'URL OAuth pour lier un compte. */
export async function getLinkUrl(
  provider: "steam" | "discord",
): Promise<string | null> {
  const res = await fetch(`${getApiUrl()}/api/v1/me/link/${provider}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

/** Délie un compte. Retourne un message d'erreur ou `null` si succès. */
export async function unlinkAccount(
  provider: "steam" | "discord",
): Promise<string | null> {
  const res = await fetch(`${getApiUrl()}/api/v1/me/unlink/${provider}`, {
    method: "POST",
    credentials: "include",
  });
  if (res.ok) {
    return null;
  }
  const data = (await res.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return data?.error?.message ?? `Impossible de délier (${res.status})`;
}
