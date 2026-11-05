#include "game_adapter.h"

#include <windows.h>
#include <cstdarg>
#include <cstdio>
#include <cstring>

#include "core.h"
#include "pattern.h"

namespace fmp {

namespace {

/** Logger local de l'adaptateur (même fichier que le reste du client). */
void adapterLog(const char* format, ...) {
  char buffer[1024];
  va_list args;
  va_start(args, format);
  vsnprintf(buffer, sizeof(buffer), format, args);
  va_end(args);

  OutputDebugStringA("[FMP] ");
  OutputDebugStringA(buffer);
  OutputDebugStringA("\n");

  char path[MAX_PATH];
  if (GetTempPathA(MAX_PATH, path) > 0) {
    strcat_s(path, "fmp-client.log");
    FILE* file = nullptr;
    if (fopen_s(&file, path, "a") == 0 && file != nullptr) {
      SYSTEMTIME st;
      GetLocalTime(&st);
      fprintf(file, "[%02u:%02u:%02u] %s\n", st.wHour, st.wMinute, st.wSecond,
              buffer);
      fclose(file);
    }
  }
}

}  // namespace

bool Ets2GameAdapter::initialize() {
  // 1. Résoudre le module du jeu (ETS2 ou ATS, même moteur Prism3D).
  const uint8_t* base = nullptr;
  size_t size = 0;
  if (!getModuleRange("eurotrucks2.exe", base, size)) {
    if (!getModuleRange("amtrucks.exe", base, size)) {
      adapterLog("adapter : module de jeu introuvable (jeu non lancé ?)");
      return false;
    }
  }
  adapterLog("adapter : module %zu octets @ %p", size, base);

  // 2. Scanner la fonction de spawn via sa signature AOB.
  //    ⚠️ Remplacer kSpawnSignature par la signature réelle de TA version.
  std::vector<uint8_t> bytes;
  std::vector<bool> mask;
  if (parsePattern(kSpawnSignature, bytes, mask)) {
    const uint8_t* hit = findPattern(base, size, bytes, mask);
    if (hit != nullptr) {
      spawnTruck_ = reinterpret_cast<decltype(spawnTruck_)>(hit);
      adapterLog("adapter : spawnTruck résolu @ %p", static_cast<const void*>(hit));
    } else {
      adapterLog("adapter : signature de spawn introuvable (version différente ?)");
    }
  }

  // 3. Pointeur global de la scène (offset fixe à découvrir par RE).
  if (kWorldListOffset != 0) {
    worldList_ = reinterpret_cast<uintptr_t>(base) + kWorldListOffset;
    adapterLog("adapter : worldList @ 0x%llX", static_cast<unsigned long long>(worldList_));
  }

  // 4. Offsets de l'objet entité — à remplir après ReClass.NET :
  //    layout_.posX = 0x…; layout_.posY = 0x…; layout_.posZ = 0x…; layout_.rotY = 0x…;

  if (spawnTruck_ == nullptr && worldList_ == 0) {
    adapterLog("adapter : RIEN de branché — il manque le reverse-engineering du moteur");
    return false;
  }
  return true;
}

bool Ets2GameAdapter::writeTransform(void* entity, float x, float z,
                                     float heading) {
  if (entity == nullptr || layout_.posX == 0 || layout_.posZ == 0) {
    return false;
  }
  auto* writable = reinterpret_cast<uint8_t*>(entity);
  std::memcpy(writable + layout_.posX, &x, sizeof(float));
  std::memcpy(writable + layout_.posZ, &z, sizeof(float));
  if (layout_.posY != 0) {
    // Position Y : au sol, laisse le moteur gérer (0 = non défini).
  }
  if (layout_.rotY != 0) {
    const float headingRad = heading * 3.14159265358979323846f / 180.0f;
    std::memcpy(writable + layout_.rotY, &headingRad, sizeof(float));
  }
  return true;
}

void Ets2GameAdapter::createEntity(const RemoteEntity& entity) {
  if (spawnTruck_ == nullptr) {
    adapterLog("adapter.createEntity #%u : NON BRANCHÉ (RE requis)", entity.numId);
    return;
  }
  // Modèle générique : à remplacer par le modèle du camion distant (reçu plus
  // tard du serveur, ou un modèle « remplaçant » tant que la réplication des
  // accessoires n'est pas faite).
  void* created = spawnTruck_("vehicle.truck", entity.x, entity.z);
  entities_[entity.numId] = created;
  writeTransform(created, entity.x, entity.z, entity.heading);
  adapterLog("adapter.createEntity #%u -> %p", entity.numId, created);
}

void Ets2GameAdapter::updateEntity(const RemoteEntity& entity) {
  const auto it = entities_.find(entity.numId);
  if (it == entities_.end()) {
    // L'entité n'existe pas encore (spawn non branché) : on la crée.
    createEntity(entity);
    return;
  }
  writeTransform(it->second, entity.x, entity.z, entity.heading);
}

void Ets2GameAdapter::destroyEntity(uint16_t numId) {
  const auto it = entities_.find(numId);
  if (it == entities_.end()) {
    return;
  }
  if (removeTruck_ != nullptr) {
    removeTruck_(it->second);
  }
  entities_.erase(it);
}

}  // namespace fmp
