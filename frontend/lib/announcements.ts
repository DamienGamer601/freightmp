/**
 * Annonces publiques affichées sur la landing page.
 */

import { getApiUrl } from "./api";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorUsername: string;
  createdAt: string;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/announcements`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as Announcement[];
}
