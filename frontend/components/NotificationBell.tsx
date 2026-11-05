"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      return;
    }
    let active = true;
    const load = () => {
      fetchNotifications()
        .then((data) => {
          if (!active) return;
          setNotifications(data.notifications);
          setUnread(data.unreadCount);
        })
        .catch(() => {
          /* silencieux */
        });
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );
      setUnread((value) => Math.max(0, value - 1));
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rouge-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-charbon-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="text-xs font-medium text-rouge-400 hover:text-rouge-300"
              >
                Tout lire
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 8).map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`flex w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                    notification.read ? "" : "bg-white/[0.03]"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.read ? "bg-transparent" : "bg-rouge-500"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">
                      {notification.title}
                    </span>
                    {notification.body && (
                      <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-400">
                        {notification.body}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                Aucune notification.
              </li>
            )}
          </ul>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-white/5 px-4 py-3 text-center text-xs font-medium text-zinc-300 hover:bg-white/5"
          >
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}
