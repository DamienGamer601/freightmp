"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  announcement: { icon: "📢", label: "Annonce", color: "text-amber-300" },
  event: { icon: "📅", label: "Événement", color: "text-indigo-300" },
  friend: { icon: "🤝", label: "Ami", color: "text-emerald-300" },
  message: { icon: "💬", label: "Message", color: "text-sky-300" },
  ban: { icon: "⛔", label: "Modération", color: "text-rouge-300" },
  role: { icon: "🛡️", label: "Rôle", color: "text-rouge-300" },
  vtc: { icon: "🏢", label: "VTC", color: "text-orange-300" },
  server: { icon: "🖥️", label: "Serveur", color: "text-zinc-300" },
};

function meta(type: string) {
  return TYPE_META[type] ?? { icon: "🔔", label: "Notification", color: "text-zinc-300" };
}

/** « il y a 5 min », « hier », « le 12 mars ». */
function relativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    fetchNotifications()
      .then((data) => {
        if (!active) return;
        setNotifications(data.notifications);
        setUnread(data.unreadCount);
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

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnread(0);
  };

  const markOne = async (notification: AppNotification) => {
    if (notification.read) return;
    await markNotificationRead(notification.id).catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    );
    setUnread((value) => Math.max(0, value - 1));
  };

  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [notifications, filter],
  );

  if (!authLoading && !user) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">🔔</p>
          <h1 className="mt-4 text-xl font-bold text-white">Connectez-vous</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connectez-vous pour consulter vos notifications.
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
            <p className="section-eyebrow">Notifications</p>
            <h1 className="section-title mt-3">Centre de notifications</h1>
            <p className="mt-3 text-sm text-zinc-400">
              {unread > 0 ? (
                <>
                  <span className="font-semibold text-rouge-300">{unread}</span> non lue
                  {unread > 1 ? "s" : ""} sur {notifications.length}
                </>
              ) : (
                "Tout est à jour."
              )}
            </p>
          </div>
          {unread > 0 && (
            <button type="button" onClick={() => void markAll()} className="btn-ghost btn-sm">
              Tout marquer comme lu
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex items-center rounded-xl border border-white/5 bg-charbon-900/60 p-1">
          {(
            [
              { id: "all", label: `Toutes (${notifications.length})` },
              { id: "unread", label: `Non lues (${unread})` },
            ] as { id: "all" | "unread"; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                filter === item.id
                  ? "bg-rouge-500 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="card p-10 text-center backdrop-blur">
            <p className="text-4xl">🔔</p>
            <p className="mt-3 font-semibold text-white">
              {filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {filter === "unread"
                ? "Vous êtes à jour, bravo !"
                : "Vous recevrez ici les annonces, messages et événements."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((notification) => {
              const info = meta(notification.type);
              return (
                <li
                  key={notification.id}
                  className={`card flex items-start gap-3 p-4 ${
                    notification.read ? "opacity-70" : "border-rouge-500/20 bg-rouge-500/5"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg">
                    {info.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${info.color}`}>
                        {info.label}
                      </span>
                      {!notification.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rouge-400" />
                      )}
                      <span className="text-[11px] text-zinc-500">
                        {relativeDate(notification.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{notification.title}</p>
                    {notification.body && (
                      <p className="mt-0.5 text-sm text-zinc-400">{notification.body}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      {notification.link && (
                        <Link
                          href={notification.link}
                          onClick={() => void markOne(notification)}
                          className="text-xs font-medium text-rouge-400 hover:text-rouge-300"
                        >
                          Ouvrir →
                        </Link>
                      )}
                      {!notification.read && (
                        <button
                          type="button"
                          onClick={() => void markOne(notification)}
                          className="text-xs font-medium text-zinc-400 hover:text-white"
                        >
                          Marquer comme lu
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
