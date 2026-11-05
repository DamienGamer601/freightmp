"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchConversation,
  sendMessage,
  type ChatMessage,
  type ConversationUser,
} from "@/lib/messages";

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "");
  const { user, loading: authLoading } = useAuth();
  const [other, setOther] = useState<ConversationUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchConversation(username)
      .then((data) => {
        setOther(data.user);
        setMessages(data.messages);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [user, authLoading, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(username, body);
      setDraft("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSending(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">💬</p>
          <h1 className="mt-4 text-xl font-bold text-white">Connectez-vous</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connectez-vous pour envoyer des messages.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-rouge-500 px-6 py-3 text-sm font-semibold text-white hover:bg-rouge-400"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-2xl flex-col space-y-4">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          ← Toutes les conversations
        </Link>

        <div className="overflow-hidden card backdrop-blur">
          {/* En-tête */}
          <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
            {other?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={other.avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-sm font-bold text-white">
                {(other?.username ?? username).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <Link
                href={`/p/${encodeURIComponent(username)}`}
                className="truncate text-sm font-semibold text-white hover:text-rouge-300"
              >
                {other?.username ?? username}
              </Link>
              <p className="text-xs text-zinc-500">Conversation privée</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex h-[460px] flex-col gap-2 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <p className="my-auto text-center text-sm text-zinc-500">
                Aucun message. Commencez la conversation !
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      message.fromMe
                        ? "rounded-br-md bg-rouge-500 text-white"
                        : "rounded-bl-md bg-carbone-600 text-zinc-100"
                    }`}
                  >
                    <p className="whitespace-pre-line break-words">{message.body}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        message.fromMe ? "text-rouge-100/80" : "text-zinc-400"
                      }`}
                    >
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-white/5 px-4 py-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Votre message…"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="rounded-lg bg-rouge-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
            >
              {sending ? "…" : "Envoyer"}
            </button>
          </form>
        </div>

        {error && <p className="text-sm text-rouge-400">{error}</p>}
      </div>
    </section>
  );
}
