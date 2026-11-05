/**
 * Messagerie entre joueurs.
 */

import { getApiUrl } from "./api";

export interface ConversationUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface Conversation {
  user: ConversationUser;
  lastMessage: { body: string; createdAt: string; fromMe: boolean };
  unread: number;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
}

export interface ConversationDetail {
  user: ConversationUser;
  messages: ChatMessage[];
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

export function fetchConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/api/v1/messages/conversations");
}

export function fetchConversation(username: string): Promise<ConversationDetail> {
  return request<ConversationDetail>(
    `/api/v1/messages/${encodeURIComponent(username)}`,
  );
}

export function sendMessage(username: string, body: string): Promise<unknown> {
  return request(`/api/v1/messages/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}
