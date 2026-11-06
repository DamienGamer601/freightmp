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

/** Libellé de séparateur de jour : « Aujourd'hui », « Hier », « 12 mars 2026 ». */
function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, yesterday)) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
          <p className="mt-2 text-sm text-zinc-400">Connectez-vous pour envoyer des messages.</p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
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
              <img src={other.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-700 text-sm font-bold text-white">
                {(other?.username ?? username).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/p/${encodeURIComponent(username)}`}
                className="truncate text-sm font-semibold text-white hover:text-rouge-300"
              >
                {other?.username ?? username}
              </Link>
              <p className="text-xs text-zinc-500">
                {messages.length} message{messages.length > 1 ? "s" : ""} · conversation privée
              </p>
            </div>
            <Link href={`/p/${encodeURIComponent(username)}`} className="btn-ghost btn-sm">
              Profil
            </Link>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex h-[460px] flex-col gap-2 overflow-y-auto px-5 py-4"
          >
            {messages.length === 0 ? (
              <div className="my-auto text-center">
                <p className="text-3xl">👋</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Aucun message. Commencez la conversation !
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const previous = index > 0 ? messages[index - 1] : null;
                const showDay = !previous || !sameDay(previous.createdAt, message.createdAt);
                return (
                  <div key={message.id}>
                    {showDay && (
                      <div className="my-2 flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/5" />
                        <span className="text-[11px] font-medium text-zinc-500">
                          {dayLabel(message.createdAt)}
                        </span>
                        <span className="h-px flex-1 bg-white/5" />
                      </div>
                    )}
                    <div className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
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
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2 border-t border-white/5 px-4 py-3"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Votre message… (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)"
              rows={1}
              maxLength={2000}
              className="input max-h-32 min-h-[2.5rem] min-w-0 flex-1 resize-none py-2"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="btn-primary disabled:opacity-50"
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
