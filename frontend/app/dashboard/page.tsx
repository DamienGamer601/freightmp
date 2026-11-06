"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchFriends } from "@/lib/friends";
import { fetchNotifications } from "@/lib/notifications";
import { fetchConversations } from "@/lib/messages";
import { fetchEvents, type GameEvent } from "@/lib/events";

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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [friendsCount, setFriendsCount] = useState(0);
  const [pendingFriends, setPendingFriends] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [events, setEvents] = useState<GameEvent[]>([]);

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
    fetchEvents()
      .then((data) =>
        setEvents(
          data
            .filter((e) => e.status === "UPCOMING" || e.status === "ONGOING")
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .slice(0, 3),
        ),
      )
      .catch(() => {});
  }, [user]);

  const derived = useMemo(() => {
    if (!user) {
      return { xp: 0, level: 1, xpInLevel: 0, avgKm: 0, rank: null as number | null };
    }
    const xp = Math.round(user.stats.kilometersDriven) + user.stats.deliveriesCompleted * 100;
    const level = Math.floor(xp / 1000) + 1;
    const xpInLevel = xp % 1000;
    const avgKm =
      user.stats.deliveriesCompleted > 0
        ? user.stats.kilometersDriven / user.stats.deliveriesCompleted
        : 0;
    return { xp, level, xpInLevel, avgKm, rank: null };
  }, [user]);

  if (authLoading) {
    return (
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
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
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    );
  }

  const { xp, level, xpInLevel, avgKm } = derived;
  const ownedVtc = user.ownedVtcs[0] ?? null;
  const affiliation = user.affiliations[0] ?? null;
  const vtcHref = ownedVtc
    ? `/vtc/${ownedVtc.id}`
    : affiliation
      ? `/vtc/${affiliation.vtcId}`
      : "/vtcs";
  const vtcLabel = ownedVtc?.name ?? affiliation?.name ?? null;

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
      href: vtcHref,
      icon: "🏢",
      label: "VTC",
      value: ownedVtc || affiliation ? 1 : 0,
      hint: ownedVtc ? "propriétaire" : affiliation ? "membre" : "rejoindre",
    },
  ];

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl space-y-6">
        {/* En-tête */}
        <div className="card overflow-hidden p-0 backdrop-blur">
          <div className="h-24 bg-gradient-to-r from-rouge-600/30 via-charbon-800 to-charbon-900" />
          <div className="p-6 pt-0">
            <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-charbon-900 bg-gradient-to-br from-rouge-500 to-rouge-700 text-2xl font-bold text-white shadow-xl">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-rouge-400">
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
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/profile" className="btn-ghost btn-sm">
                  Mon profil
                </Link>
                <Link href={`/p/${encodeURIComponent(user.username)}`} className="btn-ghost btn-sm">
                  Profil public
                </Link>
              </div>
            </div>

            {/* Barre XP */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Progression vers le niveau {level + 1}</span>
                <span>{xpInLevel} / 1000 XP</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-carbone-600">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rouge-600 to-rouge-400 transition-all"
                  style={{ width: `${Math.min(100, (xpInLevel / 1000) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Kilomètres</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatKm(user.stats.kilometersDriven)}
            </p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Livraisons</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {user.stats.deliveriesCompleted.toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Temps de jeu</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatPlayTime(user.stats.totalPlayTimeSeconds)}
            </p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Km / livraison</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {avgKm > 0 ? Math.round(avgKm).toLocaleString("fr-FR") : "—"}
            </p>
          </div>
        </div>

        {/* Raccourcis */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="card card-hover p-5 backdrop-blur"
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* VTC */}
          <div className="card p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Ma VTC</h2>
              <Link href="/vtcs" className="text-xs font-medium text-rouge-400 hover:text-rouge-300">
                Annuaire →
              </Link>
            </div>
            {vtcLabel ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rouge-500 to-rouge-700 text-sm font-bold text-white">
                  {vtcLabel.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{vtcLabel}</p>
                  <p className="text-xs text-zinc-500">
                    {ownedVtc ? "Vous êtes propriétaire" : "Vous êtes membre"}
                  </p>
                </div>
                <Link href={vtcHref} className="btn-ghost btn-sm">
                  Ouvrir
                </Link>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center">
                <p className="text-sm text-zinc-400">
                  Vous ne faites partie d&apos;aucune VTC.
                </p>
                <Link href="/vtcs" className="btn-primary btn-sm mt-3 inline-flex">
                  Créer ou rejoindre une VTC
                </Link>
              </div>
            )}
          </div>

          {/* Événements à venir */}
          <div className="card p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Événements à venir</h2>
              <Link href="/events" className="text-xs font-medium text-rouge-400 hover:text-rouge-300">
                Voir tout →
              </Link>
            </div>
            {events.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Aucun événement programmé.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{event.title}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {formatDateTime(event.startAt)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    <span className="badge shrink-0">
                      {event.status === "ONGOING" ? "En cours" : "À venir"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
              {user.deliveries.slice(0, 6).map((delivery) => (
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

        {/* Accès rapides */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/multiplayer" className="btn-ghost justify-center">
            🎮 Multijoueur
          </Link>
          <Link href="/map" className="btn-ghost justify-center">
            🗺️ Carte live
          </Link>
          <Link href="/leaderboard" className="btn-ghost justify-center">
            🏆 Classement
          </Link>
          <Link href="/events" className="btn-ghost justify-center">
            📅 Événements
          </Link>
        </div>
      </div>
    </section>
  );
}
