#include "pattern.h"

#include <windows.h>
#include <cctype>
#include <cstring>

namespace fmp {

namespace {
int hexValue(char c) {
  if (c >= '0' && c <= '9') {
    return c - '0';
  }
  if (c >= 'a' && c <= 'f') {
    return c - 'a' + 10;
  }
  if (c >= 'A' && c <= 'F') {
    return c - 'A' + 10;
  }
  return -1;
}
}  // namespace

bool parsePattern(const char* pattern, std::vector<uint8_t>& bytes,
                  std::vector<bool>& mask) {
  bytes.clear();
  mask.clear();

  const char* p = pattern;
  while (*p != '\0') {
    // Ignore les espaces et séparateurs.
    while (*p == ' ' || *p == '\t') {
      ++p;
    }
    if (*p == '\0') {
      break;
    }

    if (p[0] == '?' && p[1] == '?') {
      bytes.push_back(0x00);
      mask.push_back(false);
      p += 2;
      continue;
    }

    const int high = hexValue(p[0]);
    const int low = hexValue(p[1]);
    if (high < 0 || low < 0) {
      return false;  // caractère invalide
    }
    bytes.push_back(static_cast<uint8_t>((high << 4) | low));
    mask.push_back(true);
    p += 2;
  }

  return !bytes.empty();
}

const uint8_t* findPattern(const uint8_t* begin, size_t size,
                           const std::vector<uint8_t>& bytes,
                           const std::vector<bool>& mask) {
  if (bytes.empty() || bytes.size() != mask.size() || size < bytes.size()) {
    return nullptr;
  }

  const size_t patternLength = bytes.size();
  for (size_t i = 0; i + patternLength <= size; ++i) {
    bool match = true;
    for (size_t j = 0; j < patternLength; ++j) {
      if (mask[j] && begin[i + j] != bytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return begin + i;
    }
  }
  return nullptr;
}

bool getModuleRange(const char* moduleName, const uint8_t*& base, size_t& size) {
  const HMODULE module = GetModuleHandleA(moduleName);
  if (module == nullptr) {
    return false;
  }

  base = reinterpret_cast<const uint8_t*>(module);
  const auto* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(module);
  if (dos->e_magic != IMAGE_DOS_SIGNATURE) {
    return false;
  }
  const auto* nt = reinterpret_cast<const IMAGE_NT_HEADERS64*>(
      base + dos->e_lfanew);
  if (nt->Signature != IMAGE_NT_SIGNATURE) {
    return false;
  }

  size = nt->OptionalHeader.SizeOfImage;
  return true;
}

const uint8_t* resolveRelative(const uint8_t* instruction, int offsetToOpcode,
                               int instructionLength) {
  if (instruction == nullptr) {
    return nullptr;
  }
  int32_t displacement = 0;
  std::memcpy(&displacement, instruction + offsetToOpcode, sizeof(int32_t));
  return instruction + instructionLength + displacement;
}

}  // namespace fmp
