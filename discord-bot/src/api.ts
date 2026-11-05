export type PlatformRole = 'ADMIN' | 'DEV' | 'MODERATOR' | 'DRIVER';

export interface ServerStatusEntry {
  name: string;
  slug: string;
  game: string;
  status: string;
  onlinePlayers: number;
  maxPlayers: number;
  region: string;
  version: string;
  lastHeartbeatAt: string;
}

export interface ServerStatusResponse {
  updatedAt: string;
  totalOnline: number;
  totalServers: number;
  servers: ServerStatusEntry[];
}

export interface InternalRoleUser {
  discordId: string;
  username: string;
  role: PlatformRole;
}

export interface InternalRolesResponse {
  users: InternalRoleUser[];
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(
      `API request failed: ${url} returned ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

export async function getServerStatus(apiUrl: string): Promise<ServerStatusResponse> {
  const url = `${trimTrailingSlash(apiUrl)}/api/v1/servers/status`;
  return fetchJson<ServerStatusResponse>(url);
}

export async function getInternalRoles(
  apiUrl: string,
  internalApiKey: string,
): Promise<InternalRolesResponse> {
  const url = `${trimTrailingSlash(apiUrl)}/api/v1/internal/roles`;
  return fetchJson<InternalRolesResponse>(url, {
    headers: { 'x-internal-key': internalApiKey },
  });
}
