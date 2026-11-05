# FreightMP — client in-game (ETS2 / ATS)

Injection dans le jeu + connexion au serveur multijoueur FreightMP + **overlay
in-game** (panneau joueurs, chat, radar).

> ⚠️ **Portée honnête** : ce client livre **toute la plomberie** (launcher,
> injecteur, DLL, réseau, overlay, panneau TAB, chat, radar) et lit la position
> réelle du camion via le SDK SCS. Le **rendu 3D des camions distants** reste à
> faire : il exige le reverse-engineering du moteur (voir `RE-GUIDE.md`).

## Fonctionnalités

| Élément | État |
|---|---|
| Launcher + injecteur (LoadLibraryW) | ✅ |
| DLL + réseau UDP binaire + auth JWT | ✅ |
| Réception des joueurs (snapshots, interpolation) | ✅ |
| Hook `IDXGISwapChain::Present` (D3D11) | ✅ |
| Lecture position locale (`getLocalTruck`) | ✅ SDK SCS (shared memory) |
| **Overlay D2D** (panneau + radar) | ✅ |
| **Panneau TAB** (ID, pays, tag, pseudo, ping, distance, vitesse, mute) | ✅ |
| **Chat in-game** (Y, Entrée, Échap) | ✅ |
| **Mute par joueur** (sélection ↑/↓ + M) | ✅ |
| Spawn / rendu **3D** des camions | ⬜ reverse-engineering (`EntityManager` + `IGameAdapter` prêts) |

## Commandes in-game

| Touche | Action |
|---|---|
| **TAB** | Ouvrir / fermer le panneau des joueurs |
| **↑ / ↓** | Sélectionner un joueur (panneau ouvert) |
| **M** | Mute / unmute le joueur sélectionné |
| **Y** | Ouvrir le chat |
| **Entrée** | Envoyer le message |
| **Échap** | Fermer / annuler |

## Architecture

```
launcher (Node) ──▶ lance eurotrucks2.exe / amtrucks.exe
        │
        └──▶ injector.exe <pid> fmp-client.dll
                     │
                     └──▶ DLL fmp-client.dll
                             ├── network (UDP binaire) ⇄ mp-server
                             ├── snapshots → joueurs distants (+ interpolation)
                             ├── getLocalTruck() (SDK SCS, shared memory)
                             ├── overlay D2D (panneau, TAB, chat, radar)
                             └── hooks clavier (TAB, Y, mute)
```

## Compiler

```powershell
cd C:\Users\damie\Desktop\FreightMP\client-mod
.\build.ps1
```

Produit `build\fmp-client.dll` et `build\injector.exe` (MSVC x64).

## Lancer

```powershell
# 1. Serveur MP démarré (mp-server, UDP :5000)
# 2. Récupère l'id de salle :  GET http://localhost:5001/rooms
cd C:\Users\damie\Desktop\FreightMP\client-mod\launcher
node index.js ets2 --room <roomId> --token <jetonMP> --truck-id <pseudo>
```

Le launcher démarre le jeu, attend l'injection, puis la DLL se connecte à la salle.

## Roadmap RE (la partie 3D)

| # | Tâche | Fichier / hook |
|---|---|---|
| 1 | Lire la position du camion local | ✅ `getLocalTruck()` (SDK SCS) |
| 2 | Trouver la liste d'entités camions du monde | reverse (IDA/Ghidra, pattern scan) |
| 3 | Appeler la fonction de spawn d'un camion | `IGameAdapter::create()` |
| 4 | Positionner l'entité distante (coordonnées + cap) | `IGameAdapter::update()` |
| 5 | Détruire l'entité à la déconnexion | `IGameAdapter::destroy()` |
| 6 | Anti-triche / intégrité client | launcher |

> Ces tâches sont **spécifiques à chaque version du jeu** et doivent être
> refaites à chaque mise à jour. C'est le même travail que TruckersMP.

## Fichiers

```
client-mod/
├── build.ps1           # build MSVC
├── dll/
│   ├── dllmain.cpp     # DllMain → thread
│   ├── core.h/.cpp     # réseau, snapshots, chat, pays/tag/ping, hotkeys
│   ├── entity.h/.cpp   # EntityManager + IGameAdapter (3D à brancher)
│   ├── overlay.h/.cpp  # overlay D2D (panneau, TAB, chat, radar)
│   └── d3d_hook.cpp    # hook Present
├── injector/main.cpp   # LoadLibraryW injection
└── launcher/index.js   # lance le jeu + injecte
```

## Avertissement

- Utilise **uniquement** ta propre copie du jeu, pour un usage personnel.
- Modifier un jeu commercial est en zone grise EULA ; ne diffuse pas de binaire patché.
- L'injecteur est fourni pour ton jeu ; ne l'utilise pas sur d'autres processus.
