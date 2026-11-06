# Panneau admin in-game (F8)

Panneau d'administration intégré à l'overlay Direct2D du client FreightMP.
Il permet de modérer une salle et de changer l'environnement partagé **sans
quitter le jeu**.

## Où le trouver

| Élément | Emplacement |
|---|---|
| Touche d'ouverture | **F8** (uniquement si `role` = `ADMIN` ou `MODERATOR`) |
| Rendu | `client-mod/dll/overlay.cpp` → `drawAdminPanel()` |
| Logique clavier | `client-mod/dll/core.cpp` → `AdminPanelThread()` |
| API publique | `client-mod/dll/core.h` (section « Panneau admin in-game ») |

## Commandes

| Touche | Action |
|---|---|
| **F8** | Ouvrir / fermer le panneau |
| **↑ / ↓** | Sélectionner un joueur |
| **← / →** | Sélectionner une action |
| **Entrée** | Exécuter l'action |
| **Échap** | Fermer |

## Actions disponibles

| # | Action | Effet |
|---|---|---|
| 0 | Expulser le joueur sélectionné | Envoie `kick` (refusé si la cible est `ADMIN` et l'auteur `MODERATOR`) |
| 1 | **Bannir le joueur sélectionné** | Envoie `ban` → ban permanent en base + expulsion immédiate |
| 2 | Météo : clair | `set-environment { weather: "clear" }` |
| 3 | Météo : pluie | `set-environment { weather: "rain" }` |
| 4 | Météo : brouillard | `set-environment { weather: "fog" }` |
| 5 | Météo : neige | `set-environment { weather: "snow" }` |
| 6 | Heure +1 h | `time { delta: 60 }` |
| 7 | Heure -1 h | `time { delta: -60 }` |
| 8 | Annonce | Ouvre la saisie du chat en mode annonce (diffusion à toute la salle) |

> Le **ban** exige que la cible soit authentifiée (jeton MP → `userId` connu)
> et que le serveur MP puisse joindre l'API FreightMP.

## Protocole (UDP, JSON)

### Client → Serveur

```jsonc
{ "t": "kick",     "target": 42 }              // numId du joueur
{ "t": "ban",      "target": 42, "reason": "…" }
{ "t": "announce", "message": "Convoi dans 5 min" }
{ "t": "time",     "delta": 60 }               // minutes
{ "t": "set-environment", "weather": "rain", "timeOfDay": 720 }
```

### Serveur → Client

```jsonc
{ "t": "players",  "players": [{ "n": 42, "u": "Damien", "p": 30, "g": "FIC", "c": "FR", "r": "ADMIN" }] }
{ "t": "join-ok",  "numId": 42, "role": "ADMIN", ... }
{ "t": "admin-ok", "action": "kick", "detail": "Joueur 42 expulsé" }
{ "t": "kicked",   "reason": "Expulsé par un administrateur" }
{ "t": "error",    "reason": "Réservé aux admins" }
```

## Garde-fous côté serveur

Le serveur refuse systématiquement les commandes d'un joueur non admin :

```ts
if (player.role !== "ADMIN" && player.role !== "MODERATOR") {
  this.sendTo(rinfo, { t: "error", reason: "Réservé aux admins" });
  break;
}
```

Règles supplémentaires :

- un `MODERATOR` **ne peut pas** expulser un `ADMIN` ;
- un joueur **ne peut pas** s'expulser lui-même ;
- la raison d'expulsion est limitée à 120 caractères ;
- une annonce est limitée à 200 caractères.

## Vérification

```powershell
cd client-mod\build
cmd /c build.bat          # → fmp-client.dll
cmd /c test.bat           # → TOUS LES TESTS PASSENT
cd ..\..\mp-server
npm run build && npm test # → 12/12 tests
```

## Limites connues

- **Pas de téléportation** (dépend de la couche entités, dont le
  reverse-engineering n'est pas terminé).
- Un ban ne peut viser qu'un joueur **authentifié** (jeton MP). Les joueurs
  anonymes ne peuvent être qu'expulsés.
- L'expulsion retire le joueur de la salle ; son client reçoit `kicked` mais ne
  se déconnecte pas automatiquement de l'UI.
- Si l'API FreightMP est injoignable, le serveur MP **refuse** le ban (aucun ban
  fantôme) et renvoie une erreur à l'admin.
