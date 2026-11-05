"use client";

import { useEffect, useState } from "react";
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

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
            Classement
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Les meilleurs chauffeurs</h1>
          <p className="mt-2 text-sm text-zinc-400">
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
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : (
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
                {entries.map((entry) => {
                  const isMe = user?.id === entry.id;
                  return (
                    <tr
                      key={entry.id}
                      className={isMe ? "bg-rouge-500/10" : undefined}
                    >
                      <td className="px-4 py-3 font-bold text-zinc-400">
                        {entry.rank <= 3 ? (
                          <span className="text-lg">{MEDALS[entry.rank - 1]}</span>
                        ) : (
                          entry.rank
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/p/${encodeURIComponent(entry.username)}`}
                          className="flex items-center gap-3"
                        >
                          {entry.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.avatarUrl}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-xs font-bold text-white">
                              {entry.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium text-white hover:text-rouge-300">
                            {entry.username}
                            {entry.country && (
                              <span className="ml-1" title={entry.country}>
                                {countryFlag(entry.country)}
                              </span>
                            )}
                            {isMe && (
                              <span className="ml-2 text-xs text-rouge-400">
                                (vous)
                              </span>
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
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                      Aucun joueur classé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
