# Guide de reverse-engineering — client 3D FreightMP

Ce guide décrit **méthodiquement** comment compléter les stubs du client 3D
(`client-mod/dll/core.cpp`) pour afficher les autres joueurs dans le monde.

> ⚠️ **Avertissement** : ceci relève du modding d'un jeu commercial. Utilise
> uniquement **ta propre copie**, ne diffuse pas de binaire patché, et respecte
> l'EULA de SCS Software. Le hook D3D11 est déjà en place ; les parties
> « entités » sont spécifiques à **chaque version** du jeu.

---

## 0. Outils

| Outil | Usage |
|---|---|
| **x64dbg** | débogage dynamique, breakpoints, inspection mémoire |
| **IDA Free / Ghidra** | désassemblage statique du binaire |
| **ReClass.NET** | reconstruction des structures mémoire |
| **Cheat Engine** | scan de valeurs (positions, compteurs) |
| **SCS SDK** (scssdk_telemetry.h) | lecture officielle de la télémétrie |

Le jeu 64-bit : `Euro Truck Simulator 2\bin\win_x64\eurotrucks2.exe`.

---

## 1. Lire la position du camion local (le plus simple)

> ✅ **Déjà implémenté** dans `dll/core.cpp` → `fmp::getLocalTruck()`.
> Offsets extraits du parseur `trucksim-telemetry` puis **vérifiés** par un
> test synthétique (shared memory injectée → relecture correcte) :
>
> | Champ | Offset | Type |
> |---|---|---|
> | `speed` | 948 | float (m/s) |
> | `coordinateX` | 2200 | double |
> | `coordinateY` | 2208 | double |
> | `coordinateZ` | 2216 | double |
> | `rotationX` | 2224 | double (rad) |
> | `rotationY` | 2232 | double (rad) |
> | `rotationZ` | 2240 | double (rad) |
>
> Cap = `rotationY` (rad → degrés) ; vitesse km/h = `speed × 3.6`.
> Shared memory : `Local\SCSTelemetry` (32 Ko).

Deux voies, à privilégier dans cet ordre :

### A. SDK SCS (recommandé, stable)
Le plugin `scs-telemetry.dll` (déjà installé) écrit la télémétrie dans une
**section partagée** `Local\SCSTelemetryPlugin`. En C++ :

1. `OpenFileMappingA(FILE_MAP_READ, FALSE, "Local\\SCSTelemetryPlugin")`
2. `MapViewOfFile(...)`
3. Caster sur la structure documentée par le SDK
   (`scssdk_telemetry.h`, `struct scs_telemetry_frame`).
4. Lire `truck.position.x`, `truck.position.z`, `truck.position.heading`,
   `truck.speed` (m/s → ×3.6).

→ Implémente `fmp::getLocalTruck()` ici. **Aucun offset à trouver.**

### B. Scan mémoire (fallback)
1. Cheat Engine : scan « float inconnu » en roulant, filtrer en avançant.
2. Isoler les paires x/z, puis ReClass pour la structure autour.
3. Pattern-scan le pointeur de base (AOB) si l'adresse bouge.

---

## 1bis. Architecture des entités (déjà en place)

Le pipeline réseau → rendu est **déjà branché** :

- **`dll/entity.h`** : `IGameAdapter` (3 méthodes) + `EntityManager` (registre).
- **`dll/interpolation.h/.cpp`** : `Interpolator` — tampon de snapshots par
  joueur + **interpolation à délai fixe (120 ms)** + lerp du cap au plus court
  chemin angulaire. Le thread `InterpolationThread` (core.cpp) rééchantillonne
  à ~60 Hz et alimente `g_entities.update(...)`.
- **`dll/pattern.h/.cpp`** : scanner de **signatures AOB** (jokers `??`),
  résolution d'appels relatifs (`resolveRelative`) et plage d'un module
  (`getModuleRange`).
