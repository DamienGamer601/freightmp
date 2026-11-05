/**
 * Helpers pour les compagnies virtuelles (VTC).
 */

import { getApiUrl } from "./api";

export type VtcMemberRole = "OWNER" | "MANAGER" | "MEMBER";

export interface VtcSummary {
  id: string;
  name: string;
  tag: string;
  ownerId: string;
  ownerUsername: string;
  memberCount: number;
  createdAt: string;
}

export interface VtcMember {
  userId: string;
  username: string;
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

export function fetchVtcs(): Promise<VtcSummary[]> {
  return request<VtcSummary[]>("/api/v1/vtcs");
}

export function fetchVtcDetail(id: string): Promise<VtcDetail> {
  return request<VtcDetail>(`/api/v1/vtcs/${id}`);
}

export function createVtc(input: {
  name: string;
  tag: string;
}): Promise<{ vtc: { id: string; name: string; tag: string }; affiliation: unknown }> {
  return request("/api/v1/vtcs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function joinVtc(id: string): Promise<unknown> {
  return request(`/api/v1/vtcs/${id}/join`, { method: "POST" });
}

export function leaveVtc(id: string): Promise<unknown> {
  return request(`/api/v1/vtcs/${id}/leave`, { method: "DELETE" });
}

export function updateVtc(
  id: string,
  input: { name: string },
): Promise<{ id: string; name: string; tag: string }> {
  return request(`/api/v1/vtcs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function addVtcMember(
  vtcId: string,
  input: { username: string },
): Promise<{ userId: string; username: string; role: VtcMemberRole; joinedAt: string }> {
  return request(`/api/v1/vtcs/${vtcId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateVtcMemberRole(
  vtcId: string,
  userId: string,
  role: "MANAGER" | "MEMBER",
): Promise<{ userId: string; role: VtcMemberRole }> {
  return request(`/api/v1/vtcs/${vtcId}/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export function removeVtcMember(
  vtcId: string,
  userId: string,
): Promise<{ success: boolean }> {
  return request(`/api/v1/vtcs/${vtcId}/members/${userId}`, { method: "DELETE" });
}

export function deleteVtc(id: string): Promise<{ success: boolean }> {
  return request(`/api/v1/vtcs/${id}`, { method: "DELETE" });
}
