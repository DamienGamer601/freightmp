"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchFriends } from "@/lib/friends";
import { fetchNotifications } from "@/lib/notifications";
import { fetchConversations } from "@/lib/messages";

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("fr-FR")} km`;
}

function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [friendsCount, setFriendsCount] = useState(0);
  const [pendingFriends, setPendingFriends] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchFriends()
      .then((data) => {
        setFriendsCount(data.friends.length);
        setPendingFriends(data.incoming.length);
      })
      .catch(() => {});
    fetchNotifications()
      .then((data) => setUnreadNotifications(data.unreadCount))
      .catch(() => {});
    fetchConversations()
      .then((data) =>
        setUnreadMessages(data.reduce((sum, conversation) => sum + conversation.unread, 0)),
      )
      .catch(() => {});
  }, [user]);

  if (authLoading) {
    return (
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">🚚</p>
          <h1 className="mt-4 text-xl font-bold text-white">Connectez-vous</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connectez-vous pour accéder à votre espace personnel.
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

  const xp = Math.round(user.stats.kilometersDriven) + user.stats.deliveriesCompleted * 100;
  const level = Math.floor(xp / 1000) + 1;
  const xpInLevel = xp % 1000;
  const ownedVtc = user.ownedVtcs[0] ?? null;
  const affiliation = user.affiliations[0] ?? null;

  const cards = [
    {
      href: "/notifications",
      icon: "🔔",
      label: "Notifications",
      value: unreadNotifications,
      hint: unreadNotifications > 0 ? "non lues" : "à jour",
    },
    {
      href: "/messages",
      icon: "💬",
      label: "Messages",
      value: unreadMessages,
      hint: unreadMessages > 0 ? "non lus" : "à jour",
    },
    {
      href: "/friends",
      icon: "🤝",
      label: "Amis",
      value: friendsCount,
      hint: pendingFriends > 0 ? `${pendingFriends} demande(s)` : "aucune demande",
    },
    {
      href: ownedVtc ? `/vtc/${ownedVtc.id}` : affiliation ? `/vtc/${affiliation.vtcId}` : "/vtcs",
      icon: "🏢",
      label: "VTC",
      value: ownedVtc ? 1 : 0,
      hint: ownedVtc ? "propriétaire" : affiliation ? "membre" : "aucune",
    },
  ];

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl space-y-6">
        {/* En-tête */}
        <div className="card p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
                Mon espace
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white">
                Bonjour, {user.username} 👋
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Niveau <span className="font-semibold text-white">{level}</span> ·{" "}
                {xp.toLocaleString("fr-FR")} XP
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/profile"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
              >
                Mon profil
              </Link>
              <Link
                href={`/p/${encodeURIComponent(user.username)}`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
              >
                Profil public
              </Link>
            </div>
          </div>

          {/* Barre XP */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-carbone-600">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rouge-600 to-rouge-400"
              style={{ width: `${Math.min(100, (xpInLevel / 1000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">{formatKm(user.stats.kilometersDriven)}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">Kilomètres</p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">
              {user.stats.deliveriesCompleted.toLocaleString("fr-FR")}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">Livraisons</p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">
              {formatPlayTime(user.stats.totalPlayTimeSeconds)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">Temps de jeu</p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">{level}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">Niveau</p>
          </div>
        </div>

        {/* Raccourcis */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="card p-5 backdrop-blur transition-colors hover:border-white/10 hover:bg-charbon-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{card.icon}</span>
                {card.value > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rouge-500 px-1.5 text-xs font-bold text-white">
                    {card.value}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{card.label}</p>
              <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
            </Link>
          ))}
        </div>

        {/* Livraisons récentes */}
        <div className="card p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Livraisons récentes</h2>
            <Link href="/profile" className="text-xs font-medium text-rouge-400 hover:text-rouge-300">
              Voir tout →
            </Link>
          </div>
          {user.deliveries.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Aucune livraison pour le moment. Prenez la route !
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-white/5">
              {user.deliveries.slice(0, 5).map((delivery) => (
                <li key={delivery.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {delivery.cargoName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {delivery.fromCity} → {delivery.toCity} ·{" "}
                      {formatDate(delivery.completedAt ?? delivery.startedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-zinc-300">
                    {Math.round(delivery.distanceKm)} km
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
