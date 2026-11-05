#pragma once
#include "entity.h"
#include <cstdint>
#include <map>

namespace fmp {

/**
 * Adaptateur concret du moteur (Euro Truck Simulator 2 / ATS — même moteur
 * Prism3D). C'est **l'unique point à finaliser par reverse-engineering**.
 *
 * Le hook du moteur se réduit à 4 choses à découvrir (voir RE-GUIDE.md) :
 *  1. `spawnTruck_`  — fonction qui crée un véhicule (modèle, position).
 *  2. `removeTruck_` — fonction qui détruit un véhicule.
 *  3. `worldList_`   — pointeur global vers la collection de véhicules.
 *  4. `Layout`       — offsets de position/orientation dans l'objet entité.
 *
 * Chacun se trouve par des **signatures AOB** ou des pointeurs statiques ; les
 * adresses changent à chaque patch, d'où l'usage du scanner de signatures.
 */
class Ets2GameAdapter : public IGameAdapter {
 public:
  Ets2GameAdapter() = default;

  /**
   * Résout les points d'accroche du moteur (signatures AOB + offsets).
   * Retourne false si un point essentiel reste introuvable.
   */
  bool initialize();

  void createEntity(const RemoteEntity& entity) override;
  void updateEntity(const RemoteEntity& entity) override;
  void destroyEntity(uint16_t numId) override;

 private:
  /** Écrit position + cap dans l'objet entité, via les offsets découverts. */
  bool writeTransform(void* entity, float x, float z, float heading);

  /* ---- Points d'accroche (résolus par RE — null/0 tant que non trouvés) ----

     ⚠️ Les signatures ci-dessous sont des PLACEHOLDERS documentaires. Elles
     doivent être remplacées par les signatures réelles trouvées avec
     Cheat Engine / x64dbg / Ghidra pour LA version du jeu installée. */

  // Signature candidate pour la fonction de spawn (à trouver).
  static constexpr const char* kSpawnSignature =
      "48 89 5C 24 ?? 57 48 83 EC ?? E8 ?? ?? ?? ?? 48 8B D8";  // PLACEHOLDER
  // Signature candidate pour la fonction de suppression (à trouver).
  static constexpr const char* kRemoveSignature = "PLACEHOLDER";
  // Offset (dans l'exe) du pointeur global de la scène (à trouver).
  static constexpr uintptr_t kWorldListOffset = 0x00000000;  // PLACEHOLDER

  void* (*spawnTruck_)(const char* model, float x, float z) = nullptr;
  void (*removeTruck_)(void* entity) = nullptr;
  uintptr_t worldList_ = 0;

  /** Offsets dans l'objet entité (découverts avec ReClass.NET). */
  struct Layout {
    uint32_t posX = 0;
    uint32_t posY = 0;
    uint32_t posZ = 0;
    uint32_t rotY = 0;
  } layout_;

  std::map<uint16_t, void*> entities_;  // numId -> entité créée par le mod
};

}  // namespace fmp
