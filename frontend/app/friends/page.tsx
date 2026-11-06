"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function Avatar({
  avatarUrl,
  username,
  size = "h-10 w-10",
}: {
  avatarUrl: string | null;
  username: string;
  size?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-700 text-sm font-bold text-white`}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

function since(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">("friends");

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

  const friends = useMemo(() => {
    const list = data?.friends ?? [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((friend) => friend.username.toLowerCase().includes(q)) : list;
  }, [data, query]);

  if (!authLoading && !user) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">🤝</p>
          <h1 className="mt-4 text-xl font-bold text-white">Connectez-vous</h1>
          <p className="mt-2 text-sm text-zinc-400">Connectez-vous pour gérer vos amis.</p>
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
      <div className="relative mx-auto max-w-4xl space-y-6">
        <div>
          <p className="section-eyebrow">Amis</p>
          <h1 className="section-title mt-3">Votre réseau</h1>
          <p className="mt-3 text-sm text-zinc-400">
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
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Pseudo du joueur à ajouter…"
              className="input flex-1"
            />
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
              {busy ? "…" : "Ajouter"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-rouge-400">{error}</p>}
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-white">{data?.friends.length ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Amis</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{data?.incoming.length ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Demandes reçues</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-sky-400">{data?.outgoing.length ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Envoyées</p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex items-center rounded-xl border border-white/5 bg-charbon-900/60 p-1">
          {(
            [
              { id: "friends", label: `Amis (${data?.friends.length ?? 0})` },
              { id: "incoming", label: `Reçues (${data?.incoming.length ?? 0})` },
              { id: "outgoing", label: `Envoyées (${data?.outgoing.length ?? 0})` },
            ] as { id: "friends" | "incoming" | "outgoing"; label: string }[]
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

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : tab === "friends" ? (
          <>
            {(data?.friends.length ?? 0) > 3 && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un ami…"
                className="input"
              />
            )}
            {friends.length === 0 ? (
              <div className="card p-10 text-center backdrop-blur">
                <p className="text-4xl">🤝</p>
                <p className="mt-3 font-semibold text-white">
                  {(data?.friends.length ?? 0) === 0 ? "Aucun ami pour le moment" : "Aucun résultat"}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {(data?.friends.length ?? 0) === 0
                    ? "Ajoutez des joueurs avec leur pseudo."
                    : "Essayez un autre pseudo."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="card flex items-center gap-3 p-4">
                    <Avatar avatarUrl={friend.avatarUrl} username={friend.username} size="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/p/${encodeURIComponent(friend.username)}`}
                        className="block truncate text-sm font-semibold text-white hover:text-rouge-300"
                      >
                        {friend.username}
                      </Link>
                      <p className="text-xs text-zinc-500">Ami depuis le {since(friend.since)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(friend.id, friend.username)}
                      className="btn-ghost btn-sm shrink-0"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === "incoming" ? (
          (data?.incoming.length ?? 0) === 0 ? (
            <div className="card p-10 text-center backdrop-blur">
              <p className="text-4xl">📭</p>
              <p className="mt-3 font-semibold text-white">Aucune demande reçue</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.incoming ?? []).map((request) => (
                <div key={request.id} className="card flex items-center gap-3 p-4">
                  <Avatar
                    avatarUrl={request.user.avatarUrl}
                    username={request.user.username}
                    size="h-11 w-11"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/p/${encodeURIComponent(request.user.username)}`}
                      className="block truncate text-sm font-semibold text-white hover:text-rouge-300"
                    >
                      {request.user.username}
                    </Link>
                    <p className="text-xs text-zinc-500">Souhaite vous ajouter</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => void accept(request.id)} className="btn-primary btn-sm">
                      Accepter
                    </button>
                    <button type="button" onClick={() => void decline(request.id)} className="btn-ghost btn-sm">
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (data?.outgoing.length ?? 0) === 0 ? (
          <div className="card p-10 text-center backdrop-blur">
            <p className="text-4xl">📤</p>
            <p className="mt-3 font-semibold text-white">Aucune demande envoyée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.outgoing ?? []).map((request) => (
              <div key={request.id} className="card flex items-center gap-3 p-4">
                <Avatar
                  avatarUrl={request.user.avatarUrl}
                  username={request.user.username}
                  size="h-11 w-11"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{request.user.username}</p>
                  <p className="text-xs text-zinc-500">Demande en attente</p>
                </div>
                <span className="badge badge-warn shrink-0">En attente</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
