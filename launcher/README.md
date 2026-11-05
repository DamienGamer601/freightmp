# FreightMP Launcher — le hub tout-en-un

Launcher desktop (Electron) qui centralise **tout FreightMP** : multijoueur,
profil, amis, messages, compagnie, événements, classement, actus — et lance le
jeu + injecte le client.

## Identité (différenciation TruckLineMP / HaulMP)

- **Sidebar à menus déroulants** (groupes repliables) plutôt qu'une navigation plate.
- **Palette de commandes `Ctrl+K`** pour aller à n'importe quelle page.
- **Dashboard de widgets** (km, livraisons, temps de jeu, joueurs en ligne).
- **Thème sombre / clair** + fond de particules animé.
- **Sons** d'interface (synthèse Web Audio, sans fichiers).
- **Bandeau de mise à jour** intégré.

## Pages disponibles

| Groupe | Pages |
|---|---|
| **Accueil** | Dashboard (widgets, serveurs, joueurs, amis, fréquentation) |
| **Multijoueur** | Serveurs · Joueurs en ligne · Carte live |
| **Mon compte** | Profil · Statistiques · Notifications |
| **Communauté** | Amis · Messages · Ma compagnie |
| **Événements** | Événements · Classement |
| — | Actualités · Réglages |

## Fonctionnalités

| Fonction | Détail |
|---|---|
| **Connexion** | Fenêtre Steam/Discord embarquée → jeton MP + avatar + tag + pays |
| **Liste des salles** | Serveurs MP live, joueurs/max, barre de progression |
| **Joueurs en ligne** | Liste temps réel (rafraîchissement 8 s) |
| **JOUER** | Lance le jeu + injecte `fmp-client.dll` |
| **Profil / stats** | Données de l'API (session web) |
| **Notifications / amis / messages / VTC / événements / classement** | Toutes les données du site |
| **Mise à jour** | Compare à `update.json` (local) ou `FMP_UPDATE_URL` |

## Prérequis

- **Node.js 20+**
- Client compilé : `client-mod/build/fmp-client.dll` + `injector.exe`
- Serveur MP lancé (`mp-server`, ports 5000/5001)
- API + site lancés (`backend` :4000, `frontend` :3000)

## Lancer

```powershell
cd C:\Users\damie\Desktop\FreightMP\launcher
npm install
npm start
```

> `npm start` passe par `start.ps1`, qui retire `ELECTRON_RUN_AS_NODE`
> (souvent défini par l'environnement, sinon Electron tourne en Node pur et
> le launcher plante).

## Raccourcis

| Raccourci | Action |
|---|---|
| `Ctrl+K` | Palette de commandes |
| `↑ / ↓` (palette) | Naviguer |
| `Échap` | Fermer la palette |

## Variables d'environnement

| Variable | Défaut |
|---|---|
| `FMP_API_URL` | `http://localhost:4000` |
| `FMP_MP_URL` | `http://localhost:5001` |
| `FMP_SITE_URL` | `http://localhost:3000` |
| `FMP_UPDATE_URL` | (optionnel) URL de `update.json` distant |

## Mise à jour

1. Bump `launcher/package.json`.
2. Édite `../update.json` : `{ "version": "1.0.x", "notes": "...", "url": "..." }`.
3. Les launchers afficheront le bandeau au prochain démarrage.
