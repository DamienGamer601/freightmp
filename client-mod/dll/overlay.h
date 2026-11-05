#pragma once

struct IDXGISwapChain;

namespace fmp {

/** Initialise l'overlay (factories D2D/DWrite + render target). */
bool overlayInstall(IDXGISwapChain* swapChain);

/** Dessine l'overlay (appelé depuis le hook Present). */
void overlayRender(IDXGISwapChain* swapChain);

/** Libère les ressources. */
void overlayShutdown();

}  // namespace fmp
