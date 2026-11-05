# Tester FreightMP depuis le PC de bureau (ASUS01)

Le **jeu** (ETS2/ATS) est sur le PC de bureau. Le **client de télémétrie** doit donc
y tourner ; les **services** (API, site, serveur MP) tournent sur le **laptop**
(`192.168.1.58`).

```
PC de bureau (192.168.1.73)                    Laptop (192.168.1.58)
┌──────────────────────────┐     LAN     ┌──────────────────────────┐
│  Jeu ETS2/ATS            │             │  API :4000               │
│  + scs-telemetry.dll     │             │  Site :3000              │
│  + client télémétrie     │────────────▶│  Serveur MP :5000/:5001  │
└──────────────────────────┘             └──────────────────────────┘
```

## 0. Prérequis sur le PC de bureau

- **Node.js v25** (même version que le laptop) — <https://nodejs.org>
  > Le module natif `scsSDKTelemetry.node` a été compilé pour **Node v25.6.1**.
  > Avec une autre version, `npm install` devra recompiler (nécessite VS Build Tools).
- Le jeu installé.

## 1. Transférer le client

Copier tout le dossier **`telemetry-client`** (AVEC `node_modules`) du laptop vers
le bureau :
- via un **partage réseau** (partager `FreightMP` sur le laptop puis `\\192.168.1.58\...`),
- ou une **clé USB** / archive ZIP.

## 2. Installer le plugin SCS sur le jeu du bureau

Copier **`tools\scs-plugin\scs-telemetry.dll`** dans :

```
<jeu>\bin\win_x64\plugins\scs-telemetry.dll
```

- ETS2 : `C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\plugins\`
- ATS : `...\American Truck Simulator\bin\win_x64\plugins\`

## 3. Récupérer le jeton MP (sur le laptop)

Sur le laptop : <http://localhost:3000/multiplayer> → se connecter → **« Générer mon
jeton »** → **Copier**.

## 4. Lancer le client sur le PC de bureau

```powershell
cd <chemin>\telemetry-client
$env:FMP_API_URL   = "http://192.168.1.58:4000"
$env:MP_HOST       = "192.168.1.58"
$env:MP_UDP_PORT   = "5000"
$env:MP_HTTP_PORT  = "5001"
$env:MP_TOKEN      = "<jeton copié>"
$env:FMP_MP        = "1"
$env:FMP_GAME      = "ETS2"
$env:FMP_TRUCK_ID  = "damiengamer60"
npm run dev
```

Sortie attendue :
```
[FMP] Client de télémétrie FreightMP — ETS2 — camion damiengamer60
[FMP] [MP] Lien multijoueur activé (192.168.1.58:5000)
[MP] Rejoint la salle « FMP EU #1 » (numId=1)
```

> Sans le jeu, tester d'abord avec `npm run mock`.

## 5. Vérifier (sur le laptop)

- <http://localhost:3000/map> → ton camion apparaît.
- <http://localhost:3000/multiplayer> → la salle + ton pseudo.

## 6. (Optionnel) Voir le site depuis le bureau

Ouvrir <http://192.168.1.58:3000> — le frontend **détecte automatiquement** l'IP
de l'API et du serveur MP depuis l'hôte courant.

> La connexion OAuth (Steam/Discord) depuis le bureau nécessite de configurer les
> URLs de callback sur l'IP LAN. Le plus simple : générer le jeton MP depuis le
> laptop et le copier sur le bureau.

## Dépannage

| Symptôme | Piste |
|---|---|
| `Cannot find module '...scsSDKTelemetry.node'` | Node n'est pas v25 → réinstaller Node v25 **ou** `npm install` (avec Build Tools) |
| `Impossible de charger 'trucksim-telemetry'` | Plugin `scs-telemetry.dll` absent de `bin\win_x64\plugins\` |
| Aucune position | Le jeu doit être **en partie** (pas le menu) |
| `Impossible de rejoindre le serveur MP` | Vérifier `MP_HOST=192.168.1.58`, serveur MP lancé, port 5001 ouvert |
| Rien sur `/multiplayer` | Vérifier `FMP_MP=1` et le jeton |
