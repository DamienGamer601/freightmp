#pragma once

namespace fmp {

/**
 * Installe un hook sur `IDXGISwapChain::Present` (D3D11).
 *
 * C'est le point d'entrée standard pour dessiner un overlay in-game
 * (liste des joueurs proches, mini-carte, indicateur de connexion…).
 *
 * Technique générique : on crée un device+swapchain factices, on lit la vtable
 * de `IDXGISwapChain` et on remplace l'entrée `Present` (index 8). Les
 * swapchains du jeu partagent la même vtable → le hook s'applique aussi.
 */
void installD3D11Hook();

/** Retire le hook (si implémenté). */
void uninstallD3D11Hook();

/** Appelé depuis le hook Present — dessine l'overlay. */
void renderOverlay(void* swapChain);

}  // namespace fmp
