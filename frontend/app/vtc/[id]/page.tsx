"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  addVtcMember,
  deleteVtc,
  fetchVtcDetail,
  joinVtc,
  leaveVtc,
  removeVtcMember,
  updateVtc,
  updateVtcMemberRole,
  type VtcDetail,
  type VtcMemberRole,
} from "@/lib/vtcs";

const ROLE_LABELS: Record<VtcMemberRole, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Manager",
  MEMBER: "Membre",
};

const ROLE_BADGE: Record<VtcMemberRole, string> = {
  OWNER: "border-rouge-500/30 bg-rouge-500/15 text-rouge-400",
  MANAGER: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  MEMBER: "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function VtcDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const router = useRouter();
  const { user, refetch } = useAuth();
  const [vtc, setVtc] = useState<VtcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchVtcDetail(id)
      .then((data) => {
        setVtc(data);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = Boolean(user && vtc && vtc.ownerId === user.id);
  const isMember = Boolean(
    user && vtc && vtc.members.some((m) => m.userId === user.id),
  );
  const myRole = vtc?.members.find((m) => m.userId === user?.id)?.role;
  const canManage = Boolean(
    user && vtc && (vtc.ownerId === user.id || myRole === "MANAGER"),
  );

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinVtc(id);
      await refetch();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!confirm("Quitter cette VTC ?")) return;
    setBusy(true);
    setError(null);
    try {
      await leaveVtc(id);
      await refetch();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </section>
    );
  }

  if (notFound || !vtc) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">🏢</p>
          <h1 className="mt-4 text-xl font-bold text-white">VTC introuvable</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Cette compagnie n&apos;existe pas ou a été supprimée.
          </p>
          <Link
            href="/vtcs"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-rouge-500 px-6 py-3 text-sm font-semibold text-white hover:bg-rouge-400"
          >
            Voir toutes les VTC
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl space-y-6">
        <Link
          href="/vtcs"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          ← Toutes les VTC
        </Link>

        {/* En-tête */}
        <div className="card overflow-hidden p-0 backdrop-blur">
          {/* Bannière */}
          <div className="relative h-32 bg-gradient-to-r from-rouge-600/40 via-charbon-800 to-charbon-900">
            {vtc.bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vtc.bannerUrl} alt="" className="h-full w-full object-cover opacity-70" />
            )}
          </div>

          <div className="p-6">
            <div className="-mt-16 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-charbon-900 text-xl font-bold text-white shadow-xl">
                  {vtc.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vtc.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    vtc.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-bold text-white">{vtc.name}</h1>
                    <span className="rounded-md bg-carbone-600 px-2 py-1 text-xs font-bold text-zinc-200">
                      {vtc.tag}
                    </span>
                    <span className={`badge ${vtc.recruiting ? "badge-ok" : ""}`}>
                      {vtc.recruiting ? "Recrute" : "Complet"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    Propriétaire :{" "}
                    <span className="font-medium text-white">{vtc.ownerUsername}</span>
                    {vtc.region ? ` · ${vtc.region}` : ""}
                    {vtc.language ? ` · ${vtc.language}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isOwner ? (
                  <span className="rounded-lg border border-rouge-500/30 bg-rouge-500/10 px-3 py-2 text-xs font-semibold text-rouge-300">
                    Propriétaire
                  </span>
                ) : isMember ? (
                  <button
                    type="button"
                    onClick={() => void leave()}
                    disabled={busy}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                  >
                    Quitter
                  </button>
                ) : user ? (
                  <button
                    type="button"
                    onClick={() => void join()}
                    disabled={busy}
                    className="rounded-lg bg-rouge-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
                  >
                    Rejoindre
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-white/10"
                  >
                    Rejoindre
                  </Link>
                )}
              </div>
            </div>

            {vtc.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                {vtc.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
              <span>
                {vtc.members.length} membre{vtc.members.length > 1 ? "s" : ""}
              </span>
              <span>Créée le {formatDate(vtc.createdAt)}</span>
              {vtc.website && (
                <a
                  href={vtc.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rouge-300 hover:text-rouge-200"
                >
                  Site web ↗
                </a>
              )}
              {vtc.discordUrl && (
                <a
                  href={vtc.discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:text-indigo-200"
                >
                  Discord ↗
                </a>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}
          </div>
        </div>

        {/* Membres */}
        <div className="card p-6 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Membres</h2>
          {vtc.members.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Aucun membre.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {vtc.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-sm font-bold text-white">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/p/${encodeURIComponent(member.username)}`}
                        className="truncate text-sm font-medium text-white hover:text-rouge-300"
                      >
                        {member.username}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        Depuis le {formatDate(member.joinedAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[member.role]}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage && (
          <VtcManagePanel
            vtc={vtc}
            onChanged={load}
            onDeleted={() => router.push("/vtcs")}
          />
        )}
      </div>
    </section>
  );
}

/* ---------- Panneau de gestion (propriétaire / manager) ---------- */

function VtcManagePanel({
  vtc,
  onChanged,
  onDeleted,
}: {
  vtc: VtcDetail;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(vtc.name);
  const [memberName, setMemberName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    if (!name.trim() || name.trim() === vtc.name) return;
    setBusy(true);
    setError(null);
    try {
      await updateVtc(vtc.id, { name: name.trim() });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!memberName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addVtcMember(vtc.id, { username: memberName.trim() });
      setMemberName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, role: VtcMemberRole) => {
    setError(null);
    try {
      await updateVtcMemberRole(vtc.id, userId, role as "MANAGER" | "MEMBER");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const removeMember = async (userId: string, username: string) => {
    if (!confirm(`Retirer ${username} de la VTC ?`)) return;
    setError(null);
    try {
      await removeVtcMember(vtc.id, userId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const removeVtc = async () => {
    if (!confirm(`Supprimer définitivement la VTC ${vtc.name} ?`)) return;
    setError(null);
    try {
      await deleteVtc(vtc.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <div className="card p-6 backdrop-blur">
      <h2 className="text-lg font-semibold text-white">Gérer la VTC</h2>

      {error && <p className="mt-2 text-sm text-rouge-400">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Nom de la compagnie
          </span>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => void saveName()}
              disabled={busy}
              className="rounded-lg bg-rouge-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ajouter un membre (pseudo)
          </span>
          <div className="flex gap-2">
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Pseudo…"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </label>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Membres
        </p>
        <ul className="mt-2 space-y-2">
          {vtc.members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm font-medium text-white">
                {member.username}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {member.userId === vtc.ownerId ? (
                  <span className="text-xs font-semibold text-rouge-400">
                    Propriétaire
                  </span>
                ) : (
                  <>
                    <select
                      value={member.role === "OWNER" ? "MEMBER" : member.role}
                      onChange={(e) =>
                        void changeRole(member.userId, e.target.value as VtcMemberRole)
                      }
                      className="rounded-lg border border-white/10 bg-charbon-900 px-2 py-1 text-xs text-white outline-none"
                    >
                      <option value="MANAGER">Manager</option>
                      <option value="MEMBER">Membre</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void removeMember(member.userId, member.username)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                    >
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => void removeVtc()}
          className="rounded-lg border border-rouge-500/30 bg-rouge-500/10 px-3 py-2 text-sm font-semibold text-rouge-300 hover:bg-rouge-500/20"
        >
          Supprimer la VTC
        </button>
      </div>
    </div>
  );
}
