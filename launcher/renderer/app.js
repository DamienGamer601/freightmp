/* ============================================================
   FreightMP Launcher — Renderer
   ============================================================ */

const api = window.freightmp;
const $ = (id) => document.getElementById(id);

const state = {
  config: {},
  user: null,
  servers: [],
  players: [],
  room: null,
  view: "home",
  playing: false,
  sessionStart: null,
  soundOn: true,
  volume: 0.6,
  logs: [],
};

/* ---------- Sons (WebAudio, doux) ---------- */

let audioCtx = null;
function sound(kind) {
  if (!state.soundOn) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const freqs = { click: 420, ok: 660, err: 220, notify: 520 };
    osc.type = "sine";
    osc.frequency.value = freqs[kind] ?? 420;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06 * state.volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    /* audio indisponible */
  }
}

/* ---------- Toasts ---------- */

function toast(message, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- Thème & accent ---------- */

const ACCENTS = {
  rouge: ["#e23a3a", "#ff5c5c"],
  sky: ["#0284c7", "#38bdf8"],
  emerald: ["#059669", "#34d399"],
  amber: ["#d97706", "#fbbf24"],
  violet: ["#7c3aed", "#a78bfa"],
  zinc: ["#52525b", "#a1a1aa"],
};

function applyTheme(theme) {
  document.body.dataset.theme = theme === "light" ? "light" : "dark";
  $("theme-toggle").textContent = theme === "light" ? "☀️" : "🌙";
}

function applyAccent(name) {
  const [main, light] = ACCENTS[name] ?? ACCENTS.rouge;
  document.documentElement.style.setProperty("--accent", main);
  document.documentElement.style.setProperty("--accent-2", light);
}

/* ---------- Navigation ---------- */

const NAV = [
  { id: "home", icon: "⌂", label: "Accueil" },
  {
    icon: "🎮",
    label: "Multijoueur",
    children: [
      { id: "servers", label: "Serveurs" },
      { id: "players", label: "Joueurs en ligne" },
      { id: "map", label: "Carte live" },
    ],
  },
  {
    icon: "👤",
    label: "Mon compte",
    children: [
      { id: "profile", label: "Profil" },
      { id: "stats", label: "Statistiques" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    icon: "👥",
    label: "Communauté",
    children: [
      { id: "friends", label: "Amis" },
      { id: "messages", label: "Messages" },
      { id: "company", label: "Ma compagnie" },
    ],
  },
  { id: "events", icon: "📅", label: "Événements" },
  { id: "leaderboard", icon: "🏆", label: "Classement" },
  { id: "news", icon: "▤", label: "Actualités" },
  {
    icon: "🛠",
    label: "Outils",
    children: [
      { id: "sessions", label: "Historique" },
      { id: "plugins", label: "Plugins" },
      { id: "logs", label: "Logs" },
      { id: "console", label: "Console" },
    ],
  },
  { id: "settings", icon: "⚙", label: "Paramètres" },
];

const TITLES = {
  home: "Accueil",
  servers: "Serveurs",
  players: "Joueurs en ligne",
  map: "Carte live",
  profile: "Mon profil",
  stats: "Statistiques",
  notifications: "Notifications",
  friends: "Amis",
  messages: "Messages",
  company: "Ma compagnie",
  events: "Événements",
  leaderboard: "Classement",
  news: "Actualités",
  sessions: "Historique",
  plugins: "Plugins",
  logs: "Logs",
  console: "Console",
  settings: "Paramètres",
};

function buildNav() {
  const nav = $("nav");
  nav.innerHTML = "";

  for (const entry of NAV) {
    if (entry.children) {
      const group = document.createElement("div");
      group.className = "nav-group";

      const toggle = document.createElement("button");
      toggle.className = "nav-item";
      toggle.innerHTML = `<span class="nav-icon">${entry.icon}</span><span class="nav-label">${entry.label}</span><span class="nav-chevron">›</span>`;
      toggle.addEventListener("click", () => {
        if ($("sidebar").classList.contains("collapsed")) {
          $("sidebar").classList.remove("collapsed");
        }
        group.classList.toggle("open");
        sound("click");
      });

      const sub = document.createElement("div");
      sub.className = "nav-sub";
      for (const child of entry.children) {
        const item = document.createElement("button");
        item.className = "nav-subitem";
        item.dataset.view = child.id;
        item.textContent = child.label;
        item.addEventListener("click", () => switchView(child.id));
        sub.appendChild(item);
      }

      group.appendChild(toggle);
      group.appendChild(sub);
      nav.appendChild(group);
    } else {
      const item = document.createElement("button");
      item.className = "nav-item";
      item.dataset.view = entry.id;
      item.innerHTML = `<span class="nav-icon">${entry.icon}</span><span class="nav-label">${entry.label}</span>`;
      item.addEventListener("click", () => switchView(entry.id));
      nav.appendChild(item);
    }
  }
}

function switchView(view) {
  state.view = view;
  $("page-title").textContent = TITLES[view] ?? "FreightMP";

  document.querySelectorAll(".nav-item, .nav-subitem").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });

  const active = document.querySelector(`[data-view="${view}"]`);
  if (active) {
    active.closest(".nav-group")?.classList.add("open");
  }

  sound("click");
  render();
}

/* ---------- Vues ---------- */

const VIEWS = {
  home: renderHome,
  servers: renderServers,
  players: renderPlayers,
  map: renderMap,
  profile: renderProfile,
  stats: renderStats,
  notifications: renderNotifications,
  friends: renderFriends,
  messages: renderMessages,
  company: renderCompany,
  events: renderEvents,
  leaderboard: renderLeaderboard,
  news: renderNews,
  sessions: renderSessions,
  plugins: renderPlugins,
  logs: renderLogs,
  console: renderConsole,
  settings: renderSettings,
};

async function render() {
  const content = $("content");
  content.innerHTML = `<div class="empty">Chargement…</div>`;
  try {
    const html = await (VIEWS[state.view] ?? renderHome)();
    content.innerHTML = html;
    await mount(state.view);
  } catch (error) {
    content.innerHTML = `<div class="empty">Erreur : ${escapeHtml(error.message)}</div>`;
  }
}

async function mount(view) {
  if (view === "settings") mountSettings();
  if (view === "profile") mountProfile();
  if (view === "console") mountConsole();
}

/* ---------- Accueil ---------- */

async function renderHome() {
  const result = await api.fetchServers();
  state.servers = result.servers ?? [];
  const room = state.servers[0] ?? null;
  if (room && !state.room) state.room = room;

  const user = state.user;
  return `
    <div class="hero">
      <span class="badge badge-accent">${escapeHtml(room?.game ?? "ETS2")}</span>
      <h2 class="hero-title mt-8">${escapeHtml(room?.name ?? "Aucun serveur")}</h2>
      <p class="hero-meta">${room ? `${room.onlinePlayers ?? 0}/${room.maxPlayers ?? 100} joueurs · ${room.onlinePlayers > 0 ? "Actif" : "En attente"}` : "Aucun serveur disponible"}</p>
      <div class="hero-actions">
        ${user
          ? `<button class="btn btn-primary" id="play-btn">▶ JOUER</button>`
          : `<button class="btn btn-primary" id="login-btn">Se connecter</button>`}
        <button class="btn btn-ghost" id="refresh-btn">Actualiser</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat-value">${user?.stats?.kilometersDriven?.toFixed(0) ?? 0}</div><div class="stat-label">Kilomètres</div></div>
      <div class="stat"><div class="stat-value">${user?.stats?.deliveriesCompleted ?? 0}</div><div class="stat-label">Livraisons</div></div>
      <div class="stat"><div class="stat-value">${Math.floor((user?.stats?.totalPlayTimeSeconds ?? 0) / 3600)} h</div><div class="stat-label">Temps de jeu</div></div>
      <div class="stat"><div class="stat-value">${state.servers.length}</div><div class="stat-label">Salles</div></div>
    </div>

    <div class="section-header"><h2>Serveurs multijoueurs</h2></div>
    <div class="grid">
      ${state.servers.map((server) => `
        <div class="card">
          <div class="between">
            <strong>${escapeHtml(server.name)}</strong>
            <span class="badge">${escapeHtml(server.game ?? "ETS2")}</span>
          </div>
          <p class="muted" style="margin-top:6px;font-size:13px">${server.onlinePlayers ?? 0}/${server.maxPlayers ?? 100} joueurs</p>
        </div>
      `).join("") || `<div class="empty">Aucun serveur</div>`}
    </div>
  `;
}

/* ---------- Serveurs ---------- */

async function renderServers() {
  const result = await api.fetchServers();
  state.servers = result.servers ?? [];
  return `
    <div class="card">
      <table class="table">
        <thead><tr><th>Salle</th><th>Jeu</th><th>Joueurs</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${state.servers.map((s, index) => `
            <tr>
              <td><strong>${escapeHtml(s.name)}</strong></td>
              <td><span class="badge">${escapeHtml(s.game ?? "ETS2")}</span></td>
              <td class="mono">${s.onlinePlayers ?? 0}/${s.maxPlayers ?? 100}</td>
              <td><span class="badge ${s.onlinePlayers > 0 ? "badge-ok" : ""}">${s.onlinePlayers > 0 ? "Actif" : "En attente"}</span></td>
              <td><button class="btn btn-ghost btn-sm" data-room="${index}">Choisir</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- Joueurs ---------- */

async function renderPlayers() {
  const result = await api.fetchPlayers();
  state.players = result.players ?? [];
  return `
    <div class="card">
      ${state.players.length === 0
        ? `<div class="empty">Aucun joueur connecté.</div>`
        : `<table class="table">
            <thead><tr><th>#</th><th>Pseudo</th><th>Ping</th><th>Tag</th></tr></thead>
            <tbody>
              ${state.players.map((p) => `
                <tr>
                  <td class="mono">${p.numId ?? p.id ?? "—"}</td>
                  <td>${escapeHtml(p.username ?? p.truckId ?? "Inconnu")}</td>
                  <td class="mono">${p.latencyMs ?? 0} ms</td>
                  <td>${p.tag ? `<span class="badge badge-accent">${escapeHtml(p.tag)}</span>` : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
    </div>
  `;
}

/* ---------- Carte ---------- */

async function renderMap() {
  const result = await api.fetchPlayers();
  const players = result.players ?? [];
  return `
    <div class="card">
      <div class="between">
        <h2>Carte live</h2>
        <span class="badge">${players.length} joueur(s)</span>
      </div>
      <div style="margin-top:16px;height:340px;border-radius:12px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--dim)">
        ${players.length === 0 ? "Aucun joueur en jeu." : players.map((p) => `<div style="padding:10px">#${p.numId} ${escapeHtml(p.username ?? "")}</div>`).join("")}
      </div>
      <p class="dim mt-16" style="font-size:12px">La carte 3D interactive est disponible sur le site.</p>
    </div>
  `;
}

/* ---------- Profil ---------- */

async function renderProfile() {
  const me = await api.fetchProfile();
  state.user = me.profile ?? null;

  if (!state.user) {
    return `<div class="card"><div class="empty">Connectez-vous pour accéder à votre profil.</div>
      <div class="row" style="justify-content:center"><button class="btn btn-primary" id="login-btn">Se connecter</button></div></div>`;
  }

  const u = state.user;
  return `
    <div class="card">
      <div class="row">
        <div class="avatar" style="width:54px;height:54px;font-size:18px">${avatarHtml(u)}</div>
        <div class="grow">
          <h2>${escapeHtml(u.username)}</h2>
          <p class="muted">${escapeHtml(u.title ?? "Conducteur")} · ${u.role}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="logout-btn">Déconnexion</button>
      </div>
    </div>

    <div class="section-header"><h2>Comptes liés</h2></div>
    <div class="card">
      ${linkedRow("steam", "🎮", "Steam", u.steamId)}
      ${linkedRow("discord", "💬", "Discord", u.discordId)}
    </div>

    <div class="section-header"><h2>Modifier mon profil</h2></div>
    <div class="card">
      <label class="field"><span>Bio</span><textarea class="textarea" id="p-bio" maxlength="160">${escapeHtml(u.bio ?? "")}</textarea></label>
      <label class="field"><span>Titre affiché</span><input class="input" id="p-title" maxlength="40" value="${escapeHtml(u.title ?? "")}" /></label>
      <div class="row wrap">
        <button class="btn btn-primary" id="p-save">Enregistrer</button>
        <span class="dim" id="p-status"></span>
      </div>
    </div>
  `;
}

function linkedRow(provider, icon, label, linkedId) {
  return `
    <div class="between" style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div class="row">
        <span style="font-size:20px">${icon}</span>
        <div>
          <strong>${label}</strong>
          ${linkedId
            ? `<span class="badge badge-ok" style="margin-left:8px">Lié</span><div class="dim" style="font-size:11px;margin-top:2px">ID : ${escapeHtml(linkedId)}</div>`
            : `<span class="badge" style="margin-left:8px">Non lié</span>`}
        </div>
      </div>
      ${linkedId
        ? `<button class="btn btn-ghost btn-sm" data-unlink="${provider}">Délier</button>`
        : `<button class="btn btn-primary btn-sm" data-link="${provider}">Connecter ${label}</button>`}
    </div>
  `;
}

function avatarHtml(user) {
  return user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="" />` : initials(user.username);
}

/* ---------- Statistiques ---------- */

async function renderStats() {
  const me = await api.fetchProfile();
  const u = me.profile;
  if (!u) return `<div class="empty">Connectez-vous pour voir vos statistiques.</div>`;
  return `
    <div class="stats">
      <div class="stat"><div class="stat-value">${(u.stats?.kilometersDriven ?? 0).toFixed(0)}</div><div class="stat-label">Kilomètres</div></div>
      <div class="stat"><div class="stat-value">${u.stats?.deliveriesCompleted ?? 0}</div><div class="stat-label">Livraisons</div></div>
      <div class="stat"><div class="stat-value">${Math.floor((u.stats?.totalPlayTimeSeconds ?? 0) / 3600)} h</div><div class="stat-label">Temps de jeu</div></div>
      <div class="stat"><div class="stat-value">${(u.affiliations ?? []).length}</div><div class="stat-label">Compagnies</div></div>
    </div>
  `;
}

/* ---------- Notifications ---------- */

async function renderNotifications() {
  const result = await api.apiGet("/api/v1/notifications");
  const list = result.data?.notifications ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Aucune notification.</div>`
        : list.map((n) => `
          <div class="between" style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div>
              <strong>${escapeHtml(n.title ?? "Notification")}</strong>
              <p class="muted" style="font-size:12px;margin-top:3px">${escapeHtml(n.message ?? "")}</p>
            </div>
            ${n.read ? `<span class="badge">Lue</span>` : `<span class="badge badge-accent">Nouvelle</span>`}
          </div>
        `).join("")}
    </div>
  `;
}

/* ---------- Amis ---------- */

async function renderFriends() {
  const result = await api.fetchFriends();
  const list = result.friends ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Aucun ami pour le moment.</div>`
        : list.map((f) => `
          <div class="between" style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div class="row">
              <div class="avatar">${initials(f.username ?? "?")}</div>
              <div>
                <strong>${escapeHtml(f.username ?? "Inconnu")}</strong>
                <p class="dim" style="font-size:12px">${f.status === "ACCEPTED" ? "Ami" : f.status}</p>
              </div>
            </div>
            <span class="badge ${f.online ? "badge-ok" : ""}">${f.online ? "En ligne" : "Hors ligne"}</span>
          </div>
        `).join("")}
    </div>
  `;
}

/* ---------- Messages ---------- */

async function renderMessages() {
  const result = await api.apiGet("/api/v1/messages/conversations");
  const list = result.data?.conversations ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Aucune conversation.</div>`
        : list.map((c) => `
          <div class="between" style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div class="row">
              <div class="avatar">${initials(c.username ?? "?")}</div>
              <div>
                <strong>${escapeHtml(c.username ?? "Inconnu")}</strong>
                <p class="muted" style="font-size:12px">${escapeHtml(c.lastMessage ?? "")}</p>
              </div>
            </div>
            ${c.unread ? `<span class="badge badge-accent">${c.unread}</span>` : ""}
          </div>
        `).join("")}
    </div>
  `;
}

/* ---------- Compagnie ---------- */

async function renderCompany() {
  const result = await api.apiGet("/api/v1/vtcs/mine");
  const company = result.data?.vtc ?? null;
  if (!company) {
    return `<div class="card"><div class="empty">Vous n'êtes membre d'aucune compagnie.</div></div>`;
  }
  return `
    <div class="card">
      <div class="between">
        <div>
          <h2>${escapeHtml(company.name)}</h2>
          <p class="muted">Tag : ${escapeHtml(company.tag ?? "—")}</p>
        </div>
        <span class="badge badge-accent">${company.members ?? 0} membres</span>
      </div>
      <p class="muted" style="margin-top:12px">${escapeHtml(company.description ?? "")}</p>
    </div>
  `;
}

/* ---------- Événements ---------- */

async function renderEvents() {
  const result = await api.apiGet("/api/v1/events?limit=20");
  const list = result.data?.events ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Aucun événement à venir.</div>`
        : list.map((e) => `
          <div class="between" style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div>
              <strong>${escapeHtml(e.title)}</strong>
              <p class="muted" style="font-size:12px">${new Date(e.startAt).toLocaleString("fr-FR")} · ${escapeHtml(e.location ?? "")}</p>
            </div>
            <span class="badge">${escapeHtml(e.game ?? "ETS2")}</span>
          </div>
        `).join("")}
    </div>
  `;
}

/* ---------- Classement ---------- */

async function renderLeaderboard() {
  const result = await api.apiGet("/api/v1/leaderboard?limit=20");
  const list = result.data?.leaderboard ?? result.data?.players ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Classement indisponible.</div>`
        : `<table class="table">
            <thead><tr><th>#</th><th>Joueur</th><th>Km</th><th>Livraisons</th></tr></thead>
            <tbody>
              ${list.map((p, i) => `
                <tr>
                  <td class="mono">${i + 1}</td>
                  <td>${escapeHtml(p.username)}</td>
                  <td class="mono">${Math.round(p.kilometersDriven ?? 0)}</td>
                  <td class="mono">${p.deliveriesCompleted ?? 0}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
    </div>
  `;
}

/* ---------- Actualités ---------- */

async function renderNews() {
  const result = await api.fetchNews();
  const list = result.news ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Aucune actualité.</div>`
        : list.map((n) => `
          <div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <strong>${escapeHtml(n.title ?? "Actualité")}</strong>
            <p class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(n.excerpt ?? n.body ?? "")}</p>
          </div>
        `).join("")}
    </div>
  `;
}

/* ---------- Historique des sessions ---------- */

async function renderSessions() {
  const sessions = state.config.sessions ?? [];
  return `
    <div class="card">
      ${sessions.length === 0
        ? `<div class="empty">Aucune session enregistrée.</div>`
        : `<table class="table">
            <thead><tr><th>Début</th><th>Fin</th><th>Durée</th></tr></thead>
            <tbody>
              ${sessions.slice(0, 30).map((s) => `
                <tr>
                  <td>${new Date(s.start).toLocaleString("fr-FR")}</td>
                  <td>${s.end ? new Date(s.end).toLocaleString("fr-FR") : "—"}</td>
                  <td class="mono">${duration(s.start, s.end)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
    </div>
  `;
}

/* ---------- Plugins ---------- */

async function renderPlugins() {
  const result = await api.listPlugins();
  const list = result.plugins ?? [];
  return `
    <div class="card">
      ${list.length === 0
        ? `<div class="empty">Aucun plugin installé.</div>`
        : list.map((p) => `
          <div class="between" style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div>
              <strong>${escapeHtml(p.name)}</strong>
              <p class="dim" style="font-size:12px">${escapeHtml(p.version ?? "")} · ${escapeHtml(p.description ?? "")}</p>
            </div>
            <span class="badge ${p.enabled ? "badge-ok" : ""}">${p.enabled ? "Actif" : "Inactif"}</span>
          </div>
        `).join("")}
    </div>
  `;
}

/* ---------- Logs ---------- */

async function renderLogs() {
  const result = await api.readLogs();
  const lines = result.lines ?? [];
  return `
    <div class="card">
      <div class="between">
        <h2>Logs du client</h2>
        <button class="btn btn-ghost btn-sm" id="clear-logs">Vider</button>
      </div>
      <pre style="margin-top:14px;max-height:420px;overflow:auto;font-size:12px;color:var(--muted);white-space:pre-wrap">${escapeHtml(lines.join("\n") || "Aucun log.")}</pre>
    </div>
  `;
}

/* ---------- Console ---------- */

function renderConsole() {
  return `
    <div class="card">
      <h2>Console de debug</h2>
      <p class="muted" style="font-size:12px;margin-top:4px">Commandes : help, status, version, client, plugins, api &lt;path&gt;, clear</p>
      <pre id="console-output" style="margin-top:14px;min-height:220px;max-height:320px;overflow:auto;font-size:12px;white-space:pre-wrap;color:var(--muted)"></pre>
      <div class="row mt-8">
        <input class="input" id="console-input" placeholder="Commande…" />
        <button class="btn btn-primary btn-sm" id="console-run">Exécuter</button>
      </div>
    </div>
  `;
}

/* ---------- Paramètres ---------- */

function renderSettings() {
  const c = state.config;
  return `
    <div class="card">
      <h2>Général</h2>
      <div class="field mt-16"><span>Thème</span>
        <select class="select" id="set-theme">
          <option value="dark" ${c.theme !== "light" ? "selected" : ""}>Sombre</option>
          <option value="light" ${c.theme === "light" ? "selected" : ""}>Clair</option>
        </select>
      </div>
      <div class="field"><span>Couleur d'accent</span>
        <select class="select" id="set-accent">
          ${Object.keys(ACCENTS).map((k) => `<option value="${k}" ${c.accentColor === k ? "selected" : ""}>${k}</option>`).join("")}
        </select>
      </div>
      <div class="field"><span>Volume des sons (${Math.round((c.volume ?? 0.6) * 100)}%)</span>
        <input type="range" id="set-volume" min="0" max="100" value="${Math.round((c.volume ?? 0.6) * 100)}" />
      </div>
      <div class="between"><span>Sons d'interface</span><div class="switch ${c.sound !== false ? "on" : ""}" id="set-sound"></div></div>
    </div>

    <div class="card mt-16">
      <h2>Jeu</h2>
      <div class="field mt-16"><span>Jeu</span>
        <select class="select" id="set-game">
          <option value="ETS2" ${c.game !== "ATS" ? "selected" : ""}>Euro Truck Simulator 2</option>
          <option value="ATS" ${c.game === "ATS" ? "selected" : ""}>American Truck Simulator</option>
        </select>
      </div>
      <button class="btn btn-ghost btn-sm" id="detect-games">Détecter les jeux</button>
      <span class="dim" id="detect-status" style="margin-left:10px"></span>
    </div>

    <div class="card mt-16">
      <h2>Mise à jour</h2>
      <div class="between mt-16">
        <span class="muted" id="update-status">Version ${escapeHtml(c.launcherVersion ?? "1.0.1")}</span>
        <button class="btn btn-primary btn-sm" id="check-update">Vérifier</button>
      </div>
    </div>
  `;
}

/* ---------- Mounts ---------- */

async function mountProfile() {
  document.querySelectorAll("[data-link]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.link;
      btn.disabled = true;
      btn.textContent = "…";
      const result = await api.linkAccount(provider);
      if (result.ok) {
        toast(`${provider === "steam" ? "Steam" : "Discord"} lié ✅`);
        sound("ok");
        render();
      } else {
        toast(result.error ?? "Liaison impossible", "error");
        sound("err");
        btn.disabled = false;
        btn.textContent = `Connecter ${provider === "steam" ? "Steam" : "Discord"}`;
      }
    });
  });

  document.querySelectorAll("[data-unlink]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.unlink;
      btn.disabled = true;
      const result = await api.unlinkAccount(provider);
      if (result.ok) {
        toast("Compte délié");
        sound("ok");
        render();
      } else {
        toast(result.error ?? "Impossible de délier", "error");
        sound("err");
        btn.disabled = false;
      }
    });
  });

  $("logout-btn")?.addEventListener("click", async () => {
    await api.logout();
    state.user = null;
    toast("Déconnecté");
    render();
  });

  $("p-save")?.addEventListener("click", async () => {
    const payload = {
      bio: $("p-bio").value.trim() || null,
      title: $("p-title").value.trim() || null,
    };
    const result = await api.apiPatch("/api/v1/me/profile", payload);
    if (result.ok) {
      toast("Profil enregistré ✅");
      sound("ok");
      $("p-status").textContent = "Enregistré";
    } else {
      toast("Échec de l'enregistrement", "error");
    }
  });

  $("login-btn")?.addEventListener("click", doLogin);
}

function mountSettings() {
  const save = async () => {
    await api.saveConfig(state.config);
  };

  $("set-theme")?.addEventListener("change", (e) => {
    state.config.theme = e.target.value;
    applyTheme(e.target.value);
    save();
    sound("click");
  });

  $("set-accent")?.addEventListener("change", (e) => {
    state.config.accentColor = e.target.value;
    applyAccent(e.target.value);
    save();
    sound("click");
  });

  $("set-volume")?.addEventListener("input", (e) => {
    state.volume = Number(e.target.value) / 100;
    state.config.volume = state.volume;
    save();
  });

  $("set-sound")?.addEventListener("click", (e) => {
    state.config.sound = !(state.config.sound !== false);
    state.soundOn = state.config.sound;
    e.currentTarget.classList.toggle("on", state.soundOn);
    save();
    sound("click");
  });

  $("set-game")?.addEventListener("change", (e) => {
    state.config.game = e.target.value;
    save();
  });

  $("detect-games")?.addEventListener("click", async () => {
    const result = await api.detectGames();
    const games = result.games ?? [];
    $("detect-status").textContent = games.length
      ? `${games.length} jeu(x) détecté(s)`
      : "Aucun jeu détecté";
    toast(games.length ? `${games.length} jeu(x) détecté(s)` : "Aucun jeu détecté");
  });

  $("check-update")?.addEventListener("click", async () => {
    const result = await api.checkUpdate();
    $("update-status").textContent = result.available
      ? `Version ${result.version} disponible`
      : "À jour";
    toast(result.available ? `Mise à jour ${result.version} disponible` : "À jour");
  });
}

function mountConsole() {
  const output = $("console-output");
  const print = (line) => {
    output.textContent += `${line}\n`;
    output.scrollTop = output.scrollHeight;
  };

  const run = async () => {
    const input = $("console-input");
    const command = input.value.trim();
    if (!command) return;
    input.value = "";
    print(`> ${command}`);
    const [name, ...args] = command.split(" ");

    switch (name) {
      case "help":
        print("Commandes : help, status, version, client, plugins, api <path>, clear");
        break;
      case "status":
        print(`connecté: ${state.user ? "oui" : "non"} · vue: ${state.view} · serveurs: ${state.servers.length}`);
        break;
      case "version":
        print(`launcher ${state.config.launcherVersion ?? "1.0.1"}`);
        break;
      case "client":
        print(`client: ${await api.clientVersion()}`);
        break;
      case "plugins": {
        const r = await api.listPlugins();
        print(`${(r.plugins ?? []).length} plugin(s)`);
        break;
      }
      case "api": {
        const r = await api.apiGet(args.join(" "));
        print(JSON.stringify(r.data, null, 2));
        break;
      }
      case "clear":
        output.textContent = "";
        break;
      default:
        print(`Commande inconnue : ${name}`);
    }
  };

  $("console-run")?.addEventListener("click", run);
  $("console-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });
}

/* ---------- Actions globales ---------- */

async function doLogin() {
  const result = await api.login();
  if (result.ok) {
    toast("Connecté ✅");
    sound("ok");
    await loadUser();
    render();
  } else {
    toast(result.error ?? "Connexion échouée", "error");
    sound("err");
  }
}

async function loadUser() {
  const result = await api.fetchProfile();
  state.user = result.profile ?? null;

  const accountName = $("account-name");
  const accountTag = $("account-tag");
  const accountAvatar = $("account-avatar");
  if (state.user) {
    accountName.textContent = state.user.username;
    const tag = state.user.affiliations?.[0]?.tag ?? "";
    accountTag.textContent = tag ? `[${tag}]` : state.user.role;
    accountAvatar.innerHTML = avatarHtml(state.user);
  } else {
    accountName.textContent = "Non connecté";
    accountTag.textContent = "";
    accountAvatar.textContent = "?";
  }
}

async function play() {
  if (!state.user) {
    doLogin();
    return;
  }
  const room = state.room ?? state.servers[0];
  if (!room) {
    toast("Aucun serveur disponible", "error");
    return;
  }
  const result = await api.launch({
    roomId: room.id,
    game: state.config.game ?? room.game ?? "ETS2",
    executable: state.config.gamePath ?? null,
  });
  if (result.ok) {
    state.playing = true;
    state.sessionStart = new Date().toISOString();
    toast("Le jeu démarre…");
    sound("ok");
    addSession(state.sessionStart);
    $("session-status").textContent = "En session";
  } else {
    toast(result.error ?? "Lancement impossible", "error");
    sound("err");
  }
}

function addSession(start) {
  const sessions = state.config.sessions ?? [];
  sessions.unshift({ start, end: null });
  state.config.sessions = sessions.slice(0, 50);
  api.saveConfig(state.config);
}

/* ---------- Helpers ---------- */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function initials(name) {
  return String(name ?? "?").slice(0, 2).toUpperCase();
}

function duration(start, end) {
  if (!end) return "en cours";
  const ms = new Date(end) - new Date(start);
  const minutes = Math.round(ms / 60000);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/* ---------- Palette ---------- */

const PALETTE_ITEMS = [
  ...Object.entries(TITLES).map(([id, label]) => ({ id, label: `Aller à ${label}` })),
  { id: "play", label: "Lancer le jeu" },
  { id: "reload", label: "Actualiser la vue" },
  { id: "theme", label: "Basculer le thème" },
];

function openPalette() {
  const palette = $("palette");
  palette.hidden = false;
  $("palette-input").value = "";
  renderPalette("");
  $("palette-input").focus();
}

function closePalette() {
  $("palette").hidden = true;
}

function renderPalette(query) {
  const list = $("palette-list");
  const items = PALETTE_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );
  list.innerHTML = items
    .map((item) => `<div class="palette-item" data-id="${item.id}"><span>${escapeHtml(item.label)}</span></div>`)
    .join("");

  list.querySelectorAll(".palette-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      closePalette();
      if (id === "play") play();
      else if (id === "reload") render();
      else if (id === "theme") {
        const next = document.body.dataset.theme === "light" ? "dark" : "light";
        state.config.theme = next;
        applyTheme(next);
        api.saveConfig(state.config);
      } else switchView(id);
    });
  });
}

