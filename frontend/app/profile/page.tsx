"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDiscordAuthUrl, getSteamAuthUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LinkedAccounts from "@/components/LinkedAccounts";
import {
  updateUsername,
  type Ban,
  type DeliveryItem,
  type MeResponse,
  type UserRole,
} from "@/lib/auth";
import {
  countryFlag,
  fetchDeliveries,
  updateProfile,
  type PaginatedDeliveries,
} from "@/lib/profile";

/* ---------- Constantes ---------- */

const roleBadgeClasses: Record<UserRole, string> = {
  ADMIN: "border-rouge-500/30 bg-rouge-500/15 text-rouge-400",
  DEV: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  MODERATOR: "border-sky-500/30 bg-sky-500/15 text-sky-400",
  DRIVER: "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrateur",
  DEV: "Développeur",
  MODERATOR: "Modérateur",
  DRIVER: "Conducteur",
};

const banTypeLabels: Record<string, string> = {
  WARNING: "Avertissement",
  TEMPORARY: "Temporaire",
  PERMANENT: "Permanent",
};

interface Accent {
  text: string;
  bg: string;
  bar: string;
  ring: string;
  gradient: string;
}

const COUNTRY_LIST = [
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
  { code: "CH", name: "Suisse" },
  { code: "LU", name: "Luxembourg" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "IT", name: "Italie" },
  { code: "NL", name: "Pays-Bas" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "US", name: "États-Unis" },
];

const ACCENTS: Record<string, Accent> = {
  rouge: {
    text: "text-rouge-400",
    bg: "bg-rouge-500",
    bar: "bg-gradient-to-r from-rouge-600 to-rouge-400",
    ring: "ring-rouge-500/50",
    gradient: "from-rouge-600/40 via-charbon-800 to-charbon-900",
  },
  sky: {
    text: "text-sky-400",
    bg: "bg-sky-500",
    bar: "bg-gradient-to-r from-sky-600 to-sky-400",
    ring: "ring-sky-500/50",
    gradient: "from-sky-600/40 via-charbon-800 to-charbon-900",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500",
    bar: "bg-gradient-to-r from-emerald-600 to-emerald-400",
    ring: "ring-emerald-500/50",
    gradient: "from-emerald-600/40 via-charbon-800 to-charbon-900",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500",
    bar: "bg-gradient-to-r from-amber-600 to-amber-400",
    ring: "ring-amber-500/50",
    gradient: "from-amber-600/40 via-charbon-800 to-charbon-900",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500",
    bar: "bg-gradient-to-r from-violet-600 to-violet-400",
    ring: "ring-violet-500/50",
    gradient: "from-violet-600/40 via-charbon-800 to-charbon-900",
  },
  zinc: {
    text: "text-zinc-400",
    bg: "bg-zinc-500",
    bar: "bg-gradient-to-r from-zinc-600 to-zinc-400",
    ring: "ring-zinc-500/50",
    gradient: "from-zinc-600/40 via-charbon-800 to-charbon-900",
  },
};

function accentFor(color: string | null | undefined): Accent {
  return ACCENTS[color ?? "rouge"] ?? ACCENTS.rouge;
}

