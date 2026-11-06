#include "core.h"
#include "d3d_hook.h"
#include "entity.h"
#include "game_adapter.h"
#include "interpolation.h"

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <algorithm>
#include <cstring>
#include <cstdarg>
#include <cstdlib>
#include <deque>
#include <map>
#include <set>
#include <vector>
#include <thread>
#include <chrono>

#pragma comment(lib, "ws2_32.lib")

namespace fmp {

namespace {
constexpr uint8_t kTypeState = 0x10;
constexpr uint8_t kTypeSnapshot = 0x20;
constexpr size_t kStateSize = 17;
constexpr size_t kSnapshotHeader = 15;
constexpr size_t kPlayerSize = 14;

SOCKET g_socket = INVALID_SOCKET;
sockaddr_in g_server{};
Config g_config;
std::map<uint16_t, RemotePlayer> g_players;
uint16_t g_myNumId = 0;
uint32_t g_seq = 0;
bool g_joined = false;
std::map<uint16_t, std::string> g_playerNames;
std::map<uint16_t, uint16_t> g_playerPings;
std::map<uint16_t, std::string> g_playerTags;
std::map<uint16_t, std::string> g_playerCountries;
std::set<uint16_t> g_muted;
int g_tabSelected = 0;
bool g_showTabPanel = false;
Interpolator g_interp;

/* ---------- Panneau admin (F8) ---------- */
bool g_showAdminPanel = false;
int g_adminSelected = 0;
int g_adminAction = 0;
std::string g_adminFeedback;
std::string g_localRole = "DRIVER";
std::map<uint16_t, std::string> g_playerRoles;
bool g_adminAnnounce = false;

/** Actions proposées dans le panneau admin (index stable). */
const std::vector<std::string> kAdminActions = {
    "Expulser le joueur selectionne",
    "Meteo : clair",
    "Meteo : pluie",
    "Meteo : brouillard",
    "Meteo : neige",
    "Heure +1 h",
    "Heure -1 h",
    "Annonce (saisie chat)",
};

bool keyDown(int vk);  // défini plus bas (section chat)

/** Thread qui gère la touche TAB + navigation + mute. */
DWORD WINAPI TabKeyThread(LPVOID) {
  bool prev[256] = {};
  while (true) {
    if (keyDown(VK_TAB) && !prev[VK_TAB]) {
      g_showTabPanel = !g_showTabPanel;
      g_tabSelected = 0;
    }

    if (g_showTabPanel) {
      const auto sorted = getSortedPlayers();
      const int count = static_cast<int>(sorted.size());
      if (count > 0) {
        if (g_tabSelected >= count) {
          g_tabSelected = count - 1;
        }
        if (keyDown(VK_DOWN) && !prev[VK_DOWN]) {
          g_tabSelected = (g_tabSelected + 1) % count;
        }
        if (keyDown(VK_UP) && !prev[VK_UP]) {
          g_tabSelected = (g_tabSelected - 1 + count) % count;
        }
        if (keyDown(0x4D) && !prev[0x4D]) {  // M = mute
          const uint16_t id = sorted[g_tabSelected].numId;
          if (g_muted.count(id) > 0) {
            g_muted.erase(id);
          } else {
            g_muted.insert(id);
          }
        }
      }
    }

    for (int vk = 0; vk < 256; ++vk) {
      prev[vk] = keyDown(vk);
    }
    Sleep(16);
  }
  return 0;
}

/* ---------- Chat ---------- */

constexpr int VK_KEY_Y = 0x59;  // touche Y (ouvre le chat)
std::deque<ChatMessage> g_chatMessages;
std::string g_chatInput;
bool g_chatOpen = false;
CollisionAlert g_lastCollision;
EnvironmentState g_environment;

bool keyDown(int vk) {
  return (GetAsyncKeyState(vk) & 0x8000) != 0;
}

char vkToChar(int vk, bool shift) {
  if (vk >= 'A' && vk <= 'Z') {
    return static_cast<char>(shift ? vk : (vk - 'A' + 'a'));
  }
  if (vk >= '0' && vk <= '9') {
    return static_cast<char>(vk);
  }
  if (vk == VK_SPACE) {
    return ' ';
  }
  return 0;
}

std::string escapeJson(const std::string& text) {
  std::string out;
  out.reserve(text.size() + 8);
  for (char c : text) {
    if (c == '"' || c == '\\') {
      out.push_back('\\');
    }
    out.push_back(c);
  }
  return out;
}

void sendChatMessage(const std::string& text) {
  if (g_socket == INVALID_SOCKET || text.empty()) {
    return;
  }
  const std::string json =
      "{\"t\":\"chat\",\"message\":\"" + escapeJson(text) + "\"}";
  sendto(g_socket, json.c_str(), static_cast<int>(json.size()), 0,
         reinterpret_cast<sockaddr*>(&g_server), sizeof(g_server));
}

/* ---------- Envoi des commandes admin ---------- */

void sendRaw(const std::string& json) {
  if (g_socket == INVALID_SOCKET || json.empty()) {
    return;
  }
  sendto(g_socket, json.c_str(), static_cast<int>(json.size()), 0,
         reinterpret_cast<sockaddr*>(&g_server), sizeof(g_server));
}

/** Change la météo (et conserve l'heure courante). */
void sendAdminWeather(const std::string& weather) {
  char buffer[160];
  snprintf(buffer, sizeof(buffer),
           "{\"t\":\"set-environment\",\"weather\":\"%s\",\"timeOfDay\":%d}",
           weather.c_str(), g_environment.timeOfDay);
  sendRaw(buffer);
}

/** Décale l'heure du jour de `delta` minutes (serveur : 0-1439). */
void sendAdminTimeDelta(int delta) {
  char buffer[96];
  snprintf(buffer, sizeof(buffer), "{\"t\":\"time\",\"delta\":%d}", delta);
  sendRaw(buffer);
}

/** Expulse un joueur par son numId. */
void sendAdminKick(uint16_t numId) {
  char buffer[96];
  snprintf(buffer, sizeof(buffer), "{\"t\":\"kick\",\"target\":%u}",
           static_cast<unsigned>(numId));
  sendRaw(buffer);
}

/** Diffuse une annonce à toute la salle. */
void sendAdminAnnounce(const std::string& text) {
  sendRaw("{\"t\":\"announce\",\"message\":\"" + escapeJson(text) + "\"}");
}

/** Thread de saisie du chat (Y pour ouvrir, Entrée pour envoyer). */
DWORD WINAPI ChatThread(LPVOID) {
  bool prev[256] = {};
  while (true) {
    if (keyDown(VK_KEY_Y) && !prev[VK_KEY_Y] && !g_chatOpen) {
      g_chatOpen = true;
      g_chatInput.clear();
    }

    if (g_chatOpen) {
      const bool shift = keyDown(VK_SHIFT);
      for (int vk = 'A'; vk <= 'Z'; ++vk) {
        if (keyDown(vk) && !prev[vk] && g_chatInput.size() < 200) {
          const char c = vkToChar(vk, shift);
          if (c != 0) {
            g_chatInput.push_back(c);
          }
        }
      }
      for (int vk = '0'; vk <= '9'; ++vk) {
        if (keyDown(vk) && !prev[vk] && g_chatInput.size() < 200) {
          const char c = vkToChar(vk, shift);
          if (c != 0) {
            g_chatInput.push_back(c);
          }
        }
      }
      if (keyDown(VK_SPACE) && !prev[VK_SPACE] && g_chatInput.size() < 200) {
        g_chatInput.push_back(' ');
      }
      if (keyDown(VK_BACK) && !prev[VK_BACK] && !g_chatInput.empty()) {
        g_chatInput.pop_back();
      }
      if (keyDown(VK_RETURN) && !prev[VK_RETURN]) {
        if (!g_chatInput.empty()) {
          if (g_adminAnnounce) {
            sendAdminAnnounce(g_chatInput);
            g_adminFeedback = "Annonce envoyee";
          } else {
            sendChatMessage(g_chatInput);
          }
          g_chatInput.clear();
        }
        g_adminAnnounce = false;
        g_chatOpen = false;
      }
      if (keyDown(VK_ESCAPE) && !prev[VK_ESCAPE]) {
        g_chatInput.clear();
        g_adminAnnounce = false;
        g_chatOpen = false;
      }
    }

    for (int vk = 0; vk < 256; ++vk) {
      prev[vk] = keyDown(vk);
    }
    Sleep(16);
  }
  return 0;
}

/* ---------- Panneau admin in-game (F8) ---------- */

/**
 * Exécute l'action admin sélectionnée.
 * `sorted` = joueurs triés (pour l'expulsion).
 */
void executeAdminAction(const std::vector<RemotePlayer>& sorted) {
  switch (g_adminAction) {
    case 0: {  // Expulser
      if (sorted.empty()) {
        g_adminFeedback = "Aucun joueur a expulser";
        break;
      }
      if (g_adminSelected >= static_cast<int>(sorted.size())) {
        g_adminSelected = 0;
      }
      const uint16_t id = sorted[g_adminSelected].numId;
      sendAdminKick(id);
      g_adminFeedback = "Expulsion demandee (#" + std::to_string(id) + ")";
      break;
    }
    case 1:
      sendAdminWeather("clear");
      g_adminFeedback = "Meteo : clair";
      break;
    case 2:
      sendAdminWeather("rain");
      g_adminFeedback = "Meteo : pluie";
      break;
    case 3:
      sendAdminWeather("fog");
      g_adminFeedback = "Meteo : brouillard";
      break;
    case 4:
      sendAdminWeather("snow");
      g_adminFeedback = "Meteo : neige";
      break;
    case 5:
      sendAdminTimeDelta(60);
      g_adminFeedback = "Heure +1 h";
      break;
    case 6:
      sendAdminTimeDelta(-60);
      g_adminFeedback = "Heure -1 h";
      break;
    case 7:  // Annonce : on ouvre la saisie du chat en mode annonce
      g_adminAnnounce = true;
      g_chatOpen = true;
      g_chatInput.clear();
      g_showAdminPanel = false;
      g_adminFeedback = "Saisissez l'annonce puis Entree";
      break;
    default:
      break;
  }
}

/** Thread du panneau admin (F8) : navigation + exécution. */
DWORD WINAPI AdminPanelThread(LPVOID) {
  bool prev[256] = {};
  while (true) {
    if (keyDown(VK_F8) && !prev[VK_F8]) {
      g_showAdminPanel = !g_showAdminPanel;
      g_adminSelected = 0;
      g_adminAction = 0;
      if (!isLocalAdmin()) {
        g_adminFeedback = "Reserve aux admins";
      }
    }

    if (g_showAdminPanel && isLocalAdmin()) {
      const auto sorted = getSortedPlayers();
      const int playerCount = static_cast<int>(sorted.size());
      const int actionCount = static_cast<int>(kAdminActions.size());

      if (playerCount > 0 && g_adminSelected >= playerCount) {
        g_adminSelected = playerCount - 1;
      }

      if (keyDown(VK_DOWN) && !prev[VK_DOWN] && playerCount > 0) {
        g_adminSelected = (g_adminSelected + 1) % playerCount;
      }
      if (keyDown(VK_UP) && !prev[VK_UP] && playerCount > 0) {
        g_adminSelected = (g_adminSelected - 1 + playerCount) % playerCount;
      }
      if (keyDown(VK_RIGHT) && !prev[VK_RIGHT]) {
        g_adminAction = (g_adminAction + 1) % actionCount;
      }
      if (keyDown(VK_LEFT) && !prev[VK_LEFT]) {
        g_adminAction = (g_adminAction - 1 + actionCount) % actionCount;
      }
      if (keyDown(VK_RETURN) && !prev[VK_RETURN]) {
        executeAdminAction(sorted);
      }
      if (keyDown(VK_ESCAPE) && !prev[VK_ESCAPE]) {
        g_showAdminPanel = false;
      }
    }

    for (int vk = 0; vk < 256; ++vk) {
      prev[vk] = keyDown(vk);
    }
    Sleep(16);
  }
  return 0;
}

std::string getEnv(const char* name, const char* fallback) {
  char buffer[512];
  DWORD len = GetEnvironmentVariableA(name, buffer, sizeof(buffer));
  if (len == 0 || len >= sizeof(buffer)) {
    return std::string(fallback);
  }
  return std::string(buffer, len);
}

void logLine(const char* format, ...) {
  char buffer[1024];
  va_list args;
  va_start(args, format);
  vsnprintf(buffer, sizeof(buffer), format, args);
  va_end(args);
  OutputDebugStringA("[FMP] ");
  OutputDebugStringA(buffer);
  OutputDebugStringA("\n");

  // Fichier de log pour le viewer du launcher (%TEMP%\fmp-client.log).
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

/**
 * Adaptateur concret du moteur Prism3D (ETS2/ATS).
 *
 * Tant que le reverse-engineering des fonctions de spawn/suppression n'est pas
 * fait, `initialize()` échoue proprement et l'adaptateur ne fait que logger :
 * le reste du client (réseau, overlay, radar, chat) continue de fonctionner.
 */
Ets2GameAdapter g_gameAdapter;
EntityManager g_entities(&g_gameAdapter);

/** Thread de rendu : rééchantillonne les positions lissées à ~60 Hz. */
DWORD WINAPI InterpolationThread(LPVOID) {
  while (true) {
    const uint64_t nowMs = GetTickCount64();
    for (const auto& entry : g_players) {
      InterpolatedState state;
      if (g_interp.sample(entry.first, nowMs, state)) {
        RemoteEntity entity;
        entity.numId = entry.first;
        entity.x = state.x;
        entity.z = state.z;
        entity.heading = state.heading;
        entity.speed = state.speed;
        g_entities.update(entity);
      }
    }
    Sleep(16);  // ~60 Hz
  }
  return 0;
}

void sendJoin() {
  if (g_socket == INVALID_SOCKET) {
    return;
  }

  std::string json = "{\"t\":\"join\",\"roomId\":\"" + g_config.roomId +
                     "\",\"truckId\":\"" + g_config.truckId + "\"";
  if (!g_config.token.empty()) {
    json += ",\"token\":\"" + g_config.token + "\"";
  }
  json += "}";

  sendto(g_socket, json.c_str(), static_cast<int>(json.size()), 0,
         reinterpret_cast<sockaddr*>(&g_server), sizeof(g_server));
  logLine("join envoye (room=%s)", g_config.roomId.c_str());
}

void sendStateToServer() {
  float x = 0.0f, z = 0.0f, heading = 0.0f, speed = 0.0f;
  if (!getLocalTruck(x, z, heading, speed)) {
    return;  // pas encore de données de jeu
  }

  unsigned char buffer[kStateSize];
  buffer[0] = kTypeState;
  uint32_t seq = g_seq++;
  std::memcpy(buffer + 1, &seq, 4);
  std::memcpy(buffer + 5, &x, 4);
  std::memcpy(buffer + 9, &z, 4);

  uint16_t headingRaw = static_cast<uint16_t>(
      static_cast<int>(heading * 100.0f) % 36000);
  uint16_t speedRaw = static_cast<uint16_t>(speed * 10.0f);
  std::memcpy(buffer + 13, &headingRaw, 2);
  std::memcpy(buffer + 15, &speedRaw, 2);

  sendto(g_socket, reinterpret_cast<const char*>(buffer), kStateSize, 0,
         reinterpret_cast<sockaddr*>(&g_server), sizeof(g_server));
}

void handleSnapshot(const unsigned char* data, int length) {
  if (length < static_cast<int>(kSnapshotHeader) || data[0] != kTypeSnapshot) {
    return;
  }

  uint16_t count = 0;
  std::memcpy(&count, data + 13, 2);

  if (length < static_cast<int>(kSnapshotHeader + count * kPlayerSize)) {
    return;
  }

  std::map<uint16_t, RemotePlayer> next;
  size_t offset = kSnapshotHeader;
  for (uint16_t index = 0; index < count; ++index) {
    RemotePlayer player;
    std::memcpy(&player.numId, data + offset, 2);
    std::memcpy(&player.x, data + offset + 2, 4);
    std::memcpy(&player.z, data + offset + 6, 4);
    uint16_t headingRaw = 0;
    uint16_t speedRaw = 0;
    std::memcpy(&headingRaw, data + offset + 10, 2);
    std::memcpy(&speedRaw, data + offset + 12, 2);
    player.heading = headingRaw / 100.0f;
    player.speed = speedRaw / 10.0f;
    next[player.numId] = player;
    offset += kPlayerSize;
  }

  const uint64_t nowMs = GetTickCount64();

  // Apparitions + alimentation du tampon d'interpolation (lissage).
  for (const auto& entry : next) {
    if (g_players.count(entry.first) == 0) {
      onPlayerSpawn(entry.second);
    }
    g_interp.push(entry.first, entry.second.x, entry.second.z,
                  entry.second.heading, entry.second.speed, nowMs);
  }

  // Disparitions.
  for (const auto& entry : g_players) {
    if (next.count(entry.first) == 0) {
      onPlayerRemove(entry.first);
      g_interp.erase(entry.first);
    }
  }

  g_players = std::move(next);
}

void handleMessage(const unsigned char* data, int length) {
  if (length <= 0) {
    return;
  }

  if (data[0] == kTypeSnapshot) {
    handleSnapshot(data, length);
    return;
  }

  // Messages de contrôle JSON (join-ok / join-err / players / pong).
  if (data[0] == '{') {
    std::string json(reinterpret_cast<const char*>(data), length);

    if (json.find("\"t\":\"players\"") != std::string::npos) {
      std::map<uint16_t, std::string> next;
      std::map<uint16_t, uint16_t> nextPings;
      std::map<uint16_t, std::string> nextTags;
      std::map<uint16_t, std::string> nextCountries;
      std::map<uint16_t, std::string> nextRoles;
      size_t pos = 0;
      while ((pos = json.find("{\"n\":", pos)) != std::string::npos) {
        const int numId = std::atoi(json.c_str() + pos + 5);
        const size_t uPos = json.find("\"u\":\"", pos);
        if (uPos == std::string::npos) {
          break;
        }
        const size_t nameStart = uPos + 5;
        const size_t nameEnd = json.find('"', nameStart);
        if (nameEnd == std::string::npos) {
          break;
        }
        next[static_cast<uint16_t>(numId)] =
            json.substr(nameStart, nameEnd - nameStart);

        const size_t pPos = json.find("\"p\":", nameEnd);
        if (pPos != std::string::npos) {
          nextPings[static_cast<uint16_t>(numId)] =
              static_cast<uint16_t>(std::atoi(json.c_str() + pPos + 4));
        }

        const size_t gPos = json.find("\"g\":\"", nameEnd);
        if (gPos != std::string::npos) {
          const size_t gStart = gPos + 5;
          const size_t gEnd = json.find('"', gStart);
          if (gEnd != std::string::npos) {
            nextTags[static_cast<uint16_t>(numId)] =
                json.substr(gStart, gEnd - gStart);
          }
        }

        const size_t cPos = json.find("\"c\":\"", nameEnd);
        if (cPos != std::string::npos) {
          const size_t cStart = cPos + 5;
          const size_t cEnd = json.find('"', cStart);
          if (cEnd != std::string::npos) {
            nextCountries[static_cast<uint16_t>(numId)] =
                json.substr(cStart, cEnd - cStart);
          }
        }

        const size_t rPos = json.find("\"r\":\"", nameEnd);
        if (rPos != std::string::npos) {
          const size_t rStart = rPos + 5;
          const size_t rEnd = json.find('"', rStart);
          if (rEnd != std::string::npos) {
            nextRoles[static_cast<uint16_t>(numId)] =
                json.substr(rStart, rEnd - rStart);
          }
        }

        pos = nameEnd;
      }
      g_playerNames = std::move(next);
      g_playerPings = std::move(nextPings);
      g_playerTags = std::move(nextTags);
      g_playerCountries = std::move(nextCountries);
      g_playerRoles = std::move(nextRoles);
      return;
    }

    if (json.find("\"t\":\"chat\"") != std::string::npos) {
      ChatMessage msg;
      const size_t numPos = json.find("\"numId\":");
      if (numPos != std::string::npos) {
        msg.numId = static_cast<uint16_t>(std::atoi(json.c_str() + numPos + 8));
      }
      const size_t namePos = json.find("\"name\":\"");
      if (namePos != std::string::npos) {
        const size_t start = namePos + 8;
        const size_t end = json.find('"', start);
        if (end != std::string::npos) {
          msg.name = json.substr(start, end - start);
        }
      }
      const size_t messagePos = json.find("\"message\":\"");
      if (messagePos != std::string::npos) {
        const size_t start = messagePos + 11;
        const size_t end = json.find('"', start);
        if (end != std::string::npos) {
          msg.message = json.substr(start, end - start);
        }
      }
      if (g_muted.count(msg.numId) == 0) {
        g_chatMessages.push_back(msg);
        if (g_chatMessages.size() > 50) {
          g_chatMessages.pop_front();
        }
      }
      return;
    }

    if (json.find("\"t\":\"collision\"") != std::string::npos) {
      const size_t otherPos = json.find("\"other\":");
      if (otherPos != std::string::npos) {
        g_lastCollision.other =
            static_cast<uint16_t>(std::atoi(json.c_str() + otherPos + 8));
      }
      g_lastCollision.active = true;
      g_lastCollision.at = GetTickCount();
      return;
    }

    if (json.find("\"t\":\"environment\"") != std::string::npos) {
      const size_t weatherPos = json.find("\"weather\":\"");
      if (weatherPos != std::string::npos) {
        const size_t start = weatherPos + 11;
        const size_t end = json.find('"', start);
        if (end != std::string::npos) {
          g_environment.weather = json.substr(start, end - start);
        }
      }
      const size_t timePos = json.find("\"timeOfDay\":");
      if (timePos != std::string::npos) {
        g_environment.timeOfDay =
            std::atoi(json.c_str() + timePos + 12);
      }
      return;
    }

    if (json.find("\"join-ok\"") != std::string::npos) {
      g_joined = true;
      auto pos = json.find("\"numId\":");
      if (pos != std::string::npos) {
        g_myNumId = static_cast<uint16_t>(std::atoi(json.c_str() + pos + 8));
      }
      const size_t rolePos = json.find("\"role\":\"");
      if (rolePos != std::string::npos) {
        const size_t start = rolePos + 8;
        const size_t end = json.find('"', start);
        if (end != std::string::npos) {
          g_localRole = json.substr(start, end - start);
        }
      }
      logLine("rejoint la salle (numId=%u, role=%s)", g_myNumId,
              g_localRole.c_str());
      if (isLocalAdmin()) {
        g_adminFeedback = "Panneau admin : F8";
      }
    } else if (json.find("\"join-err\"") != std::string::npos) {
      logLine("join refuse : %s", json.c_str());
    } else if (json.find("\"t\":\"kicked\"") != std::string::npos) {
      // Le serveur nous a expulsés.
      g_adminFeedback = "Vous avez ete expulse";
      g_joined = false;
      g_players.clear();
      logLine("expulse de la salle : %s", json.c_str());
    } else if (json.find("\"t\":\"admin-ok\"") != std::string::npos) {
      const size_t detailPos = json.find("\"detail\":\"");
      if (detailPos != std::string::npos) {
        const size_t start = detailPos + 10;
        const size_t end = json.find('"', start);
        if (end != std::string::npos) {
          g_adminFeedback = json.substr(start, end - start);
        }
      }
    } else if (json.find("\"t\":\"error\"") != std::string::npos) {
      const size_t reasonPos = json.find("\"reason\":\"");
      if (reasonPos != std::string::npos) {
        const size_t start = reasonPos + 10;
        const size_t end = json.find('"', start);
        if (end != std::string::npos) {
          g_adminFeedback = json.substr(start, end - start);
        }
      }
    }
  }
}

}  // namespace

Config loadConfig() {
  Config config;
  config.host = getEnv("FMP_MP_HOST", "127.0.0.1");
  config.port = static_cast<uint16_t>(std::atoi(getEnv("FMP_MP_PORT", "5000").c_str()));
  config.roomId = getEnv("FMP_MP_ROOM", "");
  config.token = getEnv("FMP_MP_TOKEN", "");
  config.truckId = getEnv("FMP_TRUCK_ID", "dll-client");
  return config;
}

void run() {
  WSADATA wsa{};
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
    logLine("WSAStartup a echoue");
    return;
  }

