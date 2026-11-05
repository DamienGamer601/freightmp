#include "entity.h"

namespace fmp {

EntityManager::EntityManager(IGameAdapter* adapter) : adapter_(adapter) {}

void EntityManager::spawn(const RemoteEntity& entity) {
  entities_[entity.numId] = entity;
  if (adapter_ != nullptr) {
    adapter_->createEntity(entity);
  }
}

void EntityManager::update(const RemoteEntity& entity) {
  entities_[entity.numId] = entity;
  if (adapter_ != nullptr) {
    adapter_->updateEntity(entity);
  }
}

void EntityManager::remove(uint16_t numId) {
  entities_.erase(numId);
  if (adapter_ != nullptr) {
    adapter_->destroyEntity(numId);
  }
}

void EntityManager::clear() {
  for (const auto& entry : entities_) {
    if (adapter_ != nullptr) {
      adapter_->destroyEntity(entry.first);
    }
  }
  entities_.clear();
}

bool EntityManager::contains(uint16_t numId) const {
  return entities_.find(numId) != entities_.end();
}

}  // namespace fmp
