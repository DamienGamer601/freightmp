![FreightMP](<frontend/public/freightmp-banner.png>)

# 🛻 FreightMP (FMP)

> Plateforme communautaire & hub de suivi temps réel pour **Euro Truck Simulator 2** et **American Truck Simulator**.
> Projet porté par **FR | Industries Corporation (FIC)**.

FreightMP est une plateforme **complète** : site web, API, serveur multijoueur temps réel,
client de télémétrie SCS, et client 3D en jeu (scaffold).

> ⚠️ **Note d'honnêteté sur le multijoueur** : ETS2/ATS sont mono-joueur. Un vrai
> multijoueur 3D (voir les autres joueurs dans le monde) exige un mod injecté
> (comme TruckersMP/TruckLineMP/HaulMP). FreightMP fournit **toute la pile**
> (serveur UDP, télémétrie, carte live, overlay in-game) ; seule l'instance 3D
> des camions distants reste à finaliser (reverse-engineering, voir
> [`client-mod/RE-GUIDE.md`](client-mod/RE-GUIDE.md)).

---

## 🧱 Architecture

```
┌────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  frontend/     │────▶│  backend/ (API)  │────▶│  PostgreSQL      │
│  Next.js 14    │     │  Express/Prisma  │     │  (Prisma)        │
└────────────────┘     └─────────────────┘     └──────────────────┘
        │                       ▲
        │                       │ HTTP/WebSocket
        ▼                       │
┌────────────────┐     ┌───────┴─────────┐
│ telemetry-     │────▶│  mp-server/     │  UDP binaire + HTTP + WS
│ client/        │     │  (serveur MP)   │
└────────────────┘     └─────────────────┘
        ▲                       ▲
        │ SCS SDK               │ UDP
┌────────────────┐     ┌────────┴────────┐
│  Jeu ETS2/ATS  │     │  client-mod/    │  DLL injectée (overlay, entités)
└────────────────┘     └─────────────────┘
```

| Dossier | Rôle |
|---|---|
| `backend/` | API REST + WebSocket (Node.js/TS, Express, Prisma, PostgreSQL) |
| `frontend/` | Application web (Next.js 14, React, Tailwind) |
| `discord-bot/` | Bot Discord (rôles + `/status`) |
| `mp-server/` | **Serveur multijoueur** (lobby HTTP, UDP binaire, tick 20 Hz, auth JWT) |
| `telemetry-client/` | Client de télémétrie SCS → API + serveur MP |
| `client-mod/` | Client 3D en jeu (DLL + injecteur + launcher + overlay D2D) |
| `launcher/` | **Launcher desktop** (Electron) — serveurs, jeton MP, bouton « Jouer » |

---

## ✨ Fonctionnalités

### Site web (`frontend/`)
- **Landing page** avec statut des serveurs, annonces et fonctionnalités.
- **Profil** : bannière, bio, titre, couleur d'accent, niveau/XP, badges, activité, répartition ETS2/ATS, livraisons paginées, VTC, sanctions.
- **Profil public** partageable `/p/<pseudo>`.
- **Carte live** (MapLibre) avec télémétrie temps réel.
- **Mon espace** (`/dashboard`) : stats, raccourcis, activité.
- **VTC** : annuaire, page publique, rejoindre/quitter, gestion par le propriétaire.
- **Classement** (`/leaderboard`).
- **Amis** (`/friends`) : demandes, acceptation, retrait.
- **Messages** (`/messages`) : conversations privées.
- **Notifications** (`/notifications`) avec cloche + badge.
- **Événements** (`/events`) : convois, inscriptions.
- **Multijoueur** (`/multiplayer`) : salles live, joueurs, mini-carte temps réel.
- **Admin** (`/admin`) : dashboard, utilisateurs, sanctions, serveurs, VTC, annonces, événements, journal d'audit.

### API (`backend/`)
- OAuth2 **Steam + Discord** (cookies HttpOnly, refresh tokens).
- 20+ modèles/routes (voir référence API ci-dessous).
- WebSocket temps réel (`/ws`) : télémétrie + chat.

### Multijoueur (`mp-server/` + `telemetry-client/` + `client-mod/`)
- **Serveur MP** : UDP binaire, tick 20 Hz, anti-triche (séquence/vitesse/téléportation), auth JWT.
- **Client télémétrie** : lit le jeu via `scs-sdk-plugin` → API + serveur MP.
- **Client 3D** : injecteur + DLL + hook D3D11 + overlay (panneau + radar) + `EntityManager`.

---

## 🚀 Démarrage rapide

### Prérequis
- **Node.js 20+**, **npm**
- **PostgreSQL 16** (ou Docker)
- Optionnel : **Steam API key**, application **Discord**, **VS Build Tools** (client-mod)

### 1. Base de données
```powershell
# Service local (PostgreSQL installé) ou Docker :
docker run --name fmp-postgres -e POSTGRES_USER=freightmp -e POSTGRES_PASSWORD=freightmp -e POSTGRES_DB=freightmp -p 5432:5432 -d postgres:16-alpine
```

### 2. API
```powershell
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev          # http://localhost:4000
```

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### 4. Serveur multijoueur
```powershell
cd mp-server
npm install
$env:MP_JWT_SECRET = "<JWT_SECRET du backend>"
npm run dev          # UDP :5000 / HTTP+WS :5001
```

### 5. (Optionnel) Télémétrie + multijoueur
```powershell
cd telemetry-client
npm install
$env:FMP_MP = "1"
npm run dev          # jeu réel  → API + serveur MP
# ou : npm run mock  # sans jeu
```

### 6. (Optionnel) Bot Discord
```powershell
cd discord-bot
npm install
npm run register
npm run dev
```

