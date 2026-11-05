# Déploiement de l'API FreightMP

L'API est déjà **dockerisée** (`Dockerfile`) avec `prisma migrate deploy` au
démarrage. Ce guide couvre Railway (recommandé) et Render.

> Le frontend est sur **Vercel** : https://freightmp.vercel.app
> L'API doit être accessible en **HTTPS public** pour que Steam/Discord
> puissent rediriger vers elle.

---

## Prérequis

1. Un dépôt **GitHub** contenant le projet (le dossier `backend` sera la racine
   du service).
2. Une base **PostgreSQL** managée (Railway/Render la fournissent).
3. Les identifiants OAuth :
   - **Discord** → Developer Portal → ton app → OAuth2.
   - **Steam** → clé Web API (`STEAM_API_KEY`).

---

## Option A — Railway (recommandé)

1. **railway.app** → *New Project* → *Deploy from GitHub repo* → choisis le dépôt.
2. Dans le service, **Settings → Build** :
   - Builder : **Dockerfile**
   - Dockerfile path : `backend/Dockerfile`
   - Root directory : `backend`
3. **Settings → Networking** → *Generate Domain* → note l'URL
   (`https://<service>.up.railway.app`).
4. **New → Database → PostgreSQL** (dans le même projet).
5. Sur le service API, **Variables** :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (référence Railway) |
| `JWT_SECRET` | une chaîne aléatoire longue |
| `INTERNAL_API_KEY` | une autre chaîne aléatoire |
| `FRONTEND_URL` | `https://freightmp.vercel.app` |
| `API_URL` | `https://<service>.up.railway.app` |
| `CORS_ORIGINS` | `https://freightmp.vercel.app` |
| `STEAM_API_KEY` | ta clé Steam |
| `STEAM_RETURN_URL` | `https://<service>.up.railway.app/api/v1/auth/steam/callback` |
| `DISCORD_CLIENT_ID` | ton client ID Discord |
| `DISCORD_CLIENT_SECRET` | ton secret Discord |
| `DISCORD_RETURN_URL` | `https://<service>.up.railway.app/api/v1/auth/discord/callback` |

6. Déploie. Le fichier `railway.json` fournit déjà le healthcheck
   `/api/v1/health` et la commande de démarrage.

> ⚠️ Railway gère **HTTP/WS** mais pas l'UDP : le serveur multijoueur
> (`mp-server`, UDP 5000) devra être hébergé sur un **VPS** (OVH, Hetzner…).

---

## Option B — Render (blueprint)

1. Pousse le dépôt sur GitHub.
2. Render → *New → Blueprint* → sélectionne le dépôt.
3. Render lit `backend/render.yaml` : il crée le service **freightmp-api** et la
   base **freightmp-db**.
4. Renseigne les variables `sync: false` dans le dashboard
   (`STEAM_API_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`).
5. Vérifie l'URL : `https://freightmp-api.onrender.com`
   (adaptée automatiquement dans `render.yaml` si tu gardes ce nom).

> Le plan gratuit Render met le service en veille après inactivité → le premier
> appel peut prendre ~30 s.

---

## Brancher le frontend (Vercel)

1. Vercel → projet **freightmp** → *Settings → Environment Variables*.
2. Ajoute `NEXT_PUBLIC_API_URL` = `https://<ton-api>` (Railway ou Render).
3. Redéploie :
   ```powershell
   cd frontend
   vercel --prod
   ```

> `NEXT_PUBLIC_API_URL` est **inliné au build** : il faut toujours redéployer
> après un changement.

---

## Mettre à jour les redirections OAuth

### Discord

Developer Portal → ton app → **OAuth2 → Redirects** :

```
https://<ton-api>/api/v1/auth/discord/callback
```

### Steam

Pas de liste blanche, mais `STEAM_RETURN_URL` doit pointer sur :

```
https://<ton-api>/api/v1/auth/steam/callback
```

---

## Vérification

```powershell
# Santé
Invoke-RestMethod https://<ton-api>/api/v1/health

# OpenAPI
Invoke-RestMethod https://<ton-api>/api/v1/openapi.json

# Frontend
Invoke-WebRequest https://freightmp.vercel.app -UseBasicParsing
```

Puis sur le site : **Se connecter avec Steam** → tu dois revenir sur
`https://freightmp.vercel.app/auth/callback` connecté.

---

## Serveur multijoueur (rappel)

| Brique | Hébergement |
|---|---|
| Frontend | Vercel ✅ |
| API | Railway / Render |
| PostgreSQL | Railway / Render |
| **Serveur MP (UDP 5000 + WS 5001)** | **VPS dédié** |

Sur le VPS, ajoute le secret JWT partagé :

```bash
MP_JWT_SECRET=<même JWT_SECRET que l'API>
```

puis `npm run build && npm start` dans `mp-server`.
