# Playbook Reverse-Engineering — les 4 points d'accroche du rendu 3D

Objectif : renseigner les **4 valeurs** manquantes dans `dll/game_adapter.h` pour
que les camions distants apparaissent dans le monde :

```cpp
kSpawnSignature   // signature AOB de la fonction qui crée un véhicule
kRemoveSignature  // signature AOB de la fonction qui détruit un véhicule
kWorldListOffset  // offset du pointeur global de la scène (liste d'entités)
Layout { posX, posY, posZ, rotY }  // offsets dans l'objet entité
```

> ⚠️ Ces valeurs sont **spécifiques à chaque version** du jeu. Elles se trouvent
> avec des outils publics, uniquement sur **ta propre copie** (EULA SCS).

---

## Phase 0 — Outils & mise en place

| Outil | Rôle |
|---|---|
| **Cheat Engine** (cheatengine.org) | chercher des valeurs mémoire (positions) |
| **x64dbg** (x64dbg.com) | déboguer, poser des breakpoints, remonter la pile |
| **ReClass.NET** (github.com/ReClassNET) | reconstruire la structure de l'entité |
| **Ghidra** ou **IDA Free** | désassemblage statique (signatures) |

Le binaire : `Euro Truck Simulator 2\bin\win_x64\eurotrucks2.exe` (64-bit, Prism3D).

### Mise en place du jeu
1. Lance le jeu **en fenêtré**, charge une partie, gare le camion sur du **plat**,
   moteur coupé, trafic IA présent.
2. Garde le **télémétrie SCS** sous la main : elle te donne en continu la position
   réelle du camion (X, Y, Z, cap) via `Local\SCSTelemetry`. C'est **ta valeur de
   référence** pour les scans — mais ce n'est **pas** l'adresse de l'entité.

---

## Phase 1 — Trouver l'entité du camion local (l'ancre)

But : obtenir l'**adresse mémoire** de l'objet « camion joueur » dans le jeu.

1. **Cheat Engine** → attache-toi à `eurotrucks2.exe`.
2. « New Scan » → **Value Type = Double** (le jeu stocke les positions en double,
   cf. les offsets SCS : `coordinateX` est un `double`).
3. Saisis la valeur **X** lue dans la télémétrie (ex. `12345.678`).
4. Avance le camion de quelques mètres, relis **X**, « Next Scan » avec la nouvelle
   valeur.
5. Répète jusqu'à n'avoir que **quelques adresses**.
6. Celle qui **suit exactement** le camion (et bouge de concert avec Y/Z voisines)
   est le **X de l'entité**. Note son adresse `@ent`.

### Vérification
- Gèle la valeur dans CE : le camion doit se figer (ou le moteur se battre avec).
- Les doubles voisins (`@ent-8`, `@ent-16`, `@ent+8`, `@ent+16`) contiennent
  Y et Z → confirme que tu es sur un `vec3` de `double`.

---

## Phase 2 — Mapper la structure de l'entité (ReClass)

But : retrouver `posX`, `posY`, `posZ`, `rotY` pour `Layout`.

1. **ReClass.NET** → attach au processus → « New class » → base address = `@ent`.
2. Balaye les offsets autour de `@ent` :
   - `posX`, `posY`, `posZ` : trois `double` (ou `float`) consécutifs.
   - `rotX`, `rotY`, `rotZ` : trois `double` en **radians** (le cap = `rotY`).
3. Tourne le camion sur place : la valeur qui varie de `-π..π` est `rotY`.
4. Identifie aussi (utile plus tard) : `velocity` (vec3), `model` (pointeur vers le
   modèle), `state` (statique / en mouvement).
5. Reporte les offsets (relatifs à `@ent`) dans `Layout` :
   ```cpp
   layout_.posX = <offsetX>; layout_.posY = <offsetY>;
   layout_.posZ = <offsetZ>; layout_.rotY = <offsetRotY>;
   ```

### Astuce
Si les positions sont des `double` et l'écriture du mod attend des `float`,
adapte `Ets2GameAdapter::writeTransform` (écris des `double` si nécessaire).

