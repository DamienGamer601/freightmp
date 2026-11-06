"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  createVtc,
  fetchVtcs,
  joinVtc,
  leaveVtc,
  type CreateVtcInput,
  type VtcSummary,
} from "@/lib/vtcs";

const REGIONS = [
  "France",
  "Belgique",
  "Suisse",
  "Canada",
  "Allemagne",
  "Espagne",
  "Italie",
  "Royaume-Uni",
  "Europe",
  "International",
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export default function VtcsPage() {
  const { user, loading: authLoading, refetch } = useAuth();
  const [vtcs, setVtcs] = useState<VtcSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [onlyRecruiting, setOnlyRecruiting] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vtcs.filter((vtc) => {
      if (q && !`${vtc.name} ${vtc.tag} ${vtc.description ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }
      if (regionFilter && vtc.region !== regionFilter) return false;
      if (onlyRecruiting && !vtc.recruiting) return false;
      return true;
    });
  }, [vtcs, query, regionFilter, onlyRecruiting]);

  const stats = useMemo(() => {
    const members = vtcs.reduce((sum, v) => sum + v.memberCount, 0);
    const recruiting = vtcs.filter((v) => v.recruiting).length;
    return { companies: vtcs.length, members, recruiting };
  }, [vtcs]);

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
        {/* En-tête */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-eyebrow">Compagnies virtuelles</p>
            <h1 className="section-title mt-3">Les VTC de FreightMP</h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400">
              Rejoins une compagnie existante ou crée la tienne pour rouler en équipe.
            </p>
          </div>
          {user && (
            <button type="button" onClick={() => setCreating(true)} className="btn-primary">
              + Créer une VTC
            </button>
          )}
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.companies}</p>
            <p className="mt-1 text-xs text-zinc-500">Compagnies</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.members}</p>
            <p className="mt-1 text-xs text-zinc-500">Membres</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.recruiting}</p>
            <p className="mt-1 text-xs text-zinc-500">Recrutent</p>
          </div>
        </div>

        {/* Recherche + filtres */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une VTC, un tag, une description…"
            className="input flex-1"
          />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">Toutes les régions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={onlyRecruiting}
              onChange={(e) => setOnlyRecruiting(e.target.checked)}
              className="h-4 w-4 accent-rouge-500"
            />
            Recrute
          </label>
        </div>

        {error && <p className="text-sm text-rouge-400">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-4xl">🏢</p>
            <p className="mt-3 font-semibold text-white">
              {vtcs.length === 0 ? "Aucune VTC pour le moment" : "Aucun résultat"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {vtcs.length === 0
                ? "Sois le premier à créer ta compagnie virtuelle."
                : "Essaie d'autres filtres ou une autre recherche."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((vtc) => {
              const isMember = memberVtcIds.has(vtc.id);
              const isOwner = ownedVtcIds.has(vtc.id);
              return (
                <div key={vtc.id} className="card card-hover overflow-hidden p-0">
                  {/* Bannière */}
                  <div className="relative h-20 bg-gradient-to-r from-rouge-600/40 via-charbon-800 to-charbon-900">
                    {vtc.bannerUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vtc.bannerUrl}
                        alt=""
                        className="h-full w-full object-cover opacity-70"
                      />
                    )}
                    {isMember && (
                      <span className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        {isOwner ? "Propriétaire" : "Membre"}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white">
                        {vtc.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vtc.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials(vtc.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/vtc/${vtc.id}`}
                          className="block truncate font-semibold text-white hover:text-rouge-300"
                        >
                          {vtc.name}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          [{vtc.tag}] · {vtc.memberCount} membre{vtc.memberCount > 1 ? "s" : ""}
                          {vtc.region ? ` · ${vtc.region}` : ""}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-zinc-400">
                      {vtc.description ?? "Aucune description."}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`badge ${vtc.recruiting ? "badge-ok" : ""}`}
                      >
                        {vtc.recruiting ? "Recrute" : "Complet"}
                      </span>
                      {isMember ? (
                        !isOwner && (
                          <button
                            type="button"
                            onClick={() => leave(vtc.id)}
                            disabled={busyId === vtc.id}
                            className="btn-ghost btn-sm"
                          >
                            Quitter
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => join(vtc.id)}
                          disabled={busyId === vtc.id || !user || !vtc.recruiting}
                          className="btn-primary btn-sm disabled:opacity-50"
                        >
                          {busyId === vtc.id ? "…" : "Rejoindre"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!user && !authLoading && (
          <p className="text-center text-sm text-zinc-500">
            Connecte-toi pour créer ou rejoindre une VTC.
          </p>
        )}
      </div>

      {creating && (
        <CreateVtcModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refetch();
            load();
          }}
        />
      )}
    </section>
  );
}

/* ---------- Modale de création ---------- */

function CreateVtcModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateVtcInput>({
    name: "",
    tag: "",
    description: "",
    logoUrl: "",
    bannerUrl: "",
    region: "",
    language: "Français",
    website: "",
    discordUrl: "",
    recruiting: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CreateVtcInput>(key: K, value: CreateVtcInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const canSubmit = form.name.trim().length >= 2 && form.tag.trim().length >= 1 && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await createVtc({
        ...form,
        name: form.name.trim(),
        tag: form.tag.trim().toUpperCase(),
        description: form.description?.trim() || null,
        logoUrl: form.logoUrl?.trim() || null,
        bannerUrl: form.bannerUrl?.trim() || null,
        region: form.region?.trim() || null,
        language: form.language?.trim() || null,
        website: form.website?.trim() || null,
        discordUrl: form.discordUrl?.trim() || null,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-charbon-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Créer une VTC</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Ta compagnie apparaîtra dans l&apos;annuaire avec son tag en jeu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Aperçu */}
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(form.name || "VTC")
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{form.name || "Nom de la VTC"}</p>
            <p className="text-xs text-zinc-500">
              [{form.tag ? form.tag.toUpperCase() : "TAG"}]
              {form.region ? ` · ${form.region}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="field sm:col-span-1">
            <span>Nom de la VTC *</span>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={60}
              placeholder="Ex. FR Industries"
              className="input"
            />
          </label>
          <label className="field">
            <span>Tag (2-8 caractères) *</span>
            <input
              value={form.tag}
              onChange={(e) => set("tag", e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="FIC"
              className="input uppercase"
            />
          </label>

          <label className="field sm:col-span-2">
            <span>Description</span>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Présente ta compagnie, ses valeurs, ses convois…"
              className="input resize-none"
            />
          </label>

          <label className="field">
            <span>URL du logo</span>
            <input
              value={form.logoUrl ?? ""}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://…"
              className="input"
            />
          </label>
          <label className="field">
            <span>URL de la bannière</span>
            <input
              value={form.bannerUrl ?? ""}
              onChange={(e) => set("bannerUrl", e.target.value)}
              placeholder="https://…"
              className="input"
            />
          </label>

          <label className="field">
            <span>Région</span>
            <select
              value={form.region ?? ""}
              onChange={(e) => set("region", e.target.value)}
              className="input"
            >
              <option value="">Non précisée</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Langue</span>
            <input
              value={form.language ?? ""}
              onChange={(e) => set("language", e.target.value)}
              placeholder="Français"
              className="input"
            />
          </label>

          <label className="field">
            <span>Site web</span>
            <input
              value={form.website ?? ""}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://…"
              className="input"
            />
          </label>
          <label className="field">
            <span>Discord</span>
            <input
              value={form.discordUrl ?? ""}
              onChange={(e) => set("discordUrl", e.target.value)}
              placeholder="https://discord.gg/…"
              className="input"
            />
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.recruiting ?? true}
              onChange={(e) => set("recruiting", e.target.checked)}
              className="h-4 w-4 accent-rouge-500"
            />
            <span className="text-sm text-zinc-300">Ma VTC recrute des membres</span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSubmit}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Création…" : "Créer la VTC"}
          </button>
        </div>
      </div>
    </div>
  );
}
