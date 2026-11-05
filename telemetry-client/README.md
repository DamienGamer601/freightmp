# FreightMP — client de télémétrie

Relie **ETS2 / ATS** au serveur FreightMP : le camion du joueur apparaît en
direct sur la carte partagée (`/map`) via la télémétrie du jeu.

## ⚠️ Ce que c'est (et ce que ce n'est pas)

ETS2/ATS sont des jeux **mono-joueur** : il n'existe pas de « vrai » serveur
multijoueur custom (les joueurs ne se voient pas dans le monde 3D). Ce client
implémente le **suivi télémétrique** : position, vitesse, carburant et cargo sont
envoyés au serveur, qui les diffuse sur la carte / aux convois.

> C'est un « multijoueur de carte » (se voir sur la carte, coordonner un convoi),
> pas un monde 3D partagé.

## 1. Installer le plugin SCS

Le client lit la télémétrie via le plugin **`scs-telemetry.dll`**
(release RenCloud `V.1.12.1`). Il doit être placé dans :

```
<jeu>/bin/win_x64/plugins/scs-telemetry.dll
```

- ETS2 : `C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\plugins\`
- ATS  : `C:\Program Files (x86)\Steam\steamapps\common\American Truck Simulator\bin\win_x64\plugins\`

*(Déjà installé sur cette machine.)*

## 2. Installer les dépendances

```powershell
cd C:\Users\damie\Desktop\FreightMP\telemetry-client
npm install
```

> `trucksim-telemetry` est un module natif : il faut les **Build Tools C++**
> (Visual Studio). Déjà présents sur cette machine.

## 3. Lancer le client

```powershell
# Test sans jeu (télémétrie synthétique) :
npm run mock

# Avec le jeu (ETS2/ATS lancé) :
npm run dev
```

Le client se connecte au WebSocket `ws://localhost:4000/ws` et envoie la
télémétrie toutes les 500 ms (repli HTTP automatique sur
`POST /api/v1/telemetry`).

## 4. Configuration (variables d'environnement)

| Variable | Défaut | Rôle |
|---|---|---|
| `FMP_API_URL` | `http://localhost:4000` | URL de l'API |
| `FMP_GAME` | `ETS2` | `ETS2` ou `ATS` |
| `FMP_TRUCK_ID` | aléatoire | Identifiant du camion |
| `FMP_INTERVAL_MS` | `500` | Intervalle d'envoi (ms) |
| `FMP_DEBUG` | — | `1` pour logguer les envois |

Exemple :

```powershell
$env:FMP_GAME = "ATS"
$env:FMP_TRUCK_ID = "damiengamer60"
npm run dev
```

## 5. Vérifier

- Ouvre **http://localhost:3000/map** → le camion doit apparaître.
- `GET http://localhost:4000/api/v1/telemetry` → renvoie le snapshot des camions
  actifs (TTL 30 s).

## 6. (Option) Publier dans une salle multijoueur

Active le lien vers le serveur MP (`mp-server`) :

```powershell
$env:FMP_MP = "1"
$env:MP_TOKEN = "<jeton MP généré sur http://localhost:3000/multiplayer>"
npm run dev     # ou npm run mock
```

Le camion apparaît alors **aussi** sur http://localhost:3000/multiplayer, dans la
salle « FMP EU #1 » (position, vitesse, pseudo).

## Dépannage

- **`trucksim-telemetry` ne charge pas** → vérifie que le plugin est bien dans
  `bin/win_x64/plugins/` et que le jeu est lancé.
- **Aucune position** → le client ignore les trames sans `x`/`z` ; attends que le
  jeu soit en partie (pas dans le menu).
- **Rien sur la carte** → vérifie que l'API tourne (`http://localhost:4000/api/v1/health`).
