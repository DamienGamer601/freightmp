"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations, type Conversation } from "@/lib/messages";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
            Messagerie
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Vos conversations</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Discutez avec les joueurs de FreightMP.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="card p-8 text-center backdrop-blur">
            <p className="text-4xl">💬</p>
            <p className="mt-3 text-sm text-zinc-400">
              Aucune conversation. Ouvrez le profil d&apos;un joueur et cliquez sur
              « Message ».
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {conversations.map((conversation) => (
              <li key={conversation.user.id}>
                <Link
                  href={`/messages/${encodeURIComponent(conversation.user.username)}`}
                  className="flex items-center gap-3 card px-4 py-3 backdrop-blur transition-colors hover:border-white/10 hover:bg-charbon-800"
                >
                  {conversation.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={conversation.user.avatarUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-sm font-bold text-white">
                      {conversation.user.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {conversation.user.username}
                      </p>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {formatDate(conversation.lastMessage.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
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
