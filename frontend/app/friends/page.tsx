"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  removeFriend,
  sendFriendRequest,
  type FriendsResponse,
} from "@/lib/friends";

function Avatar({ avatarUrl, username }: { avatarUrl: string | null; username: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-sm font-bold text-white">
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchFriends()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError("Impossible de charger vos amis."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [user, authLoading, load]);

  const add = async (name: string) => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendFriendRequest(name.trim());
      setUsername("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const accept = async (id: string) => {
    try {
      await acceptFriendRequest(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const decline = async (id: string) => {
    try {
      await declineFriendRequest(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const remove = async (friendId: string, name: string) => {
    if (!confirm(`Retirer ${name} de vos amis ?`)) return;
    try {
      await removeFriend(friendId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  if (!authLoading && !user) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">🤝</p>
          <h1 className="mt-4 text-xl font-bold text-white">Connectez-vous</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Connectez-vous pour gérer vos amis.
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
      <div className="relative mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
            Amis
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Votre réseau</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Ajoutez des joueurs, acceptez les demandes et retrouvez vos amis.
          </p>
        </div>

        {/* Ajouter un ami */}
        <div className="card p-5 backdrop-blur">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add(username);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Pseudo du joueur à ajouter…"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-rouge-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
            >
              {busy ? "…" : "Ajouter"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-rouge-400">{error}</p>}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            {/* Demandes reçues */}
            {data && data.incoming.length > 0 && (
              <div className="rounded-2xl border border-rouge-500/20 bg-rouge-500/5 p-5">
                <h2 className="text-lg font-semibold text-white">
                  Demandes reçues
                  <span className="ml-2 rounded-full bg-rouge-500 px-2 py-0.5 text-xs font-bold text-white">
                    {data.incoming.length}
                  </span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {data.incoming.map((request) => (
                    <li
                      key={request.id}
                      className="flex items-center justify-between gap-3 card rounded-xl px-3 py-2"
                    >
                      <Link
                        href={`/p/${encodeURIComponent(request.user.username)}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <Avatar
                          avatarUrl={request.user.avatarUrl}
                          username={request.user.username}
                        />
                        <span className="truncate text-sm font-medium text-white hover:text-rouge-300">
                          {request.user.username}
                        </span>
                      </Link>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => void accept(request.id)}
                          className="rounded-lg bg-rouge-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rouge-400"
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() => void decline(request.id)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                        >
                          Refuser
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mes amis */}
            <div className="card p-5 backdrop-blur">
              <h2 className="text-lg font-semibold text-white">
                Mes amis
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {data?.friends.length ?? 0}
                </span>
              </h2>
              {data && data.friends.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  Aucun ami pour le moment. Ajoutez des joueurs ci-dessus !
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-white/5">
                  {(data?.friends ?? []).map((friend) => (
                    <li key={friend.id} className="flex items-center justify-between gap-3 py-3">
                      <Link
                        href={`/p/${encodeURIComponent(friend.username)}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <Avatar avatarUrl={friend.avatarUrl} username={friend.username} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white hover:text-rouge-300">
                            {friend.username}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            Amis depuis le{" "}
                            {new Date(friend.since).toLocaleDateString("fr-FR")}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => void remove(friend.id, friend.username)}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Demandes envoyées */}
            {data && data.outgoing.length > 0 && (
              <div className="card p-5 backdrop-blur">
                <h2 className="text-lg font-semibold text-white">
                  Demandes envoyées
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {data.outgoing.length}
                  </span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {data.outgoing.map((request) => (
                    <li
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <span className="truncate text-sm font-medium text-white">
                        {request.user.username}
                      </span>
                      <span className="shrink-0 text-xs text-amber-400">En attente</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
