/**
 * Helpers du profil : édition des champs de présentation, historique paginé
 * des livraisons et profil public partageable.
 */

import { getApiUrl } from "./api";
import type { DeliveryItem, MeResponse } from "./auth";

export interface ProfileFields {
  bio: string | null;
  bannerUrl: string | null;
  title: string | null;
  accentColor: string | null;
  country: string | null;
}

/** Met à jour les champs de présentation du profil. */
export async function updateProfile(
  fields: Partial<ProfileFields>,
): Promise<ProfileFields> {
  const res = await fetch(`${getApiUrl()}/api/v1/me/profile`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      data?.error?.message ?? `Impossible de mettre à jour le profil (${res.status})`,
    );
  }

  return (await res.json()) as ProfileFields;
}

export interface PaginatedDeliveries {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  deliveries: DeliveryItem[];
}

export interface DeliveryQuery {
  page?: number;
  limit?: number;
  game?: "ETS2" | "ATS" | "";
  search?: string;
}

/** Récupère l'historique paginé des livraisons du joueur connecté. */
export async function fetchDeliveries(
  query: DeliveryQuery = {},
): Promise<PaginatedDeliveries> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.game) params.set("game", query.game);
  if (query.search) params.set("search", query.search);

  const res = await fetch(
    `${getApiUrl()}/api/v1/me/deliveries?${params.toString()}`,
    { credentials: "include", cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as PaginatedDeliveries;
}

/** Convertit un code pays ISO (ex. "FR") en drapeau emoji (🇫🇷). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) {
    return "";
  }
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export interface PublicProfile {  id: string;
  username: string;
  role: MeResponse["role"];
  avatarUrl: string | null;
  country: string | null;
  bio: string | null;
  bannerUrl: string | null;
  title: string | null;
  accentColor: string | null;
  createdAt: string;
  stats: MeResponse["stats"];
  linkedAccounts: { steam: boolean; discord: boolean };
  deliveries: DeliveryItem[];
  affiliations: MeResponse["affiliations"];
  ownedVtcs: MeResponse["ownedVtcs"];
  activeBans: { id: string; type: string; reason: string; expiresAt: string | null }[];
}

/** Récupère un profil public par pseudo. `null` si introuvable. */
export async function fetchPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/profiles/${encodeURIComponent(username)}`,
    { cache: "no-store" },
  );

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as PublicProfile;
}