  g_config = loadConfig();
  if (g_config.roomId.empty()) {
    logLine("FMP_MP_ROOM manquant : renseigne l'id de salle (GET /rooms)");
  }

  g_socket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
  if (g_socket == INVALID_SOCKET) {
    logLine("socket() a echoue");
    WSACleanup();
    return;
  }

  g_server.sin_family = AF_INET;
  g_server.sin_port = htons(g_config.port);
  inet_pton(AF_INET, g_config.host.c_str(), &g_server.sin_addr);

  logLine("demarrage : %s:%u", g_config.host.c_str(), g_config.port);

  // Overlay in-game (hook D3D11 Present).
  installD3D11Hook();

  // Thread d'écoute de la touche TAB (panneau joueurs).
  HANDLE tabThread = CreateThread(nullptr, 0, TabKeyThread, nullptr, 0, nullptr);
  if (tabThread != nullptr) {
    CloseHandle(tabThread);
  }

  // Thread de saisie du chat (Y pour ouvrir).
  HANDLE chatThread = CreateThread(nullptr, 0, ChatThread, nullptr, 0, nullptr);
  if (chatThread != nullptr) {
    CloseHandle(chatThread);
  }

  // Thread du panneau admin in-game (F8).
  HANDLE adminThread =
      CreateThread(nullptr, 0, AdminPanelThread, nullptr, 0, nullptr);
  if (adminThread != nullptr) {
    CloseHandle(adminThread);
  }

