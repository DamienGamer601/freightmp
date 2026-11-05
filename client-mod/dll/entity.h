#pragma once
#include <cstdint>
#include <map>

namespace fmp {

/** Un camion distant, tel que reçu du serveur. */
struct RemoteEntity {
  uint16_t numId = 0;
  float x = 0.0f;
  float z = 0.0f;
  float heading = 0.0f;
  float speed = 0.0f;
};

/**
 * Adaptateur jeu — **c'est la seule partie à implémenter après RE**.
 *
 * Le moddeur fournit une implémentation concrète qui :
 *  - `createEntity` : crée un camion dans le monde (clone/spawn).
 *  - `updateEntity` : écrit position + cap + état.
 *  - `destroyEntity` : retire l'entité du monde.
 */
class IGameAdapter {
 public:
  virtual ~IGameAdapter() = default;

  virtual void createEntity(const RemoteEntity& entity) = 0;
  virtual void updateEntity(const RemoteEntity& entity) = 0;
  virtual void destroyEntity(uint16_t numId) = 0;
};

/**
 * Gestionnaire d'entités distantes : maintient le registre et délègue à
 * l'adaptateur jeu. Indépendant de toute API de jeu (testable).
 */
class EntityManager {
 public:
  explicit EntityManager(IGameAdapter* adapter);

  void spawn(const RemoteEntity& entity);
  void update(const RemoteEntity& entity);
  void remove(uint16_t numId);
  void clear();

  std::size_t count() const { return entities_.size(); }
  bool contains(uint16_t numId) const;

 private:
  IGameAdapter* adapter_ = nullptr;
  std::map<uint16_t, RemoteEntity> entities_;
};

}  // namespace fmp
