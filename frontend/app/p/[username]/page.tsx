"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { countryFlag, fetchPublicProfile, type PublicProfile } from "@/lib/profile";
import type { DeliveryItem, UserRole } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchFriendshipStatus,
  sendFriendRequest,
  type FriendStatus,
} from "@/lib/friends";

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

const ACCENT_BG: Record<string, string> = {
  rouge: "from-rouge-600/40",
  sky: "from-sky-600/40",
  emerald: "from-emerald-600/40",
  amber: "from-amber-600/40",
  violet: "from-violet-600/40",
  zinc: "from-zinc-600/40",
};

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

function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("fr-FR")} km`;
}

function formatMoney(amount: number, game: string | null): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} ${game === "ATS" ? "$" : "€"}`;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "");
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [friendship, setFriendship] = useState<FriendStatus | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetchPublicProfile(username)
      .then((result) => {
        if (!active) return;
        if (result) setProfile(result);
        else setNotFound(true);
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => {
    if (!user || user.username === username) {
      setFriendship(null);
      return;
    }
    let active = true;
    fetchFriendshipStatus(username)
      .then((data) => {
        if (active) setFriendship(data.status);
      })
      .catch(() => {
        if (active) setFriendship(null);
      });
    return () => {
      active = false;
    };
  }, [user, username]);

  const addFriend = async () => {
    setFriendBusy(true);
    setFriendError(null);
    try {
      await sendFriendRequest(username);
      setFriendship("OUTGOING");
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setFriendBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (notFound || !profile) {
    return (
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
        <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
          <p className="text-5xl">🔍</p>
          <h1 className="mt-4 text-xl font-bold text-white">Profil introuvable</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Aucun joueur ne porte ce pseudo sur FreightMP.
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

  const accent = ACCENT_BG[profile.accentColor ?? "rouge"] ?? ACCENT_BG.rouge;
  const xp = Math.round(profile.stats.kilometersDriven) + profile.stats.deliveriesCompleted * 100;
  const level = Math.floor(xp / 1000) + 1;
  const xpInLevel = xp % 1000;

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl space-y-6">
        {/* Bannière + en-tête */}
        <div className="overflow-hidden card backdrop-blur">
          <div className={`relative h-32 w-full bg-gradient-to-br ${accent} via-charbon-800 to-charbon-900`}>
            {profile.bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="relative px-6 pb-6 sm:px-8">
            {/* Avatar (chevauche la bannière) */}
            <div className="-mt-12">
              <Avatar profile={profile} />
            </div>

            {/* Pseudo + titre + rôle */}
            <div className="mt-4">
              <h1 className="truncate text-2xl font-bold text-white">
                {profile.username}
              </h1>
              {profile.country && (
                <span className="text-xl" title={profile.country}>
                  {countryFlag(profile.country)}
                </span>
              )}
              {profile.title && (
                <p className="mt-0.5 text-sm font-medium text-rouge-400">{profile.title}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClasses[profile.role]}`}
                >
                  {roleLabels[profile.role]}
                </span>
                <span className="text-xs text-zinc-500">
                  Membre depuis {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>

            {profile.bio && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
                {profile.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LinkBadge
                linked={profile.linkedAccounts.steam}
                label="Steam"
              />
              <LinkBadge
                linked={profile.linkedAccounts.discord}
                label="Discord"
              />
              {user && user.username !== profile.username && friendship && (
                <>
                  {friendship === "FRIENDS" ? (
                    <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                      ✓ Amis
                    </span>
                  ) : friendship === "OUTGOING" ? (
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
                      Demande envoyée
                    </span>
                  ) : friendship === "INCOMING" ? (
                    <Link
                      href="/friends"
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                    >
                      Demande reçue → Répondre
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void addFriend()}
                      disabled={friendBusy}
                      className="rounded-lg bg-rouge-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
                    >
                      {friendBusy ? "…" : "Ajouter en ami"}
                    </button>
                  )}
                  {friendError && (
                    <span className="text-xs text-rouge-400">{friendError}</span>
                  )}
                </>
              )}
              {user && user.username !== profile.username && (
                <Link
                  href={`/messages/${encodeURIComponent(profile.username)}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                >
                  💬 Message
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Niveau */}
        <div className="card p-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rouge-500 text-lg font-black text-white">
              {level}
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Niveau {level}</p>
              <p className="text-xs text-zinc-500">{xp.toLocaleString("fr-FR")} XP</p>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-carbone-600">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rouge-600 to-rouge-400"
              style={{ width: `${Math.min(100, (xpInLevel / 1000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Kilomètres" value={formatKm(profile.stats.kilometersDriven)} />
          <Stat label="Livraisons" value={profile.stats.deliveriesCompleted.toLocaleString("fr-FR")} />
          <Stat label="Temps de jeu" value={formatPlayTime(profile.stats.totalPlayTimeSeconds)} />
          <Stat
            label="Moy. / livraison"
            value={
              profile.stats.deliveriesCompleted > 0
                ? formatKm(profile.stats.kilometersDriven / profile.stats.deliveriesCompleted)
                : "—"
            }
          />
        </div>

        {/* Livraisons récentes */}
        <div className="card p-6 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Livraisons récentes</h2>
          {profile.deliveries.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Aucune livraison publique.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-2 pb-2 font-medium">Date</th>
                    <th className="px-2 pb-2 font-medium">Cargaison</th>
                    <th className="px-2 pb-2 font-medium">Trajet</th>
                    <th className="px-2 pb-2 text-right font-medium">Distance</th>
                    <th className="px-2 pb-2 text-right font-medium">Jeu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {profile.deliveries.map((delivery) => (
                    <tr key={delivery.id} className="text-zinc-300">
                      <td className="whitespace-nowrap px-2 py-3 text-zinc-400">
                        {formatDate(delivery.completedAt ?? delivery.startedAt)}
                      </td>
                      <td className="px-2 py-3 font-medium text-white">{delivery.cargoName}</td>
                      <td className="px-2 py-3 text-zinc-400">
                        {delivery.fromCity} → {delivery.toCity}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right">
                        {Math.round(delivery.distanceKm).toLocaleString("fr-FR")} km
                      </td>
                      <td className="px-2 py-3 text-right">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VTC + sanctions actives */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Compagnies (VTC)</h2>
            {profile.affiliations.length === 0 && profile.ownedVtcs.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Aucune affiliation VTC.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {profile.ownedVtcs.map((vtc) => (
                  <li key={`o-${vtc.id}`} className="flex items-center justify-between rounded-xl border border-rouge-500/20 bg-rouge-500/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{vtc.name}</p>
                      <p className="text-xs text-zinc-400">Propriétaire · {vtc.memberCount} membre{vtc.memberCount > 1 ? "s" : ""}</p>
                    </div>
                    <span className="rounded-md bg-carbone-600 px-2 py-1 text-xs font-semibold text-zinc-200">{vtc.tag}</span>
                  </li>
                ))}
                {profile.affiliations.map((affiliation) => (
                  <li key={affiliation.vtcId} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{affiliation.name}</p>
                      <p className="text-xs text-zinc-400">{affiliation.role}</p>
                    </div>
                    <span className="rounded-md bg-carbone-600 px-2 py-1 text-xs font-semibold text-zinc-200">{affiliation.tag}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Sanctions actives</h2>
            {profile.activeBans.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Aucune sanction active. 🚚</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {profile.activeBans.map((ban) => (
                  <li key={ban.id} className="rounded-xl border border-rouge-500/25 bg-rouge-500/5 px-4 py-3">
                    <p className="text-sm font-semibold text-rouge-400">{ban.type}</p>
                    <p className="mt-1 text-sm text-zinc-300">{ban.reason}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {ban.expiresAt ? `Expire le ${formatDate(ban.expiresAt)}` : "Permanente"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Avatar({ profile }: { profile: PublicProfile }) {
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={`Avatar de ${profile.username}`}
        className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-white/10"
      />
    );
  }
  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rouge-500 to-rouge-600 text-3xl font-bold text-white ring-2 ring-white/10">
      {profile.username.charAt(0).toUpperCase()}
    </span>
  );
}

function LinkBadge({ linked, label }: { linked: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
        linked
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-zinc-500"
      }`}
    >
      {label}
      <span>{linked ? "✓" : "✕"}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 backdrop-blur">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
