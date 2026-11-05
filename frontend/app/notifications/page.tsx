"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

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
      prev.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );
    setUnread((value) => Math.max(0, value - 1));
  };

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
              Notifications
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">
              Centre de notifications
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {unread > 0 ? `${unread} non lue(s)` : "Tout est à jour."}
            </p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAll()}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="card p-8 text-center backdrop-blur">
            <p className="text-4xl">🔔</p>
            <p className="mt-3 text-sm text-zinc-400">
              Aucune notification pour le moment.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`rounded-2xl border px-4 py-3 ${
                  notification.read
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-rouge-500/20 bg-rouge-500/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="mt-1 text-sm text-zinc-400">{notification.body}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => void markOne(notification)}
                        className="text-xs font-medium text-rouge-400 hover:text-rouge-300"
                      >
                        Marquer lu
                      </button>
                    )}
                    {notification.link && (
                      <Link
                        href={notification.link}
                        onClick={() => void markOne(notification)}
                        className="text-xs font-medium text-zinc-300 hover:text-white"
                      >
                        Ouvrir →
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
