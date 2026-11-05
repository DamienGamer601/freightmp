"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  createVtc,
  fetchVtcs,
  joinVtc,
  leaveVtc,
  type VtcSummary,
} from "@/lib/vtcs";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function VtcsPage() {
  const { user, loading: authLoading, refetch } = useAuth();
  const [vtcs, setVtcs] = useState<VtcSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchVtcs()
      .then((data) => {
        setVtcs(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les VTC."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ownedVtcIds = new Set((user?.ownedVtcs ?? []).map((v) => v.id));
  const memberVtcIds = new Set((user?.affiliations ?? []).map((a) => a.vtcId));

  const join = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await joinVtc(id);
      await refetch();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  const leave = async (id: string) => {
    if (!confirm("Quitter cette VTC ?")) return;
    setBusyId(id);
    setError(null);
    try {
      await leaveVtc(id);
      await refetch();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
              Compagnies virtuelles
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">Les VTC de FreightMP</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Rejoins une compagnie existante ou crée la tienne pour rouler en
              équipe.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-xl bg-rouge-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rouge-400"
            >
              + Créer une VTC
            </button>
          )}
        </div>

        {error && <p className="text-sm text-rouge-400">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : vtcs.length === 0 ? (
          <div className="card p-8 text-center backdrop-blur">
            <p className="text-4xl">🏢</p>
            <p className="mt-3 text-sm text-zinc-400">
              Aucune VTC pour le moment. Sois le premier à en créer une !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vtcs.map((vtc) => {
              const isOwner = ownedVtcIds.has(vtc.id);
              const isMember = memberVtcIds.has(vtc.id);
              return (
                <article
                  key={vtc.id}
                  className="flex flex-col card p-5 backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/vtc/${vtc.id}`}
                        className="truncate text-lg font-semibold text-white hover:text-rouge-300"
                      >
                        {vtc.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Propriétaire : {vtc.ownerUsername}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-carbone-600 px-2 py-1 text-xs font-bold text-zinc-200">
                      {vtc.tag}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    {vtc.memberCount} membre{vtc.memberCount > 1 ? "s" : ""} · créée le{" "}
                    {formatDate(vtc.createdAt)}
                  </p>

                  <div className="mt-4 flex-1" />

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/vtc/${vtc.id}`}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm font-medium text-zinc-200 hover:bg-white/10"
                    >
                      Voir
                    </Link>
                    {authLoading ? null : isOwner ? (
                      <span className="rounded-lg border border-rouge-500/30 bg-rouge-500/10 px-3 py-2 text-xs font-semibold text-rouge-300">
                        Propriétaire
                      </span>
                    ) : isMember ? (
                      <button
                        type="button"
                        onClick={() => void leave(vtc.id)}
                        disabled={busyId === vtc.id}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                      >
                        Quitter
                      </button>
                    ) : user ? (
                      <button
                        type="button"
                        onClick={() => void join(vtc.id)}
                        disabled={busyId === vtc.id}
                        className="rounded-lg bg-rouge-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
                      >
                        Rejoindre
                      </button>
                    ) : (
                      <Link
                        href="/"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-white/10"
                        title="Connecte-toi pour rejoindre"
                      >
                        Rejoindre
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {creating && (
        <CreateVtcModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void refetch();
            load();
          }}
        />
      )}
    </section>
  );
}

function CreateVtcModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await createVtc({ name: name.trim(), tag: tag.trim() });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-charbon-800 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white">Créer une VTC</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Nom de la compagnie
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Nordic Haulers"
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Tag (max 8, unique)
            </span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ex. NORD"
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm uppercase text-white outline-none focus:border-white/30"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-rouge-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
          >
            {saving ? "…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
