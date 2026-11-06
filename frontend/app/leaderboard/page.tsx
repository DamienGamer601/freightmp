"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from "@/lib/leaderboard";
import { countryFlag } from "@/lib/profile";

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("fr-FR")} km`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function Avatar({ entry, size = "h-10 w-10" }: { entry: LeaderboardEntry; size?: string }) {
  if (entry.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={entry.avatarUrl} alt="" className={`${size} rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${size} flex items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-700 text-sm font-bold text-white`}
    >
      {entry.username.charAt(0).toUpperCase()}
    </span>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<LeaderboardMetric>("km");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLeaderboard(metric)
      .then((data) => {
        if (!active) return;
        setEntries(data.entries);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Impossible de charger le classement.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [metric]);

  const value = (entry: LeaderboardEntry) =>
    metric === "km" ? formatKm(entry.kilometersDriven) : `${entry.deliveriesCompleted} liv.`;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = useMemo(
    () => (user ? entries.find((entry) => entry.id === user.id) ?? null : null),
    [entries, user],
  );

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl space-y-6">
        <div>
          <p className="section-eyebrow">Classement</p>
          <h1 className="section-title mt-3">Les meilleurs chauffeurs</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Le top 50 des joueurs FreightMP, classés par kilomètres ou livraisons.
          </p>
        </div>

        <div className="flex items-center rounded-xl border border-white/5 bg-charbon-900/60 p-1">
          {(
            [
              { id: "km", label: "Kilomètres" },
              { id: "deliveries", label: "Livraisons" },
            ] as { id: LeaderboardMetric; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMetric(item.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                metric === item.id
                  ? "bg-rouge-500 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-rouge-400">{error}</p>}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`r${i}`} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-4xl">🏁</p>
            <p className="mt-3 font-semibold text-white">Aucun joueur classé</p>
            <p className="mt-1 text-sm text-zinc-500">
              Roulez et enregistrez des livraisons pour apparaître ici.
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {podium.map((entry) => {
                const isMe = user?.id === entry.id;
                const first = entry.rank === 1;
                return (
                  <Link
                    key={entry.id}
                    href={`/p/${encodeURIComponent(entry.username)}`}
                    className={`card card-hover relative overflow-hidden p-5 text-center ${
                      first ? "sm:-mt-3 sm:pb-8" : ""
                    } ${isMe ? "ring-1 ring-rouge-500/40" : ""}`}
                  >
                    <span className="absolute right-3 top-3 text-2xl">
                      {MEDALS[entry.rank - 1]}
                    </span>
                    <div className="mx-auto flex justify-center">
                      <Avatar entry={entry} size={first ? "h-16 w-16" : "h-14 w-14"} />
                    </div>
                    <p className="mt-3 truncate font-semibold text-white">
                      {entry.username}
                      {entry.country && (
                        <span className="ml-1">{countryFlag(entry.country)}</span>
                      )}
                    </p>
                    <p className={`mt-1 text-lg font-bold ${first ? "text-rouge-300" : "text-zinc-200"}`}>
                      {value(entry)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Niveau {entry.level}</p>
                    {isMe && (
                      <p className="mt-1 text-[11px] font-semibold text-rouge-400">(vous)</p>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Ma position */}
            {me && me.rank > 3 && (
              <div className="card flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-400">#{me.rank}</span>
                  <Avatar entry={me} size="h-9 w-9" />
                  <span className="font-medium text-white">{me.username}</span>
                </div>
                <span className="text-sm font-semibold text-rouge-300">{value(me)}</span>
              </div>
            )}

            {/* Suite du classement */}
            <div className="overflow-hidden card backdrop-blur">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/5 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Joueur</th>
                    <th className="px-4 py-3 text-right font-medium">Niveau</th>
                    <th className="px-4 py-3 text-right font-medium">Km</th>
                    <th className="px-4 py-3 text-right font-medium">Livraisons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(rest.length > 0 ? rest : []).map((entry) => {
                    const isMe = user?.id === entry.id;
                    return (
                      <tr key={entry.id} className={isMe ? "bg-rouge-500/10" : undefined}>
                        <td className="px-4 py-3 font-bold text-zinc-400">{entry.rank}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/p/${encodeURIComponent(entry.username)}`}
                            className="flex items-center gap-3"
                          >
                            <Avatar entry={entry} size="h-8 w-8" />
                            <span className="font-medium text-white hover:text-rouge-300">
                              {entry.username}
                              {entry.country && (
                                <span className="ml-1" title={entry.country}>
                                  {countryFlag(entry.country)}
                                </span>
                              )}
                              {isMe && (
                                <span className="ml-2 text-xs text-rouge-400">(vous)</span>
                              )}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="rounded-md bg-carbone-600 px-2 py-0.5 text-xs font-semibold text-zinc-200">
                            {entry.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatKm(entry.kilometersDriven)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {entry.deliveriesCompleted.toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                  {rest.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                        Seulement {entries.length} joueur{entries.length > 1 ? "s" : ""} classé
                        {entries.length > 1 ? "s" : ""}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
