/**
 * Helpers typés pour le panneau d'administration.
 */

import { getApiUrl } from "./api";

export type AdminRole = "ADMIN" | "DEV" | "MODERATOR" | "DRIVER";

export interface AdminUser {
  id: string;
  username: string;
  role: AdminRole;
  steamId: string | null;
  discordId: string | null;
  createdAt: string;
  stats: {
    kilometersDriven: number;
    deliveriesCompleted: number;
    totalPlayTimeSeconds: number;
  };
  banCount: number;
  deliveryCount: number;
}

export interface AdminBan {
  id: string;
  userId: string;
  targetUsername: string;
  issuerId: string;
  issuerUsername: string;
  type: "WARNING" | "TEMPORARY" | "PERMANENT";
  reason: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminServer {
  id: string;
  name: string;
  slug: string;
  game: "ETS2" | "ATS";
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  maxPlayers: number;
  onlinePlayers: number;
  host: string;
  port: number;
  region: string | null;
  version: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  published: boolean;
  authorUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUsername: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

export interface DashboardStats {
  users: number;
  servers: number;
  onlineServers: number;
  deliveries: number;
  activeBans: number;
  vtcs: number;
  totalKm: number;
  recentBans: {
    id: string;
    targetUsername: string;
    type: string;
    reason: string;
    createdAt: string;
  }[];
  recentDeliveries: {
    id: string;
    username: string;
    cargoName: string;
    fromCity: string;
    toCity: string;
    distanceKm: number;
    createdAt: string;
  }[];
  recentUsers: {
    id: string;
    username: string;
    role: AdminRole;
    createdAt: string;
  }[];
}

export interface AdminVtc {
  id: string;
  name: string;
  tag: string;
  ownerId: string;
  ownerUsername: string;
  memberCount: number;
  createdAt: string;
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

export function fetchDashboard(): Promise<DashboardStats> {
  return request<DashboardStats>("/api/v1/admin/dashboard");
}

/* ---------- Utilisateurs ---------- */

export function fetchAdminUsers(
  query: { role?: AdminRole | ""; search?: string } = {},
): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  if (query.search) params.set("search", query.search);
  return request<AdminUser[]>(`/api/v1/admin/users?${params.toString()}`);
}

export function updateUserRole(
  id: string,
  role: AdminRole,
): Promise<{ id: string; username: string; role: AdminRole }> {
  return request(`/api/v1/admin/users/${id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export function deleteUser(id: string): Promise<{ success: boolean }> {
  return request(`/api/v1/admin/users/${id}`, { method: "DELETE" });
}

/* ---------- Sanctions ---------- */

export function fetchAdminBans(): Promise<AdminBan[]> {
  return request<AdminBan[]>("/api/v1/admin/bans");
}

export function createBan(input: {
  userId: string;
  type: AdminBan["type"];
  reason: string;
  expiresAt?: string;
}): Promise<AdminBan> {
  return request<AdminBan>("/api/v1/admin/bans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function revokeBan(id: string): Promise<AdminBan> {
  return request<AdminBan>(`/api/v1/admin/bans/${id}/revoke`, {
    method: "POST",
  });
}

/* ---------- Serveurs ---------- */

export function fetchAdminServers(): Promise<AdminServer[]> {
  return request<AdminServer[]>("/api/v1/admin/servers");
}

export function createServer(input: {
  name: string;
  slug: string;
  game: AdminServer["game"];
  maxPlayers: number;
  host: string;
  port: number;
  region?: string;
  version?: string;
}): Promise<AdminServer> {
  return request<AdminServer>("/api/v1/admin/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateServer(
  id: string,
  input: Partial<{
    name: string;
    status: AdminServer["status"];
    maxPlayers: number;
    region: string | null;
    version: string | null;
    host: string;
    port: number;
  }>,
): Promise<AdminServer> {
  return request<AdminServer>(`/api/v1/admin/servers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteServer(id: string): Promise<{ success: boolean }> {
  return request(`/api/v1/admin/servers/${id}`, { method: "DELETE" });
}

/* ---------- VTC ---------- */

export function fetchVtcs(): Promise<AdminVtc[]> {
  return request<AdminVtc[]>("/api/v1/vtcs");
}

export function deleteVtc(id: string): Promise<{ success: boolean }> {
  return request(`/api/v1/admin/vtcs/${id}`, { method: "DELETE" });
}

export type VtcMemberRole = "OWNER" | "MANAGER" | "MEMBER";

export interface VtcMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: VtcMemberRole;
  joinedAt: string;
}

export interface VtcDetail {
  id: string;
  name: string;
  tag: string;
  ownerId: string;
  ownerUsername: string;
  createdAt: string;
  members: VtcMember[];
}

export function fetchVtcDetail(id: string): Promise<VtcDetail> {
  return request<VtcDetail>(`/api/v1/admin/vtcs/${id}`);
}

export function addVtcMember(
  vtcId: string,
  input: { username: string; role?: VtcMemberRole },
): Promise<VtcMember> {
  return request<VtcMember>(`/api/v1/admin/vtcs/${vtcId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateVtcMemberRole(
  vtcId: string,
  userId: string,
  role: VtcMemberRole,
): Promise<{ userId: string; role: VtcMemberRole }> {
  return request(`/api/v1/admin/vtcs/${vtcId}/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export function removeVtcMember(
  vtcId: string,
  userId: string,
): Promise<{ success: boolean }> {
  return request(`/api/v1/admin/vtcs/${vtcId}/members/${userId}`, {
    method: "DELETE",
  });
}

/* ---------- Annonces ---------- */

export function fetchAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  return request<AdminAnnouncement[]>("/api/v1/admin/announcements");
}

export function createAnnouncement(input: {
  title: string;
  body: string;
  published?: boolean;
}): Promise<AdminAnnouncement> {
  return request<AdminAnnouncement>("/api/v1/admin/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateAnnouncement(
  id: string,
  input: Partial<{ title: string; body: string; published: boolean }>,
): Promise<AdminAnnouncement> {
  return request<AdminAnnouncement>(`/api/v1/admin/announcements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteAnnouncement(id: string): Promise<{ success: boolean }> {
  return request(`/api/v1/admin/announcements/${id}`, { method: "DELETE" });
}

/* ---------- Journal d'audit ---------- */

export function fetchAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(`/api/v1/admin/audit-log?limit=${limit}`);
}

/* ---------- Événements ---------- */

export type AdminEventType = "CONVOY" | "DELIVERY" | "SPECIAL";
export type AdminEventStatus = "UPCOMING" | "ONGOING" | "FINISHED" | "CANCELLED";

export interface AdminEvent {
  id: string;
  title: string;
  description: string;
  type: AdminEventType;
  status: AdminEventStatus;
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

export interface EventInput {
  title: string;
  description: string;
  type: AdminEventType;
  status: AdminEventStatus;
  startAt: string;
  endAt?: string;
  location?: string;
  game?: "ETS2" | "ATS";
  published?: boolean;
}

export function fetchAdminEvents(): Promise<AdminEvent[]> {
  return request<AdminEvent[]>("/api/v1/admin/events");
}

export function createEvent(input: EventInput): Promise<AdminEvent> {
  return request<AdminEvent>("/api/v1/admin/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateEvent(
  id: string,
  input: Partial<EventInput>,
): Promise<AdminEvent> {
  return request<AdminEvent>(`/api/v1/admin/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteEvent(id: string): Promise<{ success: boolean }> {
  return request(`/api/v1/admin/events/${id}`, { method: "DELETE" });
}
