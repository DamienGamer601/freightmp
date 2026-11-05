/**
 * Client HTTP du serveur multijoueur FreightMP (plan de contrôle).
 *
 * Le serveur MP tourne sur :5001 par défaut. CORS autorisé côté serveur.
 */

import { getApiUrl } from "./api";

/** Base URL du serveur MP, dérivée de l'hôte courant sur le réseau local. */
function getMpUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MP_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location.hostname) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:5001`;
    }
  }

  return "http://localhost:5001";
}

export interface MpRoom {
  id: string;
  name: string;
  game: "ETS2" | "ATS";
  maxPlayers: number;
  playerCount: number;
  createdAt: number;
}

export interface MpPlayer {
  id: string;
  truckId: string;
  /** Pseudo FreightMP (si le joueur s'est authentifié). */
  username?: string;
  /** Tag de la VTC (si connu). */
  tag?: string;
  /** Latence (ms). */
  ping?: number;
  role?: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface MpRoomDetail extends MpRoom {
  tick: number;
  players: MpPlayer[];
}

export interface MpHealth {
  ok: boolean;
  rooms: number;
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${getMpUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export function fetchMpHealth(): Promise<MpHealth> {
  return request<MpHealth>("/health");
}

export async function fetchMpRooms(): Promise<MpRoom[]> {
  const data = await request<{ rooms: MpRoom[] }>("/rooms");
  return data.rooms;
}

export function fetchMpRoom(id: string): Promise<MpRoomDetail> {
  return request<MpRoomDetail>(`/rooms/${encodeURIComponent(id)}`);
}

export interface MpTokenResponse {
  token: string;
  expiresIn: number;
  username: string;
}

/** URL WebSocket du serveur MP (flux temps réel pour les viewers web). */
export function getMpWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MP_WS_URL;
  if (explicit) {
    return explicit;
  }
  return `${getMpUrl().replace(/^http/, "ws")}/ws`;
}

/** Demande à l'API un jeton signé pour le serveur multijoueur. */
export async function fetchMpToken(): Promise<MpTokenResponse> {
  const res = await fetch(`${getApiUrl()}/api/v1/mp/token`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(data?.error?.message ?? `Statut HTTP ${res.status}`);
  }

  return (await res.json()) as MpTokenResponse;
}
