#pragma once
#include <cstdint>
#include <string>
#include <vector>

struct ChatMessage {
  uint16_t numId = 0;
  std::string name;
  std::string message;
};

struct CollisionAlert {
  bool active = false;
  uint16_t other = 0;
  uint32_t at = 0;
};

struct EnvironmentState {
  std::string weather = "clear";
  int timeOfDay = 720;
};

/**
 * FreightMP — client 3D en jeu (scaffold).
 *
 * Cette DLL :
 *  1. se connecte au serveur multijoueur (UDP, protocole binaire) ;
 *  2. reçoit les snapshots des autres joueurs ;
 *  3. appelle des « hooks » de jeu pour faire apparaître / mettre à jour /
 *     supprimer les camions distants.
 *
 * ⚠️ Les fonctions onPlayerSpawn/onPlayerUpdate/onPlayerRemove sont des STUBS.
 *    Leur implémentation réelle (spawn d'entité, rendu D3D11, hook du moteur)
 *    nécessite le reverse-engineering du jeu — voir README.md.
 */

struct RemotePlayer {
  uint16_t numId = 0;
  float x = 0.0f;
  float z = 0.0f;
  float heading = 0.0f;
  float speed = 0.0f;
};

namespace fmp {

struct Config {
  std::string host = "127.0.0.1";
  uint16_t port = 5000;
  std::string roomId;
  std::string token;
  std::string truckId = "dll-client";
};

/** Charge la config depuis les variables d'environnement FMP_MP_*. */
Config loadConfig();

/** Boucle principale (lancée dans un thread par DllMain). */
void run();

/* ---------- Hooks de jeu (STUBS à implémenter) ---------- */

/** Un joueur distant est apparu : créer son entité camion dans le monde. */
void onPlayerSpawn(const RemotePlayer& player);

/** Un joueur distant a bougé : mettre à jour son entité. */
void onPlayerUpdate(const RemotePlayer& player);

/** Un joueur distant a disparu : détruire son entité. */
void onPlayerRemove(uint16_t numId);

/** Lit la position du camion local (STUB : à brancher sur le SDK SCS). */
bool getLocalTruck(float& x, float& z, float& heading, float& speedKmh);

/** Copie de la liste des joueurs distants (pour l'overlay / debug). */
std::vector<RemotePlayer> getNearbyPlayers();

/** Joueurs distants triés par distance (pour le panneau TAB). */
std::vector<RemotePlayer> getSortedPlayers();

/** Vrai si un joueur est muet (chat). */
bool isPlayerMuted(uint16_t numId);

/** Index sélectionné dans le panneau TAB. */
int getTabSelected();

/** Pseudo FreightMP d'un joueur distant (si connu). */
std::string getPlayerName(uint16_t numId);

/** Latence (ms) d'un joueur distant (si connue). */
uint16_t getPlayerPing(uint16_t numId);

/** Tag de la VTC d'un joueur distant (si connu). */
std::string getPlayerTag(uint16_t numId);

/** Code pays d'un joueur distant (si connu). */
std::string getPlayerCountry(uint16_t numId);

/** Vrai si le panneau TAB doit être affiché. */
bool isTabPanelVisible();

/** Derniers messages de chat reçus (max 50). */
std::vector<ChatMessage> getChatMessages();

/** Dernière alerte de collision reçue. */
CollisionAlert getLastCollision();

/** Météo + heure du jour partagées. */
EnvironmentState getEnvironment();

/** Vrai si la saisie du chat est ouverte. */
bool isChatOpen();

/** Contenu en cours de saisie. */
std::string getChatInput();

}  // namespace fmp
