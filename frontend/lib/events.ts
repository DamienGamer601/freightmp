/**
 * Événements (convois, livraisons spéciales…).
 */

import { getApiUrl } from "./api";

export type EventType = "CONVOY" | "DELIVERY" | "SPECIAL";
export type EventStatus = "UPCOMING" | "ONGOING" | "FINISHED" | "CANCELLED";

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  startAt: string;
  endAt: string | null;
  location: string | null;
  game: "ETS2" | "ATS" | null;
  server: { id: string; name: string } | null;
  organizerUsername: string | null;
  participantCount: number;
  published: boolean;
  createdAt: string;
}

export interface EventDetail extends GameEvent {
  participants: { username: string; joinedAt: string }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(data?.error?.message ?? `Statut HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export function fetchEvents(): Promise<GameEvent[]> {
  return request<GameEvent[]>("/api/v1/events");
}

export function fetchEvent(id: string): Promise<EventDetail> {
  return request<EventDetail>(`/api/v1/events/${id}`);
}

export function fetchMyEvents(): Promise<string[]> {
  return request<string[]>("/api/v1/events/mine");
}

export function joinEvent(id: string): Promise<unknown> {
  return request(`/api/v1/events/${id}/join`, { method: "POST" });
}

export function leaveEvent(id: string): Promise<unknown> {
  return request(`/api/v1/events/${id}/join`, { method: "DELETE" });
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CONVOY: "Convoi",
  DELIVERY: "Livraison spéciale",
  SPECIAL: "Événement spécial",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  UPCOMING: "À venir",
  ONGOING: "En cours",
  FINISHED: "Terminé",
  CANCELLED: "Annulé",
};

export const EVENT_STATUS_BADGE: Record<EventStatus, string> = {
  UPCOMING: "border-rouge-500/30 bg-rouge-500/10 text-rouge-300",
  ONGOING: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FINISHED: "border-white/10 bg-white/5 text-zinc-400",
  CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500",
};