  // Adaptateur moteur : tentative de résolution des hooks 3D (spawn/update).
  g_gameAdapter.initialize();

  // Thread d'interpolation/rendu des entités distantes (~60 Hz).
  HANDLE interpThread =
      CreateThread(nullptr, 0, InterpolationThread, nullptr, 0, nullptr);
  if (interpThread != nullptr) {
    CloseHandle(interpThread);
  }

  sendJoin();

  auto lastState = std::chrono::steady_clock::now();

  while (true) {
    fd_set readSet;
    FD_ZERO(&readSet);
    FD_SET(g_socket, &readSet);
    timeval timeout{0, 50000};  // 50 ms

    int ready = select(0, &readSet, nullptr, nullptr, &timeout);
    if (ready > 0) {
      unsigned char buffer[4096];
      sockaddr_in from{};
      int fromLength = sizeof(from);
      int received = recvfrom(g_socket, reinterpret_cast<char*>(buffer),
                              sizeof(buffer), 0,
                              reinterpret_cast<sockaddr*>(&from), &fromLength);
      if (received > 0) {
        handleMessage(buffer, received);
      }
    }

    // Envoi d'état à 10 Hz (si le jeu fournit une position).
    auto now = std::chrono::steady_clock::now();
    if (std::chrono::duration_cast<std::chrono::milliseconds>(now - lastState).count() > 100) {
      sendStateToServer();
      lastState = now;
    }
  }
}

/* ---------- Hooks de jeu ---------- */

namespace {
RemoteEntity toEntity(const RemotePlayer& player) {
  RemoteEntity entity;
  entity.numId = player.numId;
  entity.x = player.x;
  entity.z = player.z;
  entity.heading = player.heading;
  entity.speed = player.speed;
  return entity;
}
}  // namespace

void onPlayerSpawn(const RemotePlayer& player) {
  g_entities.spawn(toEntity(player));
}

void onPlayerUpdate(const RemotePlayer& player) {
  g_entities.update(toEntity(player));
}

void onPlayerRemove(uint16_t numId) {
  g_entities.remove(numId);
}

bool getLocalTruck(float& x, float& z, float& heading, float& speedKmh) {
  // Lit la shared memory écrite par le plugin SCS (scs-telemetry.dll).
  // Layout extrait du parseur trucksim-telemetry (dist/data/updateTelemetryData.js) :
  //   speed       float  @ 948   (m/s)
  //   coordinateX double @ 2200
  //   coordinateY double @ 2208
  //   coordinateZ double @ 2216
  //   rotationX   double @ 2224  (radians)
  //   rotationY   double @ 2232  (radians)
  //   rotationZ   double @ 2240  (radians)
  static HANDLE mapping = nullptr;
  static const unsigned char* view = nullptr;

  if (view == nullptr) {
    mapping = OpenFileMappingA(FILE_MAP_READ, FALSE, "Local\\SCSTelemetry");
    if (mapping == nullptr) {
      return false;  // plugin absent / jeu fermé
    }
    view = static_cast<const unsigned char*>(
        MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 32 * 1024));
    if (view == nullptr) {
      CloseHandle(mapping);
      mapping = nullptr;
      return false;
    }
  }

