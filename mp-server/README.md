# FreightMP — serveur multijoueur (socle)

Serveur de jeu multijoueur autonome : **plan de contrôle HTTP** (lobby/salles) +
**plan de données UDP** (état des joueurs) + **boucle de tick** et validation.

> C'est le **socle serveur**. Le client « en jeu » (injection dans ETS2/ATS)
> reste à construire séparément — c'est un projet de reverse-engineering
> (voir la note en bas).

## Lancer

```powershell
cd C:\Users\damie\Desktop\FreightMP\mp-server
npm install
npm run dev
```

Sortie attendue :

```
[MP] UDP sur 0.0.0.0:5000
[MP] HTTP sur 0.0.0.0:5001
[MP] Tick : 20 Hz
```

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `MP_UDP_PORT` | `5000` | Port du plan de données (UDP) |
| `MP_HTTP_PORT` | `5001` | Port du plan de contrôle (HTTP) |
| `MP_TOKEN` | — | Token partagé simple (LAN privé) |
| `MP_JWT_SECRET` | — | Secret JWT (doit être **identique** au `JWT_SECRET` du backend) |
| `MP_REQUIRE_AUTH` | `0` | `1` = jeton MP obligatoire pour rejoindre |
| `MP_TICK_RATE` | `20` | Fréquence du tick (Hz) |

## Authentification (compte FreightMP)

Le serveur peut vérifier un **jeton MP** (JWT signé par l'API FreightMP) :

1. Le joueur se connecte au site, puis **page `/multiplayer` → « Générer mon jeton »**
   (ou `POST /api/v1/mp/token` avec son cookie/Bearer).
2. Il lance le client avec le jeton :
   ```powershell
   $env:MP_TOKEN = "<jeton>"
   npm run client
   ```
3. Le serveur MP vérifie le JWT et associe le joueur à son **pseudo + rôle** ;
   le nom apparaît dans la salle. Un jeton invalide est **refusé**.

Côté serveur MP, il faut le même secret :
```powershell
$env:MP_JWT_SECRET = "<JWT_SECRET du backend>"
npm run dev
```

## Plan de contrôle (HTTP)

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/health` | État du serveur |
| `GET` | `/rooms` | Liste des salles (joueurs, capacité, jeu) |
| `POST` | `/rooms` | Créer une salle `{ name, game, maxPlayers }` |
| `GET` | `/rooms/:id` | Détail d'une salle + joueurs |
| `DELETE` | `/rooms/:id` | Supprimer une salle |

Exemple :

```powershell
Invoke-RestMethod http://localhost:5001/rooms
Invoke-RestMethod http://localhost:5001/rooms -Method Post -ContentType "application/json" -Body '{"name":"Soirée convoi","game":"ETS2","maxPlayers":50}'
```

## Plan de données (UDP)

Le plan de données est **hybride** :

- **JSON** pour les messages de contrôle (faible fréquence) : `join`, `leave`,
  `ping`, `pong`, `join-ok`, `join-err`, `error`.
- **Binaire compact** pour la haute fréquence : `state` (client→serveur) et
  `snapshot` (serveur→client).

Détection des messages : le **1er octet** vaut `0x7B` (`{`) → JSON, sinon
binaire (`0x10` = state, `0x20` = snapshot).

### `state` (client → serveur) — 17 octets

| Offset | Taille | Champ |
|---|---|---|
| 0 | 1 | type `0x10` |
| 1 | 4 | `seq` (uint32 LE) |
| 5 | 4 | `x` (float LE) |
| 9 | 4 | `z` (float LE) |
| 13 | 2 | `heading` (uint16 LE, 0.01°) |
| 15 | 2 | `speed` (uint16 LE, 0.1 km/h) |

### `snapshot` (serveur → client)

| Offset | Taille | Champ |
|---|---|---|
| 0 | 1 | type `0x20` |
| 1 | 4 | `tick` (uint32 LE) |
| 5 | 8 | `serverTime` (double LE) |
| 13 | 2 | `count` (uint16 LE) |
| 15 | 14 × count | joueurs |

Chaque joueur (14 octets) : `numId` (uint16) + `x` (float) + `z` (float) +
`heading` (uint16) + `speed` (uint16).

> Gain typique : une snapshot 2 joueurs passe de ~200 octets (JSON) à
> **43 octets** (binaire).

### Interpolation côté client

Le client de référence conserve un tampon de snapshots et **interpole** les
positions des autres joueurs (rendu ~100 ms en arrière) pour un mouvement
fluide, même à 20 Hz.

### Messages de contrôle (JSON)

```ts
{ t: "join", roomId, truckId?, token? }
{ t: "leave" }
{ t: "ping", ts }
{ t: "join-ok", playerId, numId, roomId, tick }
{ t: "join-err", reason }
{ t: "pong", ts }
```

### Règles serveur

- **Tick** : snapshot diffusé à 20 Hz à tous les joueurs de la salle.
- **Anti-rejeu** : `seq` doit être strictement croissant.
- **Anti-téléportation** : `MAX_STEP_PER_UPDATE` (500 u. de jeu) par mise à jour.
- **Vitesse** : plafonnée à `MAX_SPEED_KMH` (200 km/h).
- **Timeout** : un joueur sans mise à jour pendant 15 s est retiré.

## Client de référence

```powershell
# Dans un autre terminal (2× pour tester deux joueurs) :
cd C:\Users\damie\Desktop\FreightMP\mp-server
npm run client
```

Il rejoint la première salle, envoie un état mock à 10 Hz, et affiche les autres
joueurs (positions, vitesse, ping).

Variables : `MP_HOST`, `MP_UDP_PORT`, `MP_HTTP_PORT`, `MP_ROOM`, `MP_TOKEN`,
`MP_TRUCK_ID`.

## Ce qui reste à faire (client en jeu)

Pour que les camions se voient **dans le jeu 3D**, il faut un **client modifié** :

1. **Hook du jeu** : DLL C++ injectée dans `eurotrucks2.exe` (hooks mémoire,
   lecture/écriture de la physique).
2. **Sync** : envoyer l'état local au serveur (via `MP_TRUCK_ID` + `state`) et
   appliquer les états reçus aux camions des autres (spawn/render).
3. **Anti-triche** : intégrité client + validation serveur (déjà amorcée ici).
4. **Launcher** : sign-in Steam + lancement du client patché.

C'est le même type de travail que TruckersMP/TruckLineMP (des mois de
reverse-engineering, à refaire à chaque mise à jour du jeu). Le socle serveur
présent est **réutilisable tel quel** pour ce client.
