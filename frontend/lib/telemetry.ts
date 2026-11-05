/**
 * Helpers typés pour la télémétrie camions FreightMP.
 *
 * Le backend expose un snapshot REST (`GET /api/v1/telemetry`) et un
 * flux WebSocket (`/ws`) diffusant les mises à jour en temps réel.
 */

import { getApiUrl } from "./api";

export interface TruckTelemetry {
  truckId: string;
  game: string;
  speedKmh?: number;
  heading?: number;
  latitude?: number;
  longitude?: number;
  fuelLiters?: number;
  lastSeenAt?: string;
}

export interface TelemetrySnapshot {
  updatedAt: string;
  trucks: TruckTelemetry[];
}

/** Récupère l'état actuel des camions (snapshot REST). */
export async function fetchTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  const res = await fetch(`${getApiUrl()}/api/v1/telemetry`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as TelemetrySnapshot;
}

/** URL du WebSocket, dérivée de la base API (`http` → `ws`, `https` → `wss`). */
export function getWsUrl(): string {
  const base = getApiUrl();
  const wsBase = base.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
  return `${wsBase}/ws`;
}