  constexpr size_t kSpeedOffset = 948;
  constexpr size_t kCoordinateX = 2200;
  constexpr size_t kCoordinateZ = 2216;
  constexpr size_t kRotationY = 2232;

  float speedMs = 0.0f;
  double coordX = 0.0;
  double coordZ = 0.0;
  double rotY = 0.0;
  std::memcpy(&speedMs, view + kSpeedOffset, sizeof(float));
  std::memcpy(&coordX, view + kCoordinateX, sizeof(double));
  std::memcpy(&coordZ, view + kCoordinateZ, sizeof(double));
  std::memcpy(&rotY, view + kRotationY, sizeof(double));

  // Ignore les valeurs aberrantes (jeu pas encore en partie).
  if (coordX == 0.0 && coordZ == 0.0) {
    return false;
  }

  x = static_cast<float>(coordX);
  z = static_cast<float>(coordZ);
  heading = static_cast<float>(rotY * 180.0 / 3.14159265358979323846);
  speedKmh = speedMs * 3.6f;
  return true;
}

std::vector<RemotePlayer> getNearbyPlayers() {
  std::vector<RemotePlayer> players;
  players.reserve(g_players.size());
  for (const auto& entry : g_players) {
    players.push_back(entry.second);
  }
  return players;
}

std::vector<RemotePlayer> getSortedPlayers() {
  std::vector<RemotePlayer> players = getNearbyPlayers();

  float localX = 0.0f;
  float localZ = 0.0f;
  float localHeading = 0.0f;
  float localSpeed = 0.0f;
  const bool hasLocal = getLocalTruck(localX, localZ, localHeading, localSpeed);

  std::sort(players.begin(), players.end(),
            [hasLocal, localX, localZ](const RemotePlayer& a,
                                       const RemotePlayer& b) {
              if (!hasLocal) {
                return a.numId < b.numId;
              }
              const float da = (a.x - localX) * (a.x - localX) +
                               (a.z - localZ) * (a.z - localZ);
              const float db = (b.x - localX) * (b.x - localX) +
                               (b.z - localZ) * (b.z - localZ);
              return da < db;
            });

  return players;
}

