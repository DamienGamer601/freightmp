/**
 * Notifications in-app de l'utilisateur connecté.
 */

import { getApiUrl } from "./api";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: AppNotification[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`Statut HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export function fetchNotifications(): Promise<NotificationsResponse> {
  return request<NotificationsResponse>("/api/v1/notifications");
}

export function markNotificationRead(id: string): Promise<unknown> {
  return request(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<unknown> {
  return request("/api/v1/notifications/read-all", { method: "POST" });
}