/* ---------- Helpers ---------- */

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("fr-FR")} km`;
}

function formatMoney(amount: number, game: string | null): string {
  const symbol = game === "ATS" ? "$" : "€";
  return `${Math.round(amount).toLocaleString("fr-FR")} ${symbol}`;
}

function computeLevel(km: number, deliveries: number) {
  const xp = Math.round(km) + deliveries * 100;
  const level = Math.floor(xp / 1000) + 1;
  const xpInLevel = xp % 1000;
  return { xp, level, xpInLevel, xpToNext: 1000 - xpInLevel };
}

interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
}

function computeBadges(user: MeResponse): Badge[] {
  const ageYears =
    (Date.now() - new Date(user.createdAt).getTime()) / (365 * 24 * 3600 * 1000);
  return [
    {
      id: "first-delivery",
      label: "Première livraison",
      icon: "🚚",
      earned: user.stats.deliveriesCompleted >= 1,
    },
    {
      id: "km-1000",
      label: "1 000 km",
      icon: "🛣️",
      earned: user.stats.kilometersDriven >= 1000,
    },
    {
      id: "km-10000",
      label: "10 000 km",
      icon: "🏔️",
      earned: user.stats.kilometersDriven >= 10000,
    },
    {
      id: "centurion",
      label: "Centurion (100 livr.)",
      icon: "💯",
      earned: user.stats.deliveriesCompleted >= 100,
    },
    {
      id: "veteran",
      label: "Vétéran (1 an)",
      icon: "🎖️",
      earned: ageYears >= 1,
    },
    {
      id: "team",
      label: "Équipe FMP",
      icon: "🛡️",
      earned:
        user.role === "ADMIN" || user.role === "DEV" || user.role === "MODERATOR",
    },
  ];
}

function computeWeeklyActivity(deliveries: DeliveryItem[]) {
  const weeks: { label: string; km: number }[] = [];
  const now = Date.now();
  for (let w = 5; w >= 0; w -= 1) {
    const end = now - w * 7 * 24 * 3600 * 1000;
    const start = end - 7 * 24 * 3600 * 1000;
    const km = deliveries
      .filter((d) => {
        const t = new Date(d.completedAt ?? d.startedAt).getTime();
        return t >= start && t < end;
      })
      .reduce((sum, d) => sum + d.distanceKm, 0);
    weeks.push({ label: w === 0 ? "Cette sem." : `S-${w}`, km });
  }
  return weeks;
}

function computeSplit(deliveries: DeliveryItem[]) {
  let ets2 = 0;
  let ats = 0;
  for (const d of deliveries) {
    if (d.server?.game === "ATS") ats += d.distanceKm;
    else if (d.server?.game === "ETS2") ets2 += d.distanceKm;
  }
  const total = ets2 + ats;
  return {
    ets2,
    ats,
    ets2Pct: total > 0 ? Math.round((ets2 / total) * 100) : 0,
    atsPct: total > 0 ? Math.round((ats / total) * 100) : 0,
  };
}

/* ---------- Page ---------- */

export default function ProfilePage() {
  const { user, loading, logout, refetch } = useAuth();

  if (loading) return <ProfileSkeleton />;
  if (!user) return <SignedOut />;

  return (
    <ProfileContent user={user} onLogout={() => void logout()} onRefresh={refetch} />
  );
}

function SignedOut() {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-20">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
        <h1 className="text-xl font-bold text-white">
          Connectez-vous pour accéder à votre profil
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Connectez-vous avec Steam ou Discord pour consulter vos statistiques,
          vos livraisons, vos badges et votre historique.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={getSteamAuthUrl()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-rouge-500/50 hover:bg-white/10 hover:text-white"
          >
            <SteamIcon className="h-4 w-4" />
            Steam
          </a>
          <a
            href={getDiscordAuthUrl()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
          >
            <DiscordIcon className="h-4 w-4" />
            Discord
          </a>
        </div>
      </div>
    </section>
  );
}

function ProfileContent({
  user,
  onLogout,
  onRefresh,
}: {
  user: MeResponse;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftUsername, setDraftUsername] = useState(user.username);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const accent = accentFor(user.accentColor);
  const level = computeLevel(
    user.stats.kilometersDriven,
    user.stats.deliveriesCompleted,
  );
  const badges = computeBadges(user);
  const activity = computeWeeklyActivity(user.deliveries);
  const split = computeSplit(user.deliveries);
  const activeBans = user.bans.filter((ban) => ban.active);
  const avgKm =
    user.stats.deliveriesCompleted > 0
      ? user.stats.kilometersDriven / user.stats.deliveriesCompleted
      : 0;

  const saveUsername = useCallback(async () => {
    const next = draftUsername.trim();
    if (next.length < 3) {
      setNameError("Le pseudo doit contenir au moins 3 caractères.");
      return;
    }
    if (next === user.username) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await updateUsername(next);
      await onRefresh();
      setEditingName(false);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setSavingName(false);
    }
  }, [draftUsername, user.username, onRefresh]);

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {editing && (
        <EditProfileModal
          user={user}
          onClose={() => setEditing(false)}
          onSaved={onRefresh}
        />
      )}

      <div className="relative mx-auto max-w-5xl space-y-6">
        {/* ---- Bannière + en-tête ---- */}
        <div className="overflow-hidden card backdrop-blur">
          <div
            className={`relative h-32 w-full bg-gradient-to-br ${accent.gradient}`}
          >
            {user.bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.bannerUrl}
                alt="Bannière de profil"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="relative px-6 pb-6 sm:px-8">
            {/* Avatar + actions (l'avatar chevauche la bannière) */}
            <div className="-mt-12 flex items-end justify-between gap-3">
              <ProfileAvatar
                user={user}
                className="h-24 w-24 text-4xl ring-4 ring-charbon-800"
              />
              <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
                <Link
                  href={`/p/${encodeURIComponent(user.username)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
                >
                  <ShareIcon className="h-4 w-4" />
                  Profil public
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
                >
                  <EditIcon className="h-4 w-4" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 hover:border-rouge-500/50 hover:bg-white/10 hover:text-white"
                >
                  <LogoutIcon className="h-4 w-4" />
                  Déconnexion
                </button>
              </div>
            </div>

            {/* Pseudo + titre + rôle (sous l'avatar) */}
            <div className="mt-4">
              {editingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draftUsername}
                    onChange={(e) => setDraftUsername(e.target.value)}
                    maxLength={32}
                    className="w-48 rounded-lg border border-white/10 bg-charbon-900 px-3 py-1.5 text-lg font-bold text-white outline-none focus:border-white/30"
                    aria-label="Nouveau pseudo"
                  />
                  <button
                    type="button"
                    onClick={() => void saveUsername()}
                    disabled={savingName}
                    className={`rounded-lg ${accent.bg} px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50`}
                  >
                    {savingName ? "…" : "OK"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setNameError(null);
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-2xl font-bold text-white">
                    {user.username}
                  </h1>
                  {user.country && (
                    <span className="text-xl" title={user.country}>
                      {countryFlag(user.country)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDraftUsername(user.username);
                      setNameError(null);
                      setEditingName(true);
                    }}
                    title="Modifier le pseudo"
                    className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {user.title && (
                <p className={`mt-0.5 text-sm font-medium ${accent.text}`}>
                  {user.title}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClasses[user.role]}`}
                >
                  {roleLabels[user.role]}
                </span>
                <span className="text-xs text-zinc-500">
                  Membre depuis {formatDate(user.createdAt)}
                </span>
              </div>

              {nameError && (
                <p className="mt-1 text-xs text-rouge-400">{nameError}</p>
              )}
            </div>

            {user.bio && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
                {user.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <AccountBadge
                linked={Boolean(user.steamId)}
                label="Steam"
                icon={<SteamIcon className="h-3.5 w-3.5" />}
              />
              <AccountBadge
                linked={Boolean(user.discordId)}
                label="Discord"
                icon={<DiscordIcon className="h-3.5 w-3.5" />}
              />
            </div>
          </div>
        </div>

        {/* ---- Niveau / XP ---- */}
        <div className="card p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent.bg} text-lg font-black text-white`}
              >
                {level.level}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Niveau {level.level}
                </p>
                <p className="text-xs text-zinc-500">
                  {level.xp.toLocaleString("fr-FR")} XP · encore{" "}
                  <span className={accent.text}>{level.xpToNext}</span> XP avant le
                  niveau {level.level + 1}
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              XP = km parcourus + 100 × livraisons
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-carbone-600">
            <div
              className={`h-full rounded-full transition-all ${accent.bar}`}
              style={{ width: `${Math.min(100, (level.xpInLevel / 1000) * 100)}%` }}
            />
          </div>
        </div>

        {/* ---- Stats ---- */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Kilomètres" value={formatKm(user.stats.kilometersDriven)} icon={<RouteIcon className="h-5 w-5" />} />
          <StatCard label="Livraisons" value={user.stats.deliveriesCompleted.toLocaleString("fr-FR")} icon={<TruckIcon className="h-5 w-5" />} />
          <StatCard label="Temps de jeu" value={formatPlayTime(user.stats.totalPlayTimeSeconds)} icon={<ClockIcon className="h-5 w-5" />} />
          <StatCard label="Moy. / livraison" value={avgKm > 0 ? formatKm(avgKm) : "—"} icon={<ChartIcon className="h-5 w-5" />} />
        </div>

        {/* ---- Badges ---- */}
        <SectionCard title="Badges">
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.id}
                title={badge.label}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  badge.earned
                    ? "border-white/10 bg-white/5 text-zinc-200"
                    : "border-white/5 bg-transparent text-zinc-600 opacity-60"
                }`}
              >
                <span className="text-lg">{badge.icon}</span>
                <span className="font-medium">{badge.label}</span>
              </span>
            ))}
          </div>
        </SectionCard>

        {/* ---- Activité + répartition ---- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Activité (6 dernières semaines)">
            <ActivityChart data={activity} barClass={accent.bar} />
          </SectionCard>
          <SectionCard title="Répartition ETS2 / ATS">
            <GameSplit split={split} />
          </SectionCard>
        </div>

        {/* ---- Livraisons (paginées) ---- */}
        <DeliveriesList />

        {/* ---- VTC + Sanctions ---- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Compagnies virtuelles (VTC)">
            {user.affiliations.length === 0 && user.ownedVtcs.length === 0 ? (
              <EmptyState text="Aucune affiliation VTC." />
            ) : (
              <ul className="space-y-3">
                {user.ownedVtcs.map((vtc) => (
                  <li
                    key={`owner-${vtc.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-rouge-500/20 bg-rouge-500/5 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/vtc/${vtc.id}`}
                        className="block truncate text-sm font-medium text-white hover:text-rouge-300"
                      >
                        {vtc.name}
                      </Link>
                      <p className="text-xs text-zinc-400">
                        Propriétaire · {vtc.memberCount} membre{vtc.memberCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-carbone-600 px-2 py-1 text-xs font-semibold text-zinc-200">
                      {vtc.tag}
                    </span>
                  </li>
                ))}
                {user.affiliations.map((affiliation) => (
                  <li
                    key={affiliation.vtcId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/vtc/${affiliation.vtcId}`}
                        className="block truncate text-sm font-medium text-white hover:text-rouge-300"
                      >
                        {affiliation.name}
                      </Link>
                      <p className="text-xs text-zinc-400">
                        {affiliation.role} · depuis {formatDate(affiliation.joinedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-carbone-600 px-2 py-1 text-xs font-semibold text-zinc-200">
                      {affiliation.tag}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Historique des sanctions"
            badge={activeBans.length > 0 ? `${activeBans.length} active(s)` : undefined}
            badgeClass="border-rouge-500/30 bg-rouge-500/15 text-rouge-400"
          >
            {user.bans.length === 0 ? (
              <EmptyState text="Aucune sanction. Bonne route ! 🚚" />
            ) : (
              <ul className="space-y-3">
                {user.bans.map((ban) => (
                  <BanItem key={ban.id} ban={ban} />
                ))}
              </ul>
            )}
          </SectionCard>

          <LinkedAccounts
            steamId={user.steamId}
            discordId={user.discordId}
            onChanged={() => window.location.reload()}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- Modale d'édition ---------- */

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: MeResponse;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [bio, setBio] = useState(user.bio ?? "");
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl ?? "");
  const [title, setTitle] = useState(user.title ?? "");
  const [accentColor, setAccentColor] = useState(user.accentColor ?? "rouge");
  const [country, setCountry] = useState(user.country ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        bio: bio.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        title: title.trim() || null,
        accentColor,
        country: country || null,
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-charbon-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Modifier mon profil</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:text-white"
            aria-label="Fermer"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Bannière (URL d'image)">
            <input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Titre affiché (max 40)">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder="ex. Roi de la route"
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Bio (max 160)">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Quelques mots sur toi…"
              className="w-full resize-none rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Pays">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="">— Non défini —</option>
              {COUNTRY_LIST.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Couleur d'accent">
            <div className="flex flex-wrap gap-2">
              {Object.keys(ACCENTS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAccentColor(key)}
                  title={key}
                  className={`h-8 w-8 rounded-full ${ACCENTS[key].bg} ${
                    accentColor === key
                      ? "ring-2 ring-white ring-offset-2 ring-offset-charbon-800"
                      : "opacity-70 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </Field>
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
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ---------- Livraisons paginées ---------- */

function DeliveriesList() {
  const [page, setPage] = useState(1);
  const [game, setGame] = useState<"" | "ETS2" | "ATS">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<PaginatedDeliveries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDeliveries({ page, limit: 10, game, search })
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Impossible de charger les livraisons.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, game, search]);

  return (
    <SectionCard
      title="Toutes les livraisons"
      badge={data ? `${data.total}` : undefined}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-white/10 bg-charbon-900 p-0.5">
          {(["", "ETS2", "ATS"] as const).map((value) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => {
                setGame(value);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                game === value ? "bg-rouge-500 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {value || "Tous"}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
          className="flex flex-1 items-center gap-2"
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher (cargaison, ville…)"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
          <button
            type="submit"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
          >
            Chercher
          </button>
        </form>
      </div>

      {error && <p className="py-2 text-sm text-rouge-400">{error}</p>}

      {!error && loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      )}

      {!error && data && data.deliveries.length === 0 && (
        <EmptyState text="Aucune livraison ne correspond aux filtres." />
      )}

      {!error && data && data.deliveries.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 pb-2 font-medium">Date</th>
                  <th className="px-2 pb-2 font-medium">Cargaison</th>
                  <th className="px-2 pb-2 font-medium">Trajet</th>
                  <th className="px-2 pb-2 text-right font-medium">Distance</th>
                  <th className="px-2 pb-2 text-right font-medium">Revenu</th>
                  <th className="px-2 pb-2 text-right font-medium">Jeu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.deliveries.map((delivery) => (
                  <DeliveryRow key={delivery.id} delivery={delivery} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
            <span>
              Page {data.page} / {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ---------- Graphiques ---------- */

function ActivityChart({ data, barClass }: { data: { label: string; km: number }[]; barClass: string }) {
  const max = Math.max(1, ...data.map((d) => d.km));
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((week) => (
        <div key={week.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-32 w-full items-end">
            <div
              className={`w-full rounded-t-md ${barClass}`}
              style={{ height: `${Math.max(4, (week.km / max) * 100)}%` }}
              title={`${week.km} km`}
            />
          </div>
          <span className="text-[10px] text-zinc-500">{week.label}</span>
        </div>
      ))}
    </div>
  );
}

function GameSplit({
  split,
}: {
  split: { ets2: number; ats: number; ets2Pct: number; atsPct: number };
}) {
  const total = split.ets2 + split.ats;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-carbone-600">
        {total > 0 ? (
          <>
            <div className="h-full bg-rouge-500" style={{ width: `${split.ets2Pct}%` }} />
            <div className="h-full bg-amber-500" style={{ width: `${split.atsPct}%` }} />
          </>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="flex items-center gap-2 text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-rouge-500" />
            ETS2
          </p>
          <p className="mt-1 font-semibold text-white">{formatKm(split.ets2)}</p>
          <p className="text-xs text-zinc-500">{split.ets2Pct}%</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            ATS
          </p>
          <p className="mt-1 font-semibold text-white">{formatKm(split.ats)}</p>
          <p className="text-xs text-zinc-500">{split.atsPct}%</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sous-composants ---------- */

function DeliveryRow({ delivery }: { delivery: DeliveryItem }) {
  return (
    <tr className="text-zinc-300">
      <td className="whitespace-nowrap px-2 py-3 text-zinc-400">
        {formatDateTime(delivery.completedAt ?? delivery.startedAt)}
      </td>
      <td className="px-2 py-3 font-medium text-white">{delivery.cargoName}</td>
      <td className="px-2 py-3 text-zinc-400">
        {delivery.fromCity} → {delivery.toCity}
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-right">
        {Math.round(delivery.distanceKm).toLocaleString("fr-FR")} km
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-right text-emerald-400">
        {formatMoney(delivery.income, delivery.server?.game ?? null)}
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-right">
        {delivery.server ? (
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              delivery.server.game === "ATS"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-rouge-500/15 text-rouge-300"
            }`}
          >
            {delivery.server.game}
          </span>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function BanItem({ ban }: { ban: Ban }) {
  return (
    <li
      className={`rounded-xl border px-4 py-3 ${
        ban.active ? "border-rouge-500/25 bg-rouge-500/5" : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${ban.active ? "text-rouge-400" : "text-zinc-400"}`}>
          {banTypeLabels[ban.type] ?? ban.type}
          {ban.active && (
            <span className="ml-2 rounded-full bg-rouge-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rouge-400">
              active
            </span>
          )}
        </p>
        <span className="text-xs text-zinc-500">
          {ban.active
            ? ban.expiresAt
              ? `Expire le ${formatDate(ban.expiresAt)}`
              : "Permanente"
            : `Levée le ${formatDate(ban.createdAt)}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-300">{ban.reason}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Émise par {ban.issuer?.username ?? "inconnu"} · {formatDate(ban.createdAt)}
      </p>
    </li>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-rouge-400">{icon}</div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function SectionCard({
  title,
  badge,
  badgeClass,
  children,
}: {
  title: string;
  badge?: string;
  badgeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 backdrop-blur">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {badge && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              badgeClass ?? "border-white/10 bg-white/5 text-zinc-400"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-2 text-sm text-zinc-500">{text}</p>;
}

function AccountBadge({
  linked,
  label,
  icon,
}: {
  linked: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
        linked
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-zinc-500"
      }`}
      title={linked ? `${label} lié` : `${label} non lié`}
    >
      {icon}
      <span>{label}</span>
      <span className="text-zinc-500">{linked ? "✓" : "✕"}</span>
    </span>
  );
}

function ProfileAvatar({ user, className }: { user: MeResponse; className?: string }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={`Avatar de ${user.username}`}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white/10 ${className ?? ""}`}
      />
    );
  }
  const initial = user.username.charAt(0).toUpperCase();
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 font-bold text-white ring-2 ring-white/10 ${className ?? ""}`}
    >
      {initial}
    </span>
  );
}

function ProfileSkeleton() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    </section>
  );
}

/* ---------- Icônes ---------- */

function EditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l3-3-3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6.75a2.25 2.25 0 0 1 2.25 2.25v6a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-6A2.25 2.25 0 0 1 6 6.75h12ZM12 3v3.75M9 9h6" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17.25V21h17.25M7.5 17.25V12M12 17.25V7.5M16.5 17.25V3" />
    </svg>
  );
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h9a5.5 5.5 0 0 1 5.5 5.5v.5a2.5 2.5 0 0 1-2.5 2.5h-1.25a2.5 2.5 0 0 1-2.25-1.38l-.2-.4a2.5 2.5 0 0 0-2.24-1.32h-2.12a2.5 2.5 0 0 0-2.24 1.32l-.2.4A2.5 2.5 0 0 1 6.25 16H5a2.5 2.5 0 0 1-2.5-2.5V13a5.5 5.5 0 0 1 5-5.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5v3M6.5 12h3" />
      <circle cx="16" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}