/* ---------- Démarrage ---------- */

async function boot() {
  state.config = (await api.loadConfig()).config ?? {};
  state.soundOn = state.config.sound !== false;
  state.volume = state.config.volume ?? 0.6;

  applyTheme(state.config.theme);
  applyAccent(state.config.accentColor ?? "rouge");
  $("sound-toggle").textContent = state.soundOn ? "🔊" : "🔇";

  const version = await api.clientVersion();
  $("version").textContent = `v${state.config.launcherVersion ?? "1.0.1"}`;

  buildNav();
  await loadUser();
  await switchView("home");

  // Événements globaux
  $("theme-toggle").addEventListener("click", () => {
    const next = document.body.dataset.theme === "light" ? "dark" : "light";
    state.config.theme = next;
    applyTheme(next);
    api.saveConfig(state.config);
    sound("click");
  });

  $("sound-toggle").addEventListener("click", () => {
    state.config.sound = !(state.config.sound !== false);
    state.soundOn = state.config.sound;
    $("sound-toggle").textContent = state.soundOn ? "🔊" : "🔇";
    api.saveConfig(state.config);
    sound("click");
  });

  $("sidebar-toggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("collapsed");
    sound("click");
  });

  $("account").addEventListener("click", () => switchView("profile"));

  document.addEventListener("click", (event) => {
    const playBtn = event.target.closest("#play-btn");
    if (playBtn) play();
    const loginBtn = event.target.closest("#login-btn");
    if (loginBtn) doLogin();
    const refreshBtn = event.target.closest("#refresh-btn");
    if (refreshBtn) render();
    const roomBtn = event.target.closest("[data-room]");
    if (roomBtn) {
      state.room = state.servers[Number(roomBtn.dataset.room)];
      toast(`Salle : ${state.room.name}`);
    }
    const clearLogs = event.target.closest("#clear-logs");
    if (clearLogs) {
      api.clearLogs().then(() => render());
    }
  });

  // Horloge
  setInterval(() => {
    $("clock").textContent = new Date().toLocaleTimeString("fr-FR");
  }, 1000);
  $("clock").textContent = new Date().toLocaleTimeString("fr-FR");

  // Raccourcis
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette();
    }
    if (event.key === "Escape") closePalette();
  });

  $("palette-input")?.addEventListener("input", (event) => {
    renderPalette(event.target.value);
  });
  $("palette")?.addEventListener("click", (event) => {
    if (event.target === $("palette")) closePalette();
  });
}

boot();