### 7. (Optionnel) Client 3D en jeu
```powershell
cd client-mod
.\build.ps1          # DLL + injecteur (MSVC x64)
cd launcher
node index.js ets2 --room <roomId> --token <jetonMP>
```

### 8. (Optionnel) Launcher desktop (Electron)
```powershell
cd launcher
npm install
npm start            # interface : serveurs, jeton MP, bouton JOUER
```

---

## 🐳 Docker (tout-en-un)

```bash
docker compose up --build
```

Services : `postgres` (:5432), `api` (:4000), `web` (:3000),
`mp` (UDP :5000 / HTTP+WS :5001), `bot`.

Puis peupler la base :
```bash
docker compose exec api npx prisma db seed
```

---

## ✅ Validation

```powershell
node scripts\smoke.mjs
```

Vérifie l'API publique, les endpoints admin (si `SMOKE_ADMIN_TOKEN` est fourni)
et le serveur MP (health, rooms, pont WebSocket). Sortie attendue :
`13 OK, 0 échec(s)`.

---

## 🌐 Référence API

Base : `http://localhost:4000/api/v1`

### Auth & profil
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | État du service |
| GET | `/auth/steam` / `/auth/discord` | — | OAuth redirection |
| GET | `/auth/*/callback` | — | Callback → cookies |
| POST | `/auth/refresh` / `/auth/logout` | cookie | Session |
| GET | `/me` | auth | Profil + stats + livraisons + VTC + bans |
| PATCH | `/me` | auth | Changer le pseudo |
| PATCH | `/me/profile` | auth | Bio / bannière / titre / accent |
| GET | `/me/deliveries` | auth | Livraisons paginées + filtres |

### Public
| GET | `/servers/status` | — | Statut des serveurs |
| GET | `/telemetry` | — | Snapshot télémétrie |
| POST | `/telemetry` | — | **Réception télémétrie** |
| GET | `/players/:id` | — | Profil par id |
| GET | `/profiles/:username` | — | Profil public |
| GET | `/leaderboard` | — | Classement |
| GET | `/announcements` | — | Annonces publiées |
| GET | `/events` | — | Événements publiés |

### VTC / amis / messages / notifications / événements
| Routes | Description |
|---|---|
| `GET/POST /vtcs`, `GET /vtcs/:id`, `POST /vtcs/:id/join`, `DELETE /vtcs/:id/leave` | VTC |
| `PATCH/DELETE /vtcs/:id`, `POST/PATCH/DELETE /vtcs/:id/members/...` | Gestion propriétaire |
| `GET /friends`, `GET /friends/status/:username`, `POST /friends/requests`, `POST /friends/requests/:id/accept|decline`, `DELETE /friends/:friendId` | Amis |
| `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | Notifications |
| `GET /messages/conversations`, `GET/POST /messages/:username` | Messagerie |
| `GET/POST /events/:id/join`, `DELETE /events/:id/join`, `GET /events/mine` | Événements |
| `POST /mp/token` | Jeton MP signé |

### Admin (ADMIN/MODERATOR)
| Routes | Description |
|---|---|
| `GET /admin/dashboard` | Stats + activité récente |
| `GET /admin/users`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id` | Utilisateurs |
| `GET/POST /admin/bans`, `POST /admin/bans/:id/revoke` | Sanctions |
| `GET/POST /admin/servers`, `PATCH/DELETE /admin/servers/:id` | Serveurs |
| `GET/POST /admin/announcements`, `PATCH/DELETE /admin/announcements/:id` | Annonces |
| `GET/POST /admin/events`, `PATCH/DELETE /admin/events/:id` | Événements |
| `GET/DELETE /admin/vtcs/:id` | VTC |
| `GET /admin/audit-log` | Journal d'audit |

### Interne (bot)
`GET /internal/roles` (+ `x-internal-key`), `POST /internal/servers/heartbeat`.

---

## 🗄️ Modèle de données

`User`, `Server`, `Delivery`, `Ban`, `VTC`, `VTC_Affiliation`, `RefreshToken`,
`AuditLog`, `Announcement`, `Notification`, `Friendship`, `Message`, `Event`,
`EventParticipant`.

---

## 🎮 Pile multijoueur

| Composant | Doc |
|---|---|
| Serveur MP (protocole, auth, binaire) | [`mp-server/README.md`](mp-server/README.md) |
| Client télémétrie (SCS SDK, jeu réel) | [`telemetry-client/README.md`](telemetry-client/README.md) |
| Client 3D (injecteur, DLL, overlay) | [`client-mod/README.md`](client-mod/README.md) |
| Guide reverse-engineering | [`client-mod/RE-GUIDE.md`](client-mod/RE-GUIDE.md) |

### Client in-game (overlay)

Une fois la DLL injectée (jeu lancé) :

| Touche | Action |
|---|---|
| **TAB** | Panneau des joueurs (ID, pays, tag, pseudo, ping, distance, vitesse) |
| **↑ / ↓** | Sélectionner un joueur |
| **M** | Mute / unmute le joueur sélectionné |
| **Y** | Ouvrir le chat |
| **Entrée** | Envoyer le message |
| **Échap** | Fermer / annuler |

Le client lit la position du camion via le **SDK SCS** et affiche un **radar** +
le **chat** + le **panneau TAB**. Les **camions 3D** restent à implémenter (RE).

---

## 🎨 Charte graphique

| Token | Hex |
|---|---|
| `charbon-900` | `#0B0E11` |
| `charbon-800` | `#111418` |
| `carbone-700` | `#23272B` |
| `rouge-500` | `#E23A3A` |
| `rouge-600` | `#C62F2F` |

---

## ⚠️ Avertissement

FreightMP est un projet communautaire indépendant, **non affilié** à SCS Software.
Le client 3D modifie le jeu : usage personnel uniquement, ne diffuse pas de binaire patché.
