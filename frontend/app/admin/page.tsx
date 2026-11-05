"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchServersStatus, type GameServer } from "@/lib/api";
import {
  EVENT_STATUS_BADGE,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from "@/lib/events";
import {
  addVtcMember,
  createAnnouncement,
  createBan,
  createServer,
  deleteAnnouncement,
  deleteServer,
  deleteUser,
  deleteVtc,
  fetchAdminAnnouncements,
  fetchAdminBans,
  fetchAdminServers,
  fetchAdminUsers,
  fetchAuditLog,
  fetchDashboard,
  fetchVtcDetail,
  fetchVtcs,
  removeVtcMember,
  revokeBan,
  updateAnnouncement,
  updateServer,
  updateUserRole,
  updateVtcMemberRole,
  type AdminAnnouncement,
  type AdminBan,
  type AdminRole,
  type AdminServer,
  type AdminUser,
  type AdminVtc,
  type AuditLogEntry,
  type DashboardStats,
  createEvent,
  deleteEvent,
  fetchAdminEvents,
  updateEvent,
  type AdminEvent,
  type AdminEventStatus,
  type AdminEventType,
  type EventInput,
  type VtcDetail,
  type VtcMemberRole,
} from "@/lib/admin";

type Tab =
  | "dashboard"
  | "users"
  | "bans"
  | "servers"
  | "vtcs"
  | "announcements"
  | "events"
  | "audit";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊" },
  { id: "users", label: "Utilisateurs", icon: "👥" },
  { id: "bans", label: "Sanctions", icon: "🔨" },
  { id: "servers", label: "Serveurs", icon: "🖥️" },
  { id: "vtcs", label: "VTC", icon: "🏢" },
  { id: "announcements", label: "Annonces", icon: "📢" },
  { id: "events", label: "Événements", icon: "📅" },
  { id: "audit", label: "Journal", icon: "📝" },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Administrateur",
  DEV: "Développeur",
  MODERATOR: "Modérateur",
  DRIVER: "Conducteur",
};

const ROLE_BADGE: Record<AdminRole, string> = {
  ADMIN: "border-rouge-500/30 bg-rouge-500/15 text-rouge-400",
  DEV: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  MODERATOR: "border-sky-500/30 bg-sky-500/15 text-sky-400",
  DRIVER: "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
};

const BAN_LABELS: Record<string, string> = {
  WARNING: "Avertissement",
  TEMPORARY: "Temporaire",
  PERMANENT: "Permanent",
};

