/**
 * Helpers d'accès à l'API FreightMP.
 *
 * Tous les appels publics passent par la base configurée via
 * `NEXT_PUBLIC_API_URL` (défaut : http://localhost:4000).
 */

export type ServerStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE";

export type GameId = "ETS2" | "ATS";

export interface GameServer {
  id: string;
  name: string;
  slug: string;
  game: GameId;
  status: ServerStatus;
  onlinePlayers: number;
  maxPlayers: number;
  region: string;
  version: string;
  host: string;
  port: number;
  lastHeartbeatAt: string;
}

export interface ServersStatusResponse {
  updatedAt: string;
  totalOnline: number;
  totalServers: number;
  servers: GameServer[];
}

/** Base URL de l'API, sans slash final.
 *
 * Si `NEXT_PUBLIC_API_URL` n'est pas défini et que la page est ouverte depuis
 * une autre machine (ex. http://192.168.1.58:3000), on dérive l'IP de l'API
 * depuis l'hôte courant — pour fonctionner sur le réseau local sans rebuild.
 */
export function getApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location.hostname) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:4000`;
    }
  }

  return "http://localhost:4000";
}

/** URL de redirection OAuth Steam. */
export function getSteamAuthUrl(): string {
  return `${getApiUrl()}/api/v1/auth/steam`;
}

/** URL de redirection OAuth Discord. */
export function getDiscordAuthUrl(): string {
  return `${getApiUrl()}/api/v1/auth/discord`;
}

/** Récupère le statut du réseau de serveurs FreightMP. */
export async function fetchServersStatus(): Promise<ServersStatusResponse> {
  const res = await fetch(`${getApiUrl()}/api/v1/servers/status`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as ServersStatusResponse;
}
