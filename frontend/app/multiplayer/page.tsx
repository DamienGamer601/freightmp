"use client";

import { useCallback, useEffect, useState } from "react";
import MpLiveMap from "@/components/MpLiveMap";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchMpRoom,
  fetchMpRooms,
  fetchMpToken,
  getMpWsUrl,
  type MpRoom,
  type MpRoomDetail,
} from "@/lib/multiplayer";

export default function MultiplayerPage() {
  const [rooms, setRooms] = useState<MpRoom[]>([]);
  const [details, setDetails] = useState<Record<string, MpRoomDetail>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const { user } = useAuth();
  const [mpToken, setMpToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchMpRooms();
      setRooms(list);
      setOffline(false);
      setLastUpdate(new Date().toISOString());

      const entries = await Promise.all(
        list.map(async (room) => {
          try {
            return [room.id, await fetchMpRoom(room.id)] as const;
          } catch {
            return null;
          }
        }),
      );
      const next: Record<string, MpRoomDetail> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setDetails(next);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 2500);
    return () => clearInterval(interval);
  }, [load]);

  const generateToken = async () => {
    setTokenLoading(true);
    setTokenError(null);
    try {
      const data = await fetchMpToken();
      setMpToken(data.token);
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToken = async () => {
    if (!mpToken) return;
    try {
      await navigator.clipboard.writeText(mpToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  const totalPlayers = rooms.reduce((sum, room) => sum + room.playerCount, 0);

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-eyebrow">Multijoueur</p>
            <h1 className="section-title mt-3">Salles de jeu</h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400">
              Serveur de jeu temps réel (UDP, 20 Hz). Les joueurs connectés via le
              client FreightMP apparaissent ici en direct.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                offline
                  ? "border-rouge-500/30 bg-rouge-500/10 text-rouge-400"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <span
                className={`relative flex h-2 w-2 ${
                  offline ? "bg-rouge-400" : "bg-emerald-400"
                } rounded-full`}
              />
              {offline ? "Serveur hors ligne" : "Serveur en ligne"}
            </span>
            {lastUpdate && !offline && (
              <span className="text-xs text-zinc-500">
                maj {new Date(lastUpdate).toLocaleTimeString("fr-FR")}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">{rooms.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">Salles</p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">{totalPlayers}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
              Joueurs connectés
            </p>
          </div>
          <div className="card p-5 backdrop-blur">
            <p className="text-2xl font-bold text-white">20 Hz</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
              Fréquence de tick
            </p>
          </div>
        </div>

        <MpLiveMap wsUrl={getMpWsUrl()} />

        {/* Comment rejoindre */}
        <div className="card p-6 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Comment rejoindre une partie</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                step: 1,
                title: "Génère ton jeton",
                text: "Clique sur « Générer mon jeton » ci-dessous et copie la valeur.",
              },
              {
                step: 2,
                title: "Lance le client",
                text: "Dans le dossier client : $env:MP_TOKEN=\"…\" ; npm run client",
              },
              {
                step: 3,
                title: "Roule à plusieurs",
                text: "Les autres joueurs de la salle apparaissent en direct sur la carte.",
              },
            ].map((item) => (
              <li key={item.step} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rouge-500 text-xs font-bold text-white">
                  {item.step}
                </span>
                <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {user && (
          <div className="card p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Mon jeton multijoueur
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Génère un jeton signé à coller dans{" "}
                  <code className="rounded bg-carbone-600 px-1.5 py-0.5 text-xs">
                    MP_TOKEN
                  </code>{" "}
                  pour rejoindre avec ton compte FreightMP (ton pseudo s&apos;affichera
                  dans la salle).
                </p>
              </div>
              <button
                type="button"
                onClick={() => void generateToken()}
                disabled={tokenLoading}
                className="rounded-lg bg-rouge-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
              >
                {tokenLoading ? "…" : mpToken ? "Régénérer" : "Générer mon jeton"}
              </button>
            </div>

            {tokenError && <p className="mt-3 text-sm text-rouge-400">{tokenError}</p>}

            {mpToken && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-xs text-zinc-300">
                    {mpToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyToken()}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
                  >
                    {copied ? "Copié ✓" : "Copier"}
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Valable 12 h. Côté client :{" "}
                  <code className="rounded bg-carbone-600 px-1.5 py-0.5">
                    $env:MP_TOKEN=&quot;…&quot;; npm run client
                  </code>
                </p>
              </div>
            )}
          </div>
        )}

        {offline ? (
          <div className="rounded-2xl border border-rouge-500/20 bg-rouge-500/5 p-6 text-center">
            <p className="text-4xl">📡</p>
            <p className="mt-3 text-sm text-zinc-300">
              Serveur multijoueur injoignable.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Lance-le avec <code className="rounded bg-carbone-600 px-1.5 py-0.5">cd mp-server &amp;&amp; npm run dev</code>
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="card p-8 text-center backdrop-blur">
            <p className="text-4xl">🎮</p>
            <p className="mt-3 text-sm text-zinc-400">Aucune salle pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => {
              const detail = details[room.id];
              return (
                <article
                  key={room.id}
                  className="card p-5 backdrop-blur"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">{room.name}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          room.game === "ATS"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-rouge-500/15 text-rouge-300"
                        }`}
                      >
                        {room.game}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-400">
                      <span className="font-semibold text-white">{room.playerCount}</span>
                      {" / "}
                      {room.maxPlayers} joueurs
                    </span>
                  </div>

                  {room.playerCount === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      Salle vide — connecte le client FreightMP pour la rejoindre.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-white/5">
                      {(detail?.players ?? []).map((player) => (
                        <li
                          key={player.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-[10px] font-bold text-white">
                              {(player.username ?? player.truckId).charAt(0).toUpperCase()}
                            </span>
                            {player.tag && (
                              <span className="rounded bg-carbone-600 px-1.5 py-0.5 text-[10px] font-bold text-zinc-200">
                                {player.tag}
                              </span>
                            )}
                            <span className="font-medium text-white">
                              {player.username ?? player.truckId}
                            </span>
                          </span>
                          <span className="flex gap-4 text-xs text-zinc-400">
                            <span>{player.ping ?? 0} ms</span>
                            <span>{Math.round(player.speed)} km/h</span>
                            <span>
                              {Math.round(player.x)}, {Math.round(player.z)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
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