- **`dll/game_adapter.h/.cpp`** : `Ets2GameAdapter` — squelette **concret** de
  l'adaptateur moteur, avec les 4 points d'accroche clairement marqués :
  `spawnTruck_`, `removeTruck_`, `worldList_`, `Layout` (offsets d'entité).

**Il ne reste que le RE du moteur** : remplir les signatures/offsets dans
`game_adapter.h` (voir §3 et §4). Tout le reste (réseau, lissage, overlay) est
fonctionnel et **testé** (`tests/test_interp.cpp`).

---

## 2. Trouver la liste d'entités camions du monde

C'est le cœur du travail.

### Méthode concrète

1. Lance le jeu en **fenêtré**, ouvre une session avec du trafic IA.
2. **Cheat Engine** : cherche une valeur de position connue (via le SDK) pour
   retrouver l'adresse du camion joueur, puis remonte aux structures voisines.
3. **ReClass.NET** : attache-toi au processus, définis les structures à partir
   des adresses trouvées (`position`, `rotation`, `model`, `state`).
4. Cherche la **collection** (tableau dynamique ou liste doublement chaînée)
   qui contient tous les véhicules du monde, et le **pointeur global** vers
   le monde (`world`/`scene`).
5. Vérifie en ajoutant/retirant du trafic : le nombre d'éléments doit varier.

### Indices utiles

- Les entités ont souvent un **type** (camion joueur / IA / remorque).
- La position d'une entité est souvent **doublée** (position + orientation).
- Le jeu a un **tick** de mise à jour : un breakpoint sur l'écriture de position
  d'une IA te mène à la boucle d'update.

Une fois la liste trouvée, tu peux itérer et lire chaque camion distant.

---

## 3. Faire apparaître un camion distant (`onPlayerSpawn`)

Deux approches :

### A. Cloner une entité existante (le plus simple)
1. Trouve la fonction de **spawn** (breakpoint sur le spawn d'une IA).
2. Duplique une entité proche (même modèle), copie sa structure.
3. Insère-la dans la liste du monde (à toi de trouver l'appel d'ajout).

### B. Appeler l'API interne du jeu
1. Trouve la fonction qui crée un véhicule (utilisée par le trafic).
2. Reproduis ses arguments (modèle, position, route).

⚠️ La signature et l'ordre des arguments **changent à chaque version**.

---

### C. Transformer une adresse trouvée en signature (`kSpawnSignature`)

1. Dans **x64dbg**, place-toi sur la fonction de spawn identifiée, sélectionne
   ses **8 à 16 premiers octets**.
2. Copie-les en AOB (`Clic droit → Copy → Bytes with spaces`).
3. Remplace les octets qui **varient** d'une version à l'autre par `??` :
   - les adresses absolues dans les `mov/call` RIP-relatifs ;
   - les 4 octets qui suivent `E8`, `48 8B 05`, `48 8D 0D`, `48 8D 15`.
4. Colle la signature dans `game_adapter.h` → `kSpawnSignature`.
5. Relance le jeu : `Ets2GameAdapter::initialize()` la résout à chaque démarrage,
   indépendamment de l'ASLR et du patch (tant que la signature reste stable).

> 💡 Vérifie toujours que ta signature n'apparaît **qu'une fois** dans le module
> (`findPattern` renvoie la première occurrence ; fais un scan complet pour t'en
> assurer, ou choisis une signature plus longue).

---

## 4. Mettre à jour les positions (`onPlayerUpdate`)

- Écris `entity.position.x/z` et `entity.heading` avec les valeurs du snapshot
  (déjà reçues par la DLL dans `g_players`).
- Pour la fluidité : **interpole** entre deux snapshots (comme le client Node
  de référence) avant d'écrire la position.

---

## 5. Rendu / overlay (D3D11)

> ✅ **Déjà implémenté** : `dll/overlay.cpp` dessine un panneau
> **Direct2D/DirectWrite** par-dessus le back buffer — titre, liste des joueurs
> proches et **radar** (positions relatives, portée 1000 u. de jeu).
> Le hook `IDXGISwapChain::Present` l'appelle à chaque frame.

Pour aller plus loin, tu peux :
- dessiner une **mini-carte** (trajectoires, points) avec D2D ;
- ajouter des **icônes** (bitmaps) ;
- remplacer D2D par **ImGui** (`backends/imgui_impl_dx11.cpp`) si tu veux des
  widgets interactifs.

---

## 6. Intégrité / anti-triche (côté client)

- Le launcher signe le binaire (SHA-256) et envoie le hash au serveur.
- Vérifie l'intégrité des modules chargés au démarrage.
- Côté serveur, la validation existe déjà (vitesse plafonnée, téléportation,
  séquence croissante).

---

## 7. Ordre de travail conseillé

1. ✅ **Fait** : launcher + injecteur + DLL + réseau + hook D3D11 + overlay.
2. ✅ **Fait** : lecture de la position locale (SDK SCS) → `getLocalTruck`.
3. ✅ **Fait** : interpolation réseau → `Interpolator` + `InterpolationThread`.
4. ✅ **Fait** : scanner AOB → `pattern.h/.cpp` + squelette `Ets2GameAdapter`.
5. ⬜ **RE** : trouver la fonction de spawn → renseigner `kSpawnSignature`.
6. ⬜ **RE** : trouver les offsets de l'objet entité → renseigner `Layout`.
7. ⬜ **RE** : vérifier `createEntity`/`updateEntity`/`destroyEntity` (déjà câblés).
8. ⬜ Rendu avancé (modèles/accessoires/peinture) + anti-triche client.

> Le **seul** travail restant est le reverse-engineering du moteur (§3 et §4).
> Tout le code autour est prêt, compilé et testé.
