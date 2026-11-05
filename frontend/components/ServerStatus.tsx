"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchServersStatus,
  type GameServer,
  type ServerStatus,
  type ServersStatusResponse,
} from "@/lib/api";

const POLL_INTERVAL_MS = 30_000;

const STATUS_CONFIG: Record<
  ServerStatus,
  { label: string; pill: string; dot: string }
> = {
  ONLINE: {
    label: "En ligne",
    pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30",
    dot: "bg-emerald-400",
  },
  OFFLINE: {
    label: "Hors ligne",
    pill: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/30",
    dot: "bg-zinc-500",
  },
  MAINTENANCE: {
    label: "Maintenance",
    pill: "bg-amber-500/10 text-amber-300 ring-amber-400/30",
    dot: "bg-amber-400",
  },
};

const GAME_BADGE: Record<GameServer["game"], string> = {
  ETS2: "bg-sky-500/10 text-sky-300",
  ATS: "bg-orange-500/10 text-orange-300",
};

export default function ServerStatus() {
  const [data, setData] = useState<ServersStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryKey, setRetryKey] = useState<number>(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    async function load(showLoading: boolean) {
      try {
        const res = await fetchServersStatus();
        if (active) setData(res);
      } catch {
        if (active) setError("Serveurs indisponibles");
      } finally {
        if (active && showLoading) setLoading(false);
      }
    }

    load(true);
    const id = setInterval(() => load(false), POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  return (
    <section id="serveurs" className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="section-eyebrow">Réseau</p>
            <h2 className="section-title mt-3">État des serveurs</h2>
            <p className="mt-3 text-zinc-400">
              Statut en temps réel du réseau FreightMP.
            </p>
          </div>

          {data && (
            <div className="glass rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span>
                  <span className="font-semibold text-white">{data.totalOnline}</span>{" "}
                  camionneurs en ligne sur{" "}
                  <span className="font-semibold text-white">{data.totalServers}</span>{" "}
                  serveur{data.totalServers > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          {loading && <SkeletonGrid />}

          {!loading && error && (
            <div className="card p-10 text-center">
              <p className="text-zinc-300">{error}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Impossible de joindre l&apos;API pour le moment.
              </p>
              <button type="button" onClick={retry} className="btn-primary mt-5 btn-sm">
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && data && data.servers.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.servers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          )}

          {!loading && !error && data && data.servers.length === 0 && (
            <div className="card p-10 text-center text-zinc-400">
              Aucun serveur enregistré pour le moment.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ServerCard({ server }: { server: GameServer }) {
  const cfg = STATUS_CONFIG[server.status];
  const fill =
    server.maxPlayers > 0
      ? Math.min(100, Math.round((server.onlinePlayers / server.maxPlayers) * 100))
      : 0;

  return (
    <div className="card card-hover group p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${GAME_BADGE[server.game]}`}
          >
            {server.game}
          </span>
          <div>
            <h3 className="font-display font-semibold text-white">{server.name}</h3>
            <p className="text-xs text-zinc-500">
              {server.region} · v{server.version}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cfg.pill}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${cfg.dot} animate-pulse-dot`}
          />
          {cfg.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Joueurs</span>
          <span>
            <span className="font-semibold text-zinc-200">
              {server.onlinePlayers}
            </span>{" "}
            / {server.maxPlayers}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-carbone-600">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rouge-500 to-rouge-400 transition-all"
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-white/5 bg-charbon-800/70 p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-carbone-500/60" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-carbone-500/60" />
                <div className="h-2.5 w-20 rounded bg-carbone-500/60" />
              </div>
            </div>
            <div className="h-5 w-24 rounded-full bg-carbone-500/60" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-2.5 w-full rounded bg-carbone-500/60" />
            <div className="h-1.5 w-full rounded bg-carbone-500/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
