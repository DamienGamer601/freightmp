#pragma once
#include <cstdint>
#include <deque>
#include <map>

namespace fmp {

/** Un échantillon de position reçu du serveur à un instant donné. */
struct Sample {
  uint64_t receiveTimeMs = 0;  // horloge locale de réception (GetTickCount64)
  float x = 0.0f;
  float z = 0.0f;
  float heading = 0.0f;  // degrés
  float speed = 0.0f;    // km/h
};

/** État lissé résultant d'un échantillonnage. */
struct InterpolatedState {
  float x = 0.0f;
  float z = 0.0f;
  float heading = 0.0f;
  float speed = 0.0f;
};

/**
 * Tampon de snapshots par joueur + interpolation à délai fixe.
 *
 * On n'affiche **jamais** la dernière position reçue : on « rejoue » les
 * positions avec un retard (INTERPOLATION_DELAY_MS) pour lisser les sauts du
 * réseau (le serveur envoie à 20 Hz, le client à ~60 FPS).
 *
 * Le cap (heading) est interpolé par le plus court chemin angulaire pour ne
 * pas « tourner à l'envers » au passage de 359° → 1°.
 */
class Interpolator {
 public:
  /** Retard d'affichage par rapport au dernier échantillon reçu (ms). */
  static constexpr uint64_t INTERPOLATION_DELAY_MS = 120;

  /** Ajoute un échantillon pour un joueur (les appels doivent être croissants). */
  void push(uint16_t numId, float x, float z, float heading, float speed,
            uint64_t receiveTimeMs);

  /** Retire un joueur (déconnexion / hors de portée). */
  void erase(uint16_t numId);

  /**
   * Échantillonne l'état lissé d'un joueur à l'instant `nowMs`.
   * Retourne false si le joueur n'est pas connu.
   */
  bool sample(uint16_t numId, uint64_t nowMs, InterpolatedState& out) const;

  bool contains(uint16_t numId) const;
  void clear();
  std::size_t count() const;

 private:
  std::map<uint16_t, std::deque<Sample>> buffers_;
};

/** Interpolation linéaire, en normalisant le cap au plus court chemin. */
InterpolatedState lerpSamples(const Sample& a, const Sample& b, float t);

}  // namespace fmp