const STATUS_LABELS: Record<string, string> = {
  ONLINE: "En ligne",
  OFFLINE: "Hors ligne",
  MAINTENANCE: "Maintenance",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("fr-FR")} km`;
}

/* ---------- Page ---------- */

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (loading) {
    return (
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </section>
    );
  }

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return <AccessDenied />;
  }

  return (
    <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <div className="card p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
                Administration
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white">
                Panneau d&apos;administration
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Connecté en tant que{" "}
                <span className="font-medium text-white">{user.username}</span> ·{" "}
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1 rounded-xl border border-white/5 bg-charbon-900/60 p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-rouge-500 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "dashboard" && <DashboardTab />}
        {tab === "users" && (
          <UsersTab currentUserId={user.id} isAdmin={user.role === "ADMIN"} />
        )}
        {tab === "bans" && <BansTab />}
        {tab === "servers" && <ServersTab isAdmin={user.role === "ADMIN"} />}
        {tab === "vtcs" && <VtcsTab isAdmin={user.role === "ADMIN"} />}
        {tab === "announcements" && <AnnouncementsTab />}
        {tab === "events" && <EventsTab isAdmin={user.role === "ADMIN"} />}
        {tab === "audit" && <AuditLogTab />}
      </div>
    </section>
  );
}

function AccessDenied() {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="relative w-full max-w-md card p-8 text-center backdrop-blur">
        <p className="text-5xl">🔒</p>
        <h1 className="mt-4 text-xl font-bold text-white">Accès refusé</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Cette page est réservée à l&apos;équipe de FreightMP (administrateurs et
          modérateurs).
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

/* ---------- Tableau de bord ---------- */

function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchDashboard()
      .then((data) => setStats(data))
      .catch(() => setError("Impossible de charger les statistiques."));
    fetchServersStatus()
      .then((data) => setServers(data.servers))
      .catch(() => {
        /* silencieux */
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  if (error) return <ErrorCard text={error} />;
  if (!stats) return <LoadingCard />;

  const cards = [
    { label: "Utilisateurs", value: stats.users.toLocaleString("fr-FR"), icon: "👥" },
    {
      label: "Serveurs en ligne",
      value: `${stats.onlineServers}/${stats.servers}`,
      icon: "🖥️",
    },
    { label: "Livraisons", value: stats.deliveries.toLocaleString("fr-FR"), icon: "🚚" },
    { label: "Sanctions actives", value: stats.activeBans.toLocaleString("fr-FR"), icon: "🔨" },
    { label: "VTC", value: stats.vtcs.toLocaleString("fr-FR"), icon: "🏢" },
    { label: "Km cumulés", value: formatKm(stats.totalKm), icon: "🛣️" },
  ];

  const totalPlayers = servers.reduce(
    (sum, server) => sum + server.onlinePlayers,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="card p-5 backdrop-blur"
          >
            <span className="text-2xl">{card.icon}</span>
            <p className="mt-3 text-2xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <Card title="Serveurs en temps réel" action={<LiveBadge />}>
        <p className="mb-3 text-sm text-zinc-400">
          {totalPlayers} joueur(s) connecté(s) au total
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <div
              key={server.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{server.name}</p>
                <span
                  className={
                    server.status === "ONLINE"
                      ? "text-xs text-emerald-400"
                      : server.status === "MAINTENANCE"
                        ? "text-xs text-amber-400"
                        : "text-xs text-zinc-500"
                  }
                >
                  {STATUS_LABELS[server.status]}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {server.game} · {server.onlinePlayers}/{server.maxPlayers} joueurs
              </p>
            </div>
          ))}
          {servers.length === 0 && (
            <p className="text-sm text-zinc-500">Aucun serveur.</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Derniers utilisateurs">
          {stats.recentUsers.length === 0 ? (
            <EmptyState text="Aucun utilisateur." />
          ) : (
            <ul className="space-y-2">
              {stats.recentUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-white">{u.username}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[u.role]}`}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Dernières livraisons">
          {stats.recentDeliveries.length === 0 ? (
            <EmptyState text="Aucune livraison." />
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.recentDeliveries.map((d) => (
                <li key={d.id} className="text-zinc-300">
                  <span className="font-medium text-white">{d.username}</span> ·{" "}
                  {d.cargoName} · {d.fromCity} → {d.toCity}{" "}
                  <span className="text-zinc-500">({Math.round(d.distanceKm)} km)</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Dernières sanctions">
          {stats.recentBans.length === 0 ? (
            <EmptyState text="Aucune sanction." />
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.recentBans.map((b) => (
                <li key={b.id} className="text-zinc-300">
                  <span className="font-medium text-white">{b.targetUsername}</span> ·{" "}
                  {BAN_LABELS[b.type] ?? b.type}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Utilisateurs ---------- */

function UsersTab({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<AdminRole | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [banningUser, setBanningUser] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminUsers({ role: roleFilter || undefined, search: search || undefined })
      .then((data) => {
        setUsers(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, [roleFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (userId: string, role: AdminRole) => {
    try {
      await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const remove = async (userId: string, username: string) => {
    if (!confirm(`Supprimer définitivement ${username} ?`)) return;
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Card title="Utilisateurs">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as AdminRole | "")}
          className="rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="">Tous les rôles</option>
          {(Object.keys(ROLE_LABELS) as AdminRole[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
          className="flex flex-1 items-center gap-2"
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher un pseudo…"
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

      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading && users.length === 0 ? (
        <LoadingCard />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 pb-2 font-medium">Pseudo</th>
                <th className="px-2 pb-2 font-medium">Rôle</th>
                <th className="px-2 pb-2 text-right font-medium">Km</th>
                <th className="px-2 pb-2 text-right font-medium">Livr.</th>
                <th className="px-2 pb-2 text-right font-medium">Bans</th>
                <th className="px-2 pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="text-zinc-300">
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{u.username}</span>
                      <span className="flex gap-1 text-[10px]">
                        <LinkDot on={Boolean(u.steamId)} title="Steam" />
                        <LinkDot on={Boolean(u.discordId)} title="Discord" />
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {isAdmin && u.id !== currentUserId ? (
                      <select
                        value={u.role}
                        onChange={(e) => void changeRole(u.id, e.target.value as AdminRole)}
                        className="rounded-lg border border-white/10 bg-charbon-900 px-2 py-1 text-xs text-white outline-none"
                      >
                        {(Object.keys(ROLE_LABELS) as AdminRole[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {Math.round(u.stats.kilometersDriven).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {u.deliveryCount.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {u.banCount > 0 ? <span className="text-rouge-400">{u.banCount}</span> : "0"}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setBanningUser(u)}
                        className="rounded-lg border border-rouge-500/30 bg-rouge-500/10 px-2 py-1 text-xs font-medium text-rouge-300 hover:bg-rouge-500/20"
                      >
                        Bannir
                      </button>
                      {isAdmin && u.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => void remove(u.id, u.username)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && !loading && (
            <p className="py-4 text-sm text-zinc-500">Aucun utilisateur trouvé.</p>
          )}
        </div>
      )}

      {banningUser && (
        <BanModal
          user={banningUser}
          onClose={() => setBanningUser(null)}
          onSaved={() => {
            setBanningUser(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function BanModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<AdminBan["type"]>("TEMPORARY");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (reason.trim().length < 3) {
      setError("La raison doit contenir au moins 3 caractères.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBan({
        userId: user.id,
        type,
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Bannir ${user.username}`} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <FieldLabel>Type de sanction</FieldLabel>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AdminBan["type"])}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="WARNING">Avertissement</option>
            <option value="TEMPORARY">Bannissement temporaire</option>
            <option value="PERMANENT">Bannissement permanent</option>
          </select>
        </label>
        <label className="block">
          <FieldLabel>Raison</FieldLabel>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            placeholder="Motif de la sanction…"
          />
        </label>
        <label className="block">
          <FieldLabel>Date d&apos;expiration (optionnel)</FieldLabel>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}
      <ModalActions
        onCancel={onClose}
        onConfirm={() => void save()}
        saving={saving}
        confirmLabel="Bannir"
        danger
      />
    </Modal>
  );
}

/* ---------- Sanctions ---------- */

function BansTab() {
  const [bans, setBans] = useState<AdminBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminBans()
      .then((data) => {
        setBans(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    try {
      await revokeBan(id);
      setBans((prev) => prev.map((b) => (b.id === id ? { ...b, active: false } : b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Card title="Sanctions" badge={bans.length > 0 ? `${bans.length}` : undefined}>
      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading && bans.length === 0 ? (
        <LoadingCard />
      ) : bans.length === 0 ? (
        <EmptyState text="Aucune sanction enregistrée." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 pb-2 font-medium">Cible</th>
                <th className="px-2 pb-2 font-medium">Type</th>
                <th className="px-2 pb-2 font-medium">Raison</th>
                <th className="px-2 pb-2 font-medium">Émetteur</th>
                <th className="px-2 pb-2 font-medium">Date</th>
                <th className="px-2 pb-2 font-medium">Statut</th>
                <th className="px-2 pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bans.map((ban) => (
                <tr key={ban.id} className="text-zinc-300">
                  <td className="px-2 py-3 font-medium text-white">{ban.targetUsername}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        ban.active
                          ? "bg-rouge-500/15 text-rouge-300"
                          : "bg-white/5 text-zinc-500"
                      }`}
                    >
                      {BAN_LABELS[ban.type] ?? ban.type}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-3 text-zinc-400">{ban.reason}</td>
                  <td className="px-2 py-3 text-zinc-400">{ban.issuerUsername}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-zinc-400">
                    {formatDate(ban.createdAt)}
                  </td>
                  <td className="px-2 py-3">
                    {ban.active ? (
                      <span className="text-rouge-400">Active</span>
                    ) : (
                      <span className="text-zinc-500">Levée</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {ban.active ? (
                      <button
                        type="button"
                        onClick={() => void revoke(ban.id)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                      >
                        Révoquer
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- Serveurs ---------- */

function ServersTab({ isAdmin }: { isAdmin: boolean }) {
  const [servers, setServers] = useState<AdminServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ server: AdminServer | null } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminServers()
      .then((data) => {
        setServers(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (server: AdminServer, status: AdminServer["status"]) => {
    try {
      const updated = await updateServer(server.id, { status });
      setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const remove = async (server: AdminServer) => {
    if (!confirm(`Supprimer le serveur ${server.name} ?`)) return;
    try {
      await deleteServer(server.id);
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Card
      title="Serveurs"
      action={
        <button
          type="button"
          onClick={() => setModal({ server: null })}
          className="rounded-lg bg-rouge-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rouge-400"
        >
          + Nouveau serveur
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading ? (
        <LoadingCard />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 pb-2 font-medium">Nom</th>
                <th className="px-2 pb-2 font-medium">Jeu</th>
                <th className="px-2 pb-2 font-medium">Statut</th>
                <th className="px-2 pb-2 text-right font-medium">Joueurs</th>
                <th className="px-2 pb-2 font-medium">Région</th>
                <th className="px-2 pb-2 font-medium">Version</th>
                <th className="px-2 pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {servers.map((server) => (
                <tr key={server.id} className="text-zinc-300">
                  <td className="px-2 py-3 font-medium text-white">{server.name}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        server.game === "ATS"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-rouge-500/15 text-rouge-300"
                      }`}
                    >
                      {server.game}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <select
                      value={server.status}
                      onChange={(e) =>
                        void setStatus(server, e.target.value as AdminServer["status"])
                      }
                      className="rounded-lg border border-white/10 bg-charbon-900 px-2 py-1 text-xs text-white outline-none"
                    >
                      {(Object.keys(STATUS_LABELS) as AdminServer["status"][]).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3 text-right">
                    {server.onlinePlayers}/{server.maxPlayers}
                  </td>
                  <td className="px-2 py-3 text-zinc-400">{server.region ?? "—"}</td>
                  <td className="px-2 py-3 text-zinc-400">{server.version ?? "—"}</td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ server })}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                      >
                        Éditer
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void remove(server)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-sm text-zinc-500">
                    Aucun serveur enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ServerModal
          server={modal.server}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function ServerModal({
  server,
  onClose,
  onSaved,
}: {
  server: AdminServer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(server);
  const [name, setName] = useState(server?.name ?? "");
  const [slug, setSlug] = useState(server?.slug ?? "");
  const [game, setGame] = useState<AdminServer["game"]>(server?.game ?? "ETS2");
  const [maxPlayers, setMaxPlayers] = useState(server?.maxPlayers ?? 100);
  const [host, setHost] = useState(server?.host ?? "127.0.0.1");
  const [port, setPort] = useState(server?.port ?? 27015);
  const [region, setRegion] = useState(server?.region ?? "");
  const [version, setVersion] = useState(server?.version ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editing && server) {
        await updateServer(server.id, {
          name,
          maxPlayers,
          host,
          port,
          region: region || null,
          version: version || null,
        });
      } else {
        await createServer({
          name,
          slug,
          game,
          maxPlayers,
          host,
          port,
          region: region || undefined,
          version: version || undefined,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? `Éditer ${server?.name}` : "Nouveau serveur"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <FieldLabel>Nom</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        {!editing && (
          <label className="col-span-2 block">
            <FieldLabel>Slug (unique, ex. fmp-eu-3)</FieldLabel>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
        )}
        <label className="block">
          <FieldLabel>Jeu</FieldLabel>
          <select
            value={game}
            disabled={editing}
            onChange={(e) => setGame(e.target.value as AdminServer["game"])}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
          >
            <option value="ETS2">ETS2</option>
            <option value="ATS">ATS</option>
          </select>
        </label>
        <label className="block">
          <FieldLabel>Joueurs max</FieldLabel>
          <input
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <FieldLabel>Hôte</FieldLabel>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <FieldLabel>Port</FieldLabel>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <FieldLabel>Région</FieldLabel>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <FieldLabel>Version</FieldLabel>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}
      <ModalActions
        onCancel={onClose}
        onConfirm={() => void save()}
        saving={saving}
        confirmLabel={editing ? "Enregistrer" : "Créer"}
      />
    </Modal>
  );
}

/* ---------- VTC ---------- */

function VtcsTab({ isAdmin }: { isAdmin: boolean }) {
  const [vtcs, setVtcs] = useState<AdminVtc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<AdminVtc | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchVtcs()
      .then((data) => {
        setVtcs(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (vtc: AdminVtc) => {
    if (!confirm(`Supprimer la VTC ${vtc.name} (${vtc.tag}) ?`)) return;
    try {
      await deleteVtc(vtc.id);
      setVtcs((prev) => prev.filter((v) => v.id !== vtc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Card title="Compagnies virtuelles" badge={vtcs.length > 0 ? `${vtcs.length}` : undefined}>
      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading ? (
        <LoadingCard />
      ) : vtcs.length === 0 ? (
        <EmptyState text="Aucune VTC enregistrée." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 pb-2 font-medium">Nom</th>
                <th className="px-2 pb-2 font-medium">Tag</th>
                <th className="px-2 pb-2 font-medium">Propriétaire</th>
                <th className="px-2 pb-2 text-right font-medium">Membres</th>
                <th className="px-2 pb-2 font-medium">Créée le</th>
                <th className="px-2 pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {vtcs.map((vtc) => (
                <tr key={vtc.id} className="text-zinc-300">
                  <td className="px-2 py-3 font-medium text-white">{vtc.name}</td>
                  <td className="px-2 py-3">
                    <span className="rounded-md bg-carbone-600 px-2 py-1 text-xs font-semibold text-zinc-200">
                      {vtc.tag}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-zinc-400">{vtc.ownerUsername}</td>
                  <td className="px-2 py-3 text-right">{vtc.memberCount}</td>
                  <td className="px-2 py-3 text-zinc-400">{formatDate(vtc.createdAt)}</td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setManaging(vtc)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                      >
                        Gérer
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void remove(vtc)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {managing && (
        <VtcDetailModal
          vtc={managing}
          onClose={() => setManaging(null)}
          onChanged={() => load()}
        />
      )}
    </Card>
  );
}

function VtcDetailModal({
  vtc,
  onClose,
  onChanged,
}: {
  vtc: AdminVtc;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<VtcDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetchVtcDetail(vtc.id)
      .then((data) => {
        setDetail(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."));
  }, [vtc.id]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!username.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addVtcMember(vtc.id, { username: username.trim() });
      setUsername("");
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (userId: string, role: VtcMemberRole) => {
    try {
      await updateVtcMemberRole(vtc.id, userId, role);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!confirm(`Retirer ${name} de la VTC ?`)) return;
    try {
      await removeVtcMember(vtc.id, userId);
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Modal title={`Membres de ${vtc.name}`} onClose={onClose}>
      <div className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Pseudo à ajouter…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={adding}
          className="rounded-lg bg-rouge-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rouge-400 disabled:opacity-50"
        >
          {adding ? "…" : "Ajouter"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}

      <ul className="mt-4 space-y-2">
        {(detail?.members ?? []).map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm font-medium text-white">
              {member.username}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <select
                value={member.role}
                onChange={(e) =>
                  void changeRole(member.userId, e.target.value as VtcMemberRole)
                }
                className="rounded-lg border border-white/10 bg-charbon-900 px-2 py-1 text-xs text-white outline-none"
              >
                <option value="OWNER">Owner</option>
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
            </div>
          </li>
        ))}
        {detail && detail.members.length === 0 && (
          <li className="py-2 text-sm text-zinc-500">Aucun membre.</li>
        )}
        {!detail && <li className="py-2 text-sm text-zinc-500">Chargement…</li>}
      </ul>
    </Modal>
  );
}

/* ---------- Annonces ---------- */

function AnnouncementsTab() {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ announcement: AdminAnnouncement | null } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminAnnouncements()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePublished = async (item: AdminAnnouncement) => {
    try {
      const updated = await updateAnnouncement(item.id, { published: !item.published });
      setItems((prev) => prev.map((a) => (a.id === item.id ? updated : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  const remove = async (item: AdminAnnouncement) => {
    if (!confirm(`Supprimer l'annonce « ${item.title} » ?`)) return;
    try {
      await deleteAnnouncement(item.id);
      setItems((prev) => prev.filter((a) => a.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Card
      title="Annonces"
      action={
        <button
          type="button"
          onClick={() => setModal({ announcement: null })}
          className="rounded-lg bg-rouge-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rouge-400"
        >
          + Nouvelle annonce
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading ? (
        <LoadingCard />
      ) : items.length === 0 ? (
        <EmptyState text="Aucune annonce. Créez-en une pour la landing page." />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      item.published
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {item.published ? "publiée" : "brouillon"}
                  </span>
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  {item.authorUsername} · {formatDate(item.createdAt)}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void togglePublished(item)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                  >
                    {item.published ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ announcement: item })}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <AnnouncementModal
          announcement={modal.announcement}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function AnnouncementModal({
  announcement,
  onClose,
  onSaved,
}: {
  announcement: AdminAnnouncement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(announcement);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [published, setPublished] = useState(announcement?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editing && announcement) {
        await updateAnnouncement(announcement.id, { title, body, published });
      } else {
        await createAnnouncement({ title, body, published });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Éditer l'annonce" : "Nouvelle annonce"} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <FieldLabel>Titre</FieldLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <FieldLabel>Contenu</FieldLabel>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-rouge-500"
          />
          Publier immédiatement
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}
      <ModalActions
        onCancel={onClose}
        onConfirm={() => void save()}
        saving={saving}
        confirmLabel={editing ? "Enregistrer" : "Créer"}
      />
    </Modal>
  );
}

/* ---------- Événements ---------- */

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function EventsTab({ isAdmin }: { isAdmin: boolean }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ event: AdminEvent | null } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminEvents()
      .then((data) => {
        setEvents(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (event: AdminEvent) => {
    if (!confirm(`Supprimer l'événement « ${event.title} » ?`)) return;
    try {
      await deleteEvent(event.id);
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <Card
      title="Événements"
      action={
        <button
          type="button"
          onClick={() => setModal({ event: null })}
          className="rounded-lg bg-rouge-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rouge-400"
        >
          + Nouvel événement
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading ? (
        <LoadingCard />
      ) : events.length === 0 ? (
        <EmptyState text="Aucun événement. Créez-en un !" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 pb-2 font-medium">Titre</th>
                <th className="px-2 pb-2 font-medium">Type</th>
                <th className="px-2 pb-2 font-medium">Statut</th>
                <th className="px-2 pb-2 font-medium">Date</th>
                <th className="px-2 pb-2 text-right font-medium">Inscrits</th>
                <th className="px-2 pb-2 font-medium">Publié</th>
                <th className="px-2 pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => (
                <tr key={event.id} className="text-zinc-300">
                  <td className="max-w-[220px] truncate px-2 py-3 font-medium text-white">
                    {event.title}
                  </td>
                  <td className="px-2 py-3 text-zinc-400">
                    {EVENT_TYPE_LABELS[event.type]}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${EVENT_STATUS_BADGE[event.status]}`}
                    >
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-zinc-400">
                    {formatDate(event.startAt)}
                  </td>
                  <td className="px-2 py-3 text-right">{event.participantCount}</td>
                  <td className="px-2 py-3">
                    {event.published ? (
                      <span className="text-emerald-400">Oui</span>
                    ) : (
                      <span className="text-zinc-500">Non</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ event })}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
                      >
                        Éditer
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void remove(event)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/10"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <EventModal
          event={modal.event}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function EventModal({
  event,
  onClose,
  onSaved,
}: {
  event: AdminEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(event);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [type, setType] = useState<AdminEventType>(event?.type ?? "CONVOY");
  const [status, setStatus] = useState<AdminEventStatus>(event?.status ?? "UPCOMING");
  const [startAt, setStartAt] = useState(toDateTimeLocal(event?.startAt ?? null));
  const [endAt, setEndAt] = useState(toDateTimeLocal(event?.endAt ?? null));
  const [location, setLocation] = useState(event?.location ?? "");
  const [game, setGame] = useState<"" | "ETS2" | "ATS">(event?.game ?? "");
  const [published, setPublished] = useState(event?.published ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: EventInput = {
        title: title.trim(),
        description: description.trim(),
        type,
        status,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        location: location.trim() || undefined,
        game: game || undefined,
        published,
      };

      if (editing && event) {
        await updateEvent(event.id, payload);
      } else {
        await createEvent(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Éditer l'événement" : "Nouvel événement"} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <FieldLabel>Titre</FieldLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block">
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>Type</FieldLabel>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AdminEventType)}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="CONVOY">Convoi</option>
              <option value="DELIVERY">Livraison spéciale</option>
              <option value="SPECIAL">Événement spécial</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Statut</FieldLabel>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AdminEventStatus)}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="UPCOMING">À venir</option>
              <option value="ONGOING">En cours</option>
              <option value="FINISHED">Terminé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Début</FieldLabel>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <FieldLabel>Fin (optionnel)</FieldLabel>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <FieldLabel>Lieu / trajet</FieldLabel>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ex. Berlin → Paris"
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <FieldLabel>Jeu</FieldLabel>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value as "" | "ETS2" | "ATS")}
              className="w-full rounded-lg border border-white/10 bg-charbon-900 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">Aucun</option>
              <option value="ETS2">ETS2</option>
              <option value="ATS">ATS</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-rouge-500"
          />
          Publier l&apos;événement
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-rouge-400">{error}</p>}
      <ModalActions
        onCancel={onClose}
        onConfirm={() => void save()}
        saving={saving}
        confirmLabel={editing ? "Enregistrer" : "Créer"}
      />
    </Modal>
  );
}

/* ---------- Journal d'audit ---------- */

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAuditLog()
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch(() => {
        if (active) setError("Impossible de charger le journal.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card title="Journal d'audit" badge={logs.length > 0 ? `${logs.length}` : undefined}>
      {error && <p className="mb-3 text-sm text-rouge-400">{error}</p>}
      {loading ? (
        <LoadingCard />
      ) : logs.length === 0 ? (
        <EmptyState text="Aucune action enregistrée pour le moment." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 pb-2 font-medium">Date</th>
                <th className="px-2 pb-2 font-medium">Auteur</th>
                <th className="px-2 pb-2 font-medium">Action</th>
                <th className="px-2 pb-2 font-medium">Cible</th>
                <th className="px-2 pb-2 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="text-zinc-300">
                  <td className="whitespace-nowrap px-2 py-2 text-zinc-400">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-2 py-2 font-medium text-white">{log.actorUsername}</td>
                  <td className="px-2 py-2">
                    <code className="rounded bg-carbone-600 px-1.5 py-0.5 text-xs text-rouge-300">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-2 py-2 text-zinc-400">{log.targetType ?? "—"}</td>
                  <td className="max-w-[280px] truncate px-2 py-2 text-zinc-500">
                    {log.details ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- UI partagée ---------- */

function Card({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {badge && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-charbon-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:text-white"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  saving,
  confirmLabel,
  danger,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  confirmLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={saving}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
          danger ? "bg-rouge-500 hover:bg-rouge-400" : "bg-rouge-500 hover:bg-rouge-400"
        }`}
      >
        {saving ? "…" : confirmLabel}
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </span>
  );
}

function LoadingCard() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
      ))}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-rouge-500/30 bg-rouge-500/10 px-4 py-3 text-sm text-rouge-400">
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-4 text-sm text-zinc-500">{text}</p>;
}

function LinkDot({ on, title }: { on: boolean; title: string }) {
  return (
    <span
      title={`${title} ${on ? "lié" : "non lié"}`}
      className={`inline-block h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-zinc-600"}`}
    />
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}
