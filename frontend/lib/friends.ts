/**
 * Système d'amis.
 */

import { getApiUrl } from "./api";

export type FriendStatus = "NONE" | "SELF" | "FRIENDS" | "OUTGOING" | "INCOMING";

export interface FriendUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}

export interface Friend extends FriendUser {
  since: string;
}

export interface FriendRequest {
  id: string;
  user: FriendUser;
  createdAt: string;
}

export interface FriendsResponse {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface FriendshipStatus {
  status: FriendStatus;
  requestId: string | null;
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

export function fetchFriends(): Promise<FriendsResponse> {
  return request<FriendsResponse>("/api/v1/friends");
}

export function fetchFriendshipStatus(username: string): Promise<FriendshipStatus> {
  return request<FriendshipStatus>(
    `/api/v1/friends/status/${encodeURIComponent(username)}`,
  );
}

export function sendFriendRequest(username: string): Promise<unknown> {
  return request("/api/v1/friends/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}

export function acceptFriendRequest(id: string): Promise<unknown> {
  return request(`/api/v1/friends/requests/${id}/accept`, { method: "POST" });
}

export function declineFriendRequest(id: string): Promise<unknown> {
  return request(`/api/v1/friends/requests/${id}/decline`, { method: "POST" });
}

export function removeFriend(friendId: string): Promise<unknown> {
  return request(`/api/v1/friends/${friendId}`, { method: "DELETE" });
}
