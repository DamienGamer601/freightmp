#include "interpolation.h"

#include <algorithm>

namespace fmp {

namespace {
constexpr std::size_t kMaxBufferSize = 32;  // ~1,6 s de snapshots à 20 Hz
}  // namespace

void Interpolator::push(uint16_t numId, float x, float z, float heading,
                        float speed, uint64_t receiveTimeMs) {
  auto& buffer = buffers_[numId];
  buffer.push_back(Sample{receiveTimeMs, x, z, heading, speed});

  // Limite la mémoire : on garde les derniers échantillons.
  if (buffer.size() > kMaxBufferSize) {
    buffer.pop_front();
  }
}

void Interpolator::erase(uint16_t numId) {
  buffers_.erase(numId);
}

bool Interpolator::sample(uint16_t numId, uint64_t nowMs,
                          InterpolatedState& out) const {
  const auto it = buffers_.find(numId);
  if (it == buffers_.end() || it->second.empty()) {
    return false;
  }
  const auto& buffer = it->second;

  const uint64_t target =
      nowMs > INTERPOLATION_DELAY_MS ? nowMs - INTERPOLATION_DELAY_MS : 0;

  const Sample& latest = buffer.back();
  const Sample& oldest = buffer.front();

  // Cas simples : un seul échantillon, ou on est hors de la fenêtre.
  if (buffer.size() == 1 || target >= latest.receiveTimeMs) {
    out = {latest.x, latest.z, latest.heading, latest.speed};
    return true;
  }
  if (target <= oldest.receiveTimeMs) {
    out = {oldest.x, oldest.z, oldest.heading, oldest.speed};
    return true;
  }

  // Trouve la paire [a ; b] qui encadre `target`.
  const Sample* a = &oldest;
  const Sample* b = &latest;
  for (std::size_t i = 1; i < buffer.size(); ++i) {
    if (buffer[i].receiveTimeMs > target) {
      b = &buffer[i];
      a = &buffer[i - 1];
      break;
    }
  }

  const uint64_t span = b->receiveTimeMs - a->receiveTimeMs;
  const float t = span > 0
                      ? static_cast<float>(target - a->receiveTimeMs) /
                            static_cast<float>(span)
                      : 0.0f;

  out = lerpSamples(*a, *b, t);
  return true;
}

bool Interpolator::contains(uint16_t numId) const {
  return buffers_.find(numId) != buffers_.end();
}

void Interpolator::clear() {
  buffers_.clear();
}

std::size_t Interpolator::count() const {
  return buffers_.size();
}

InterpolatedState lerpSamples(const Sample& a, const Sample& b, float t) {
  InterpolatedState out;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.speed = a.speed + (b.speed - a.speed) * t;

  // Cap interpolé par le plus court chemin angulaire.
  float delta = b.heading - a.heading;
  while (delta > 180.0f) {
    delta -= 360.0f;
  }
  while (delta < -180.0f) {
    delta += 360.0f;
  }
  float heading = a.heading + delta * t;
  while (heading < 0.0f) {
    heading += 360.0f;
  }
  while (heading >= 360.0f) {
    heading -= 360.0f;
  }
  out.heading = heading;
  return out;
}

}  // namespace fmp