bool isPlayerMuted(uint16_t numId) {
  return g_muted.count(numId) > 0;
}

int getTabSelected() {
  return g_tabSelected;
}

std::string getPlayerName(uint16_t numId) {
  const auto it = g_playerNames.find(numId);
  if (it == g_playerNames.end()) {
    return std::string();
  }
  return it->second;
}

uint16_t getPlayerPing(uint16_t numId) {
  const auto it = g_playerPings.find(numId);
  if (it == g_playerPings.end()) {
    return 0;
  }
  return it->second;
}

std::string getPlayerTag(uint16_t numId) {
  const auto it = g_playerTags.find(numId);
  if (it == g_playerTags.end()) {
    return std::string();
  }
  return it->second;
}

std::string getPlayerCountry(uint16_t numId) {
  const auto it = g_playerCountries.find(numId);
  if (it == g_playerCountries.end()) {
    return std::string();
  }
  return it->second;
}

bool isTabPanelVisible() {
  return g_showTabPanel;
}

std::vector<ChatMessage> getChatMessages() {
  return std::vector<ChatMessage>(g_chatMessages.begin(), g_chatMessages.end());
}

CollisionAlert getLastCollision() {
  return g_lastCollision;
}

EnvironmentState getEnvironment() {
  return g_environment;
}

bool isChatOpen() {
  return g_chatOpen;
}

std::string getChatInput() {
  return g_chatInput;
}

/* ---------- Panneau admin in-game (F8) ---------- */

std::string getPlayerRole(uint16_t numId) {
  const auto it = g_playerRoles.find(numId);
  if (it == g_playerRoles.end()) {
    return "DRIVER";
  }
  return it->second;
}

std::string getLocalRole() {
  return g_localRole;
}

bool isLocalAdmin() {
  return g_localRole == "ADMIN" || g_localRole == "MODERATOR";
}

bool isAdminPanelVisible() {
  return g_showAdminPanel;
}

int getAdminSelected() {
  return g_adminSelected;
}

int getAdminAction() {
  return g_adminAction;
}

std::vector<std::string> getAdminActions() {
  return kAdminActions;
}

std::string getAdminFeedback() {
  return g_adminFeedback;
}

}  // namespace fmp
