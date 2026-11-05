// Test unitaire (console) de l'interpolation + du scanner de signatures.
// Compilé séparément de la DLL : vérifie la logique pure sans injecter le jeu.
#include <cmath>
#include <cstdio>
#include <vector>

#include "../dll/interpolation.h"
#include "../dll/interpolation.cpp"
#include "../dll/pattern.h"
#include "../dll/pattern.cpp"

static int g_failures = 0;

#define CHECK(cond)                                                     \
  do {                                                                  \
    if (!(cond)) {                                                      \
      std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);       \
      ++g_failures;                                                     \
    }                                                                   \
  } while (0)

static bool approx(float a, float b, float eps = 0.01f) {
  return std::fabs(a - b) < eps;
}

static void testInterpolation() {
  std::printf("== interpolation ==\n");
  fmp::Interpolator interp;

  // 1. Un seul échantillon -> renvoie cet échantillon.
  interp.push(1, 10.0f, 20.0f, 90.0f, 60.0f, 0);
  fmp::InterpolatedState s;
  CHECK(interp.sample(1, 200, s));
  CHECK(approx(s.x, 10.0f));
  CHECK(approx(s.z, 20.0f));

  // 2. Deux échantillons -> lerp au milieu.
  interp.push(1, 0.0f, 0.0f, 0.0f, 0.0f, 100);
  interp.push(1, 100.0f, 0.0f, 0.0f, 0.0f, 200);
  // nowMs = 120 + 200 = 320 ? Non : target = now - 120.
  // target = 150 -> t = (150-100)/(200-100) = 0.5 -> x = 50.
  CHECK(interp.sample(1, 270, s));
  CHECK(approx(s.x, 50.0f));
  CHECK(approx(s.z, 0.0f));

  // 3. Extrapolation douce : après le dernier échantillon -> dernier connu.
  CHECK(interp.sample(1, 1000, s));
  CHECK(approx(s.x, 100.0f));

  // 4. Cap interpolé par le plus court chemin (350 -> 10).
  interp.erase(1);
  interp.push(1, 0.0f, 0.0f, 350.0f, 0.0f, 0);
  interp.push(1, 0.0f, 0.0f, 10.0f, 0.0f, 100);
  CHECK(interp.sample(1, 50 + fmp::Interpolator::INTERPOLATION_DELAY_MS, s));
  CHECK(approx(s.heading, 0.0f) || approx(s.heading, 360.0f));

  // 5. erase.
  interp.erase(1);
  CHECK(!interp.contains(1));
  std::printf("  ok\n");
}

static void testPattern() {
  std::printf("== pattern ==\n");

  // 1. Parse.
  std::vector<uint8_t> bytes;
  std::vector<bool> mask;
  CHECK(fmp::parsePattern("48 8B 05 ?? ?? 48", bytes, mask));
  CHECK(bytes.size() == 6);
  CHECK(bytes[0] == 0x48 && bytes[1] == 0x8B && bytes[2] == 0x05);
  CHECK(mask[3] == false && mask[4] == false && mask[5] == true);

  // 2. FindPattern (avec jokers).
  const uint8_t buffer[] = {0x90, 0x90, 0x48, 0x8B, 0x05, 0xAA, 0xBB, 0x48, 0x90};
  const uint8_t* hit = fmp::findPattern(buffer, sizeof(buffer), bytes, mask);
  CHECK(hit == buffer + 2);

  // 3. Pas de correspondance.
  const uint8_t nomatch[] = {0x90, 0x90, 0x90, 0x90};
  CHECK(fmp::findPattern(nomatch, sizeof(nomatch), bytes, mask) == nullptr);

  // 4. Parse sans espaces.
  CHECK(fmp::parsePattern("488B", bytes, mask));
  CHECK(bytes.size() == 2 && bytes[0] == 0x48 && bytes[1] == 0x8B);

  // 5. Parse invalide.
  CHECK(!fmp::parsePattern("ZZ", bytes, mask));

  std::printf("  ok\n");
}

int main() {
  testInterpolation();
  testPattern();

  if (g_failures == 0) {
    std::printf("\nTOUS LES TESTS PASSENT\n");
    return 0;
  }
  std::printf("\n%d ECHEC(S)\n", g_failures);
  return 1;
}
