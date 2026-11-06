"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  EVENT_STATUS_BADGE,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  fetchEvents,
  fetchMyEvents,
  joinEvent,
  leaveEvent,
  type GameEvent,
} from "@/lib/events";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compte à rebours lisible (ex. « dans 3 j 4 h »). */
function countdown(value: string): string {
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return "";
  if (diff <= 0) return "imminent";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `dans ${days} j ${hours} h`;
  if (hours > 0) return `dans ${hours} h ${minutes} min`;
  return `dans ${minutes} min`;
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"upcoming" | "mine" | "past">("upcoming");

  const load = useCallback(() => {
    setLoading(true);
    fetchEvents()
      .then((data) => {
        setEvents(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les événements."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) {
      setJoinedIds(new Set());
      return;
    }
    fetchMyEvents()
      .then((ids) => setJoinedIds(new Set(ids)))
      .catch(() => {});
  }, [user]);

  const toggleJoin = async (event: GameEvent) => {
    setBusyId(event.id);
    setError(null);
    try {
      if (joinedIds.has(event.id)) {
        await leaveEvent(event.id);
      } else {
        await joinEvent(event.id);
      }
      setJoinedIds((prev) => {
        const next = new Set(prev);
        if (next.has(event.id)) next.delete(event.id);
        else next.add(event.id);
        return next;
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  const now = Date.now();
  const upcoming = events
    .filter((event) => new Date(event.startAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = events
    .filter((event) => new Date(event.startAt).getTime() < now)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  const mine = upcoming.filter((event) => joinedIds.has(event.id));
  const visible = tab === "upcoming" ? upcoming : tab === "mine" ? mine : past;
  const nextEvent = upcoming[0] ?? null;

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
            Événements
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Convois &amp; événements
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Rejoignez les prochains convois et événements de la communauté.
          </p>
        </div>

        <div className="flex items-center rounded-xl border border-white/5 bg-charbon-900/60 p-1">
          {(
            [
              { id: "upcoming", label: `À venir (${upcoming.length})` },
              ...(user ? [{ id: "mine" as const, label: `Mes événements (${mine.length})` }] : []),
              { id: "past", label: `Passés (${past.length})` },
            ] as { id: "upcoming" | "mine" | "past"; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-rouge-500 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Prochain événement */}
        {nextEvent && (
          <div className="card flex flex-wrap items-center justify-between gap-3 border-rouge-500/20 bg-gradient-to-r from-rouge-600/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗓️</span>
              <div>
                <p className="text-xs uppercase tracking-wide text-rouge-400">Prochain événement</p>
                <p className="font-semibold text-white">{nextEvent.title}</p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(nextEvent.startAt)}
                  {nextEvent.location ? ` · ${nextEvent.location}` : ""}
                </p>
              </div>
            </div>
            <span className="badge badge-ok">{countdown(nextEvent.startAt)}</span>
          </div>
        )}

        {error && <p className="text-sm text-rouge-400">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="card p-8 text-center backdrop-blur">
            <p className="text-4xl">📅</p>
            <p className="mt-3 text-sm text-zinc-400">
              {tab === "upcoming"
                ? "Aucun événement à venir pour le moment."
                : tab === "mine"
                  ? "Vous n'êtes inscrit à aucun événement à venir."
                  : "Aucun événement passé."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visible.map((event) => {
              const joined = joinedIds.has(event.id);
              return (
                <article
                  key={event.id}
                  className="flex flex-col card p-5 backdrop-blur"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${EVENT_STATUS_BADGE[event.status]}`}
                    >
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                    {event.game && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          event.game === "ATS"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-rouge-500/15 text-rouge-300"
                        }`}
                      >
                        {event.game}
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 text-lg font-semibold text-white">{event.title}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-zinc-400">
                    {event.description}
                  </p>

                  <dl className="mt-3 space-y-1 text-xs text-zinc-500">
                    <div>
                      <span className="text-zinc-400">📅 </span>
                      {formatDateTime(event.startAt)}
                    </div>
                    {event.location && (
                      <div>
                        <span className="text-zinc-400">📍 </span>
                        {event.location}
                      </div>
                    )}
                    <div>
                      <span className="text-zinc-400">👥 </span>
                      {event.participantCount} participant
                      {event.participantCount > 1 ? "s" : ""}
                      {event.organizerUsername ? ` · organisé par ${event.organizerUsername}` : ""}
                    </div>
                  </dl>

                  <div className="mt-4 flex-1" />

                  {user ? (
                    <button
                      type="button"
                      onClick={() => void toggleJoin(event)}
                      disabled={busyId === event.id}
                      className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        joined
                          ? "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                          : "bg-rouge-500 text-white hover:bg-rouge-400"
                      }`}
                    >
                      {busyId === event.id
                        ? "…"
                        : joined
                          ? "Inscrit ✓ — Annuler"
                          : "S'inscrire"}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-zinc-500">
                      Connectez-vous pour vous inscrire.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
