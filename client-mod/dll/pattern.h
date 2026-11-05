#pragma once
#include <cstdint>
#include <cstddef>
#include <vector>

namespace fmp {

/**
 * Scanner de signatures AOB (« Array Of Bytes »).
 *
 * C'est l'outil standard pour retrouver une fonction du jeu à chaque version :
 * au lieu d'utiliser une adresse absolue (qui change à chaque patch), on
 * cherche une séquence d'octets caractéristique, avec des jokers `??`.
 *
 * Exemple : "48 8B 05 ?? ?? ?? ?? E8 ?? ?? ?? ??" (lecture d'un global + call).
 */

/** Parse une signature texte en octets + masque (true = octet à comparer). */
bool parsePattern(const char* pattern, std::vector<uint8_t>& bytes,
                  std::vector<bool>& mask);

/** Scanne [begin, begin+size) pour la première occurrence de la signature. */
const uint8_t* findPattern(const uint8_t* begin, size_t size,
                           const std::vector<uint8_t>& bytes,
                           const std::vector<bool>& mask);

/** Récupère la base + la taille (SizeOfImage) d'un module chargé par nom. */
bool getModuleRange(const char* moduleName, const uint8_t*& base, size_t& size);

/** Calcule le déplacement relatif à la fin d'une instruction (call/jmp rel32). */
const uint8_t* resolveRelative(const uint8_t* instruction, int offsetToOpcode,
                               int instructionLength);

}  // namespace fmp