---

## Phase 3 — Trouver la liste d'entités du monde

But : `kWorldListOffset` (pointeur global vers la collection de véhicules).

1. Dans **CE**, fais un « pointer scan » depuis `@ent` : il remonte souvent à un
   pointeur global (base + offset fixe) → c'est `worldList`.
2. Alternative : cherche le **compteur de véhicules**.
   - Scan « 4 bytes » = nombre de véhicules IA visibles.
   - Fais varier le trafic (attends que des IA apparaissent/disparaissent).
   - L'adresse du compteur mène à la structure qui tient la liste.
3. La liste est en général un `std::vector<T*>` (pointeur début + fin + capacité)
   ou une liste chaînée. Identifie le type en regardant les éléments (des
   pointeurs vers des objets qui ressemblent à ton entité de Phase 2).
4. Calcule l'offset du pointeur global depuis la base du module :
   ```
   offset = adresse_du_global − adresse_base_module
   ```
   → `kWorldListOffset`.

### Vérification
- Itère la liste dans CE/ReClass : tu dois voir **plusieurs entités**, dont celle
  du joueur, avec des positions cohérentes (autour de toi).

---

## Phase 4 — Trouver la fonction de spawn

But : `kSpawnSignature`.

1. **x64dbg** → attach → pose un breakpoint **hardware (écriture)** sur `@ent`
   (ou sur le premier élément de la liste quand il est créé).
2. Provoque un spawn : active le trafic, ou passe un **quick job** (crée un camion).
3. Le breakpoint saute → tu es dans la fonction qui **écrit la position d'une
   entité**. Remonte la pile (`Ctrl+F9` = run to return, puis regarde l'appelant).
4. Repère la fonction qui **alloue + insère** l'entité (le « constructeur/spawn »).
   C'est `spawnTruck`.
5. Sélectionne ses **8–16 premiers octets** → copie en AOB → remplace les octets
   variables par `??` → `kSpawnSignature`.

### Vérification
- `Ets2GameAdapter::initialize()` doit résoudre la signature et logger
  `spawnTruck résolu @ ...`.

---

## Phase 5 — Trouver la fonction de suppression

But : `kRemoveSignature`.

1. Breakpoint hardware sur la **destruction** (retire une IA, ou quitte le quick
   job pour faire disparaître le camion).
2. Remonte la pile jusqu'à la fonction qui **retire + libère** l'entité.
3. Signature AOB → `kRemoveSignature`.

---

## Phase 6 — Câbler, compiler, tester

1. Renseigne les 4 valeurs dans `dll/game_adapter.h`.
2. Compile : `.\build.ps1`.
3. Injecte (via le launcher → JOUER, ou `injector.exe`).
4. Connecte deux clients (ou un client + le client Node de référence) : le camion
   distant doit **apparaître et suivre** (interpolation déjà branchée).

### Débogage
- Logs : `%TEMP%\fmp-client.log` (le viewer du launcher les affiche).
- Si le camion n'apparaît pas : vérifie `spawnTruck_` résolu, puis la signature du
   modèle (`vehicle.truck` est un placeholder — remplace par un modèle valide).
- Si le camion clignote/téléporte : affinage de l'interpolation (`INTERPOLATION_DELAY_MS`).

---

## Résumé

| # | Quoi | Outil | Livrable |
|---|---|---|---|
| 0 | Préparer | CE + x64dbg + ReClass | — |
| 1 | Adresse de l'entité locale | CE (Double, exact) | `@ent` |
| 2 | Offsets pos/rot | ReClass | `Layout` |
| 3 | Liste du monde | CE pointer scan | `kWorldListOffset` |
| 4 | Fonction de spawn | x64dbg breakpoint écriture | `kSpawnSignature` |
| 5 | Fonction de suppression | x64dbg breakpoint | `kRemoveSignature` |
| 6 | Câbler + tester | build + injection | rendu 3D |

> Le **seul** vrai obstacle est le temps : chaque phase est mécanique, mais le
> moteur Prism3D est volumineux. Patience et méthode, pas de magie.
