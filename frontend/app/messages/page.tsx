"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations, type Conversation } from "@/lib/messages";

/** « il y a 5 min », « hier », « 12 mars ». */
function relativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    fetchConversations()
      .then((data) => {
        if (active) setConversations(data);
      })
      .catch(() => {
        /* silencieux */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.user.username.toLowerCase().includes(q) ||
        conversation.lastMessage.body.toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
    [conversations],
  );

  if (!authLoading && !user) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">💬</p>
          <h1 className="mt-4 text-xl font-bold text-white">Connectez-vous</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connectez-vous pour accéder à votre messagerie.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-eyebrow">Messagerie</p>
            <h1 className="section-title mt-3">Vos conversations</h1>
            <p className="mt-3 text-sm text-zinc-400">
              {totalUnread > 0
                ? `${totalUnread} message${totalUnread > 1 ? "s" : ""} non lu${totalUnread > 1 ? "s" : ""}`
                : "Discutez avec les joueurs de FreightMP."}
            </p>
          </div>
        </div>

        {conversations.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="input"
          />
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="card p-10 text-center backdrop-blur">
            <p className="text-4xl">💬</p>
            <p className="mt-3 font-semibold text-white">Aucune conversation</p>
            <p className="mt-1 text-sm text-zinc-400">
              Ouvrez le profil d&apos;un joueur et cliquez sur « Message ».
            </p>
            <Link href="/leaderboard" className="btn-primary btn-sm mt-4 inline-flex">
              Trouver des joueurs
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center backdrop-blur">
            <p className="text-4xl">🔍</p>
            <p className="mt-3 font-semibold text-white">Aucun résultat</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((conversation) => (
              <li key={conversation.user.id}>
                <Link
                  href={`/messages/${encodeURIComponent(conversation.user.username)}`}
                  className={`card card-hover flex items-center gap-3 px-4 py-3 ${
                    conversation.unread > 0 ? "border-rouge-500/20 bg-rouge-500/5" : ""
                  }`}
                >
                  {conversation.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={conversation.user.avatarUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-700 text-sm font-bold text-white">
                      {conversation.user.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-sm ${
                          conversation.unread > 0
                            ? "font-bold text-white"
                            : "font-semibold text-zinc-200"
                        }`}
                      >
                        {conversation.user.username}
                      </p>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {relativeDate(conversation.lastMessage.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-xs ${
                        conversation.unread > 0 ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {conversation.lastMessage.fromMe ? "Vous : " : ""}
                      {conversation.lastMessage.body}
                    </p>
                  </div>
                  {conversation.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rouge-500 px-1.5 text-[10px] font-bold text-white">
                      {conversation.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
