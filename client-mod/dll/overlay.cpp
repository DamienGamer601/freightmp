#include "overlay.h"

#include "core.h"

#include <windows.h>
#include <d2d1.h>
#include <d2d1helper.h>
#include <dwrite.h>
#include <dxgi.h>

#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

#pragma comment(lib, "d2d1.lib")
#pragma comment(lib, "dwrite.lib")

namespace fmp {

namespace {
ID2D1Factory* g_d2dFactory = nullptr;
IDWriteFactory* g_dwriteFactory = nullptr;
IDWriteTextFormat* g_titleFormat = nullptr;
IDWriteTextFormat* g_bodyFormat = nullptr;
ID2D1RenderTarget* g_renderTarget = nullptr;
ID2D1SolidColorBrush* g_bgBrush = nullptr;
ID2D1SolidColorBrush* g_textBrush = nullptr;
ID2D1SolidColorBrush* g_accentBrush = nullptr;
ID2D1SolidColorBrush* g_radarBrush = nullptr;
IDXGISwapChain* g_swapChain = nullptr;
UINT g_width = 0;
UINT g_height = 0;

void releaseBrushes() {
  if (g_bgBrush != nullptr) {
    g_bgBrush->Release();
    g_bgBrush = nullptr;
  }
  if (g_textBrush != nullptr) {
    g_textBrush->Release();
    g_textBrush = nullptr;
  }
  if (g_accentBrush != nullptr) {
    g_accentBrush->Release();
    g_accentBrush = nullptr;
  }
  if (g_radarBrush != nullptr) {
    g_radarBrush->Release();
    g_radarBrush = nullptr;
  }
}

bool createRenderTarget(IDXGISwapChain* swapChain) {
  DXGI_SWAP_CHAIN_DESC desc{};
  if (swapChain == nullptr || FAILED(swapChain->GetDesc(&desc))) {
    return false;
  }

  if (g_renderTarget != nullptr && g_swapChain == swapChain &&
      g_width == desc.BufferDesc.Width && g_height == desc.BufferDesc.Height) {
    return true;
  }

  releaseBrushes();
  if (g_renderTarget != nullptr) {
    g_renderTarget->Release();
    g_renderTarget = nullptr;
  }

  IDXGISurface* surface = nullptr;
  if (FAILED(swapChain->GetBuffer(0, IID_PPV_ARGS(&surface)))) {
    return false;
  }

  D2D1_RENDER_TARGET_PROPERTIES props = D2D1::RenderTargetProperties(
      D2D1_RENDER_TARGET_TYPE_DEFAULT,
      D2D1::PixelFormat(DXGI_FORMAT_UNKNOWN, D2D1_ALPHA_MODE_PREMULTIPLIED));

  HRESULT result = g_d2dFactory->CreateDxgiSurfaceRenderTarget(surface, &props,
                                                               &g_renderTarget);
  surface->Release();
  if (FAILED(result) || g_renderTarget == nullptr) {
    return false;
  }

  g_renderTarget->CreateSolidColorBrush(D2D1::ColorF(0.04f, 0.05f, 0.06f, 0.85f),
                                        &g_bgBrush);
  g_renderTarget->CreateSolidColorBrush(D2D1::ColorF(0.93f, 0.93f, 0.95f, 1.0f),
                                        &g_textBrush);
  g_renderTarget->CreateSolidColorBrush(D2D1::ColorF(0.88f, 0.23f, 0.23f, 1.0f),
                                        &g_accentBrush);
  g_renderTarget->CreateSolidColorBrush(D2D1::ColorF(1.0f, 1.0f, 1.0f, 0.20f),
                                        &g_radarBrush);

  g_swapChain = swapChain;
  g_width = desc.BufferDesc.Width;
  g_height = desc.BufferDesc.Height;
  return true;
}

/** Dessine un radar (positions relatives des joueurs). */
void drawRadar(ID2D1RenderTarget* target, float centerX, float centerY,
               float radius, const std::vector<RemotePlayer>& players) {
  float localX = 0.0f;
  float localZ = 0.0f;
  float localHeading = 0.0f;
  float localSpeed = 0.0f;
  const bool hasLocal =
      getLocalTruck(localX, localZ, localHeading, localSpeed);

  // Cercle de portée.
  D2D1_ELLIPSE outer = D2D1::Ellipse(D2D1::Point2F(centerX, centerY), radius,
                                     radius);
  if (g_radarBrush != nullptr) {
    target->DrawEllipse(outer, g_radarBrush, 1.0f);
    D2D1_ELLIPSE inner = D2D1::Ellipse(
        D2D1::Point2F(centerX, centerY), radius * 0.5f, radius * 0.5f);
    target->DrawEllipse(inner, g_radarBrush, 1.0f);
  }

  // Joueur local au centre.
  if (g_textBrush != nullptr) {
    D2D1_ELLIPSE center =
        D2D1::Ellipse(D2D1::Point2F(centerX, centerY), 3.0f, 3.0f);
    target->FillEllipse(center, g_textBrush);
  }

  if (!hasLocal) {
    return;  // pas encore de position locale
  }

  const float range = 1000.0f;  // unités de jeu représentées par le radar

  for (const auto& player : players) {
    const float dx = player.x - localX;
    const float dz = player.z - localZ;
    const float distance = std::sqrt(dx * dx + dz * dz);
    if (distance > range) {
      continue;
    }

    const float px = centerX + (dx / range) * radius;
    const float py = centerY + (dz / range) * radius;
    D2D1_ELLIPSE dot = D2D1::Ellipse(D2D1::Point2F(px, py), 4.0f, 4.0f);
    if (g_accentBrush != nullptr) {
      target->FillEllipse(dot, g_accentBrush);
    }
  }
}

/** Panneau TAB : joueurs proches (ID, tag, pseudo, ping, distance, vitesse, mute). */
void drawTabPanel(ID2D1RenderTarget* target) {
  const auto players = getSortedPlayers();

  float localX = 0.0f;
  float localZ = 0.0f;
  float localHeading = 0.0f;
  float localSpeed = 0.0f;
  const bool hasLocal = getLocalTruck(localX, localZ, localHeading, localSpeed);
  const int selected = getTabSelected();

  const float width = 840.0f;
  const float height = 70.0f + static_cast<float>(players.size()) * 24.0f;
  const float x = 40.0f;
  const float y = 40.0f;
  D2D1_RECT_F panel = D2D1::RectF(x, y, x + width, y + height);
  if (g_bgBrush != nullptr) {
    target->FillRectangle(panel, g_bgBrush);
  }

  wchar_t buffer[256];

  if (g_titleFormat != nullptr) {
    swprintf_s(buffer, L"Joueurs proches (%u)",
               static_cast<unsigned>(players.size()));
    target->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)), g_titleFormat,
                     D2D1::RectF(x + 20.0f, y + 12.0f, x + width, y + 40.0f),
                     g_accentBrush);
  }

  if (g_bodyFormat == nullptr) {
    return;
  }

  target->DrawText(L"ID", 2, g_bodyFormat,
                   D2D1::RectF(x + 20.0f, y + 46.0f, x + 70.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Pays", 4, g_bodyFormat,
                   D2D1::RectF(x + 70.0f, y + 46.0f, x + 130.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Tag", 3, g_bodyFormat,
                   D2D1::RectF(x + 130.0f, y + 46.0f, x + 200.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Pseudo", 6, g_bodyFormat,
                   D2D1::RectF(x + 200.0f, y + 46.0f, x + 440.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Ping", 4, g_bodyFormat,
                   D2D1::RectF(x + 440.0f, y + 46.0f, x + 510.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Distance", 8, g_bodyFormat,
                   D2D1::RectF(x + 510.0f, y + 46.0f, x + 600.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Vitesse", 7, g_bodyFormat,
                   D2D1::RectF(x + 600.0f, y + 46.0f, x + 690.0f, y + 66.0f),
                   g_textBrush);
  target->DrawText(L"Mute", 4, g_bodyFormat,
                   D2D1::RectF(x + 690.0f, y + 46.0f, x + width - 20.0f, y + 66.0f),
                   g_textBrush);

  float rowY = y + 68.0f;
  for (int index = 0; index < static_cast<int>(players.size()); ++index) {
    const RemotePlayer& player = players[index];

    if (index == selected && g_radarBrush != nullptr) {
      D2D1_RECT_F rowBackground =
          D2D1::RectF(x + 8.0f, rowY - 2.0f, x + width - 8.0f, rowY + 22.0f);
      target->FillRectangle(rowBackground, g_radarBrush);
    }

    float distance = 0.0f;
    if (hasLocal) {
      const float dx = player.x - localX;
      const float dz = player.z - localZ;
      distance = std::sqrt(dx * dx + dz * dz);
    }

    swprintf_s(buffer, L"%u", player.numId);
    target->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)), g_bodyFormat,
                     D2D1::RectF(x + 20.0f, rowY, x + 70.0f, rowY + 22.0f),
                     g_textBrush);

    const std::string country = getPlayerCountry(player.numId);
    const std::wstring wideCountry(country.begin(), country.end());
    target->DrawText(wideCountry.c_str(), static_cast<UINT32>(wideCountry.size()),
                     g_bodyFormat,
                     D2D1::RectF(x + 70.0f, rowY, x + 130.0f, rowY + 22.0f),
                     g_textBrush);

    const std::string tag = getPlayerTag(player.numId);
    const std::wstring wideTag(tag.begin(), tag.end());
    target->DrawText(wideTag.c_str(), static_cast<UINT32>(wideTag.size()),
                     g_bodyFormat,
                     D2D1::RectF(x + 130.0f, rowY, x + 200.0f, rowY + 22.0f),
                     g_accentBrush);

    std::string name = getPlayerName(player.numId);
    if (name.empty()) {
      name = "#" + std::to_string(player.numId);
    }
    const std::wstring wideName(name.begin(), name.end());
    target->DrawText(wideName.c_str(), static_cast<UINT32>(wideName.size()),
                     g_bodyFormat,
                     D2D1::RectF(x + 200.0f, rowY, x + 440.0f, rowY + 22.0f),
                     g_textBrush);

    swprintf_s(buffer, L"%u ms", getPlayerPing(player.numId));
    target->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)), g_bodyFormat,
                     D2D1::RectF(x + 440.0f, rowY, x + 510.0f, rowY + 22.0f),
                     g_textBrush);

    swprintf_s(buffer, L"%.0f m", distance);
    target->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)), g_bodyFormat,
                     D2D1::RectF(x + 510.0f, rowY, x + 600.0f, rowY + 22.0f),
                     g_textBrush);

    swprintf_s(buffer, L"%.0f km/h", player.speed);
    target->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)), g_bodyFormat,
                     D2D1::RectF(x + 600.0f, rowY, x + 690.0f, rowY + 22.0f),
                     g_textBrush);

    const wchar_t* muteText = isPlayerMuted(player.numId) ? L"MUTE" : L"";
    target->DrawText(muteText, static_cast<UINT32>(wcslen(muteText)),
                     g_bodyFormat,
                     D2D1::RectF(x + 690.0f, rowY, x + width - 20.0f, rowY + 22.0f),
                     g_accentBrush);

    rowY += 24.0f;
  }
}

/** Alerte de collision (bandeau rouge en haut, 3 s). */
void drawCollisionWarning(ID2D1RenderTarget* target, float screenWidth) {
  const CollisionAlert alert = getLastCollision();
  if (!alert.active) {
    return;
  }
  const uint32_t age = GetTickCount() - alert.at;
  if (age > 3000) {
    return;
  }
  if (g_bodyFormat == nullptr || g_accentBrush == nullptr) {
    return;
  }

  wchar_t buffer[128];
  if (alert.other != 0) {
    swprintf_s(buffer, L"COLLISION avec #%u", alert.other);
  } else {
    swprintf_s(buffer, L"COLLISION");
  }

  const float width = 340.0f;
  const float x = (screenWidth - width) / 2.0f;
  D2D1_RECT_F panel = D2D1::RectF(x, 12.0f, x + width, 54.0f);
  if (g_bgBrush != nullptr) {
    target->FillRectangle(panel, g_bgBrush);
  }
  target->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)), g_bodyFormat,
                   D2D1::RectF(x + 16.0f, 24.0f, x + width - 16.0f, 46.0f),
                   g_accentBrush);
}

/** Chat in-game : derniers messages + saisie en cours. */
void drawChat(ID2D1RenderTarget* target, float screenHeight) {
  const auto messages = getChatMessages();
  const bool open = isChatOpen();
  const std::string input = getChatInput();

  const int maxLines = 8;
  const int count = static_cast<int>(messages.size());
  const int shown = count < maxLines ? count : maxLines;
  if (shown == 0 && !open) {
    return;
  }

  const float lineHeight = 20.0f;
  const float width = 620.0f;
  const float x = 12.0f;
  const float baseY = screenHeight - 40.0f -
                      static_cast<float>(shown) * lineHeight -
                      (open ? 30.0f : 0.0f);

  D2D1_RECT_F background =
      D2D1::RectF(x, baseY - 20.0f, x + width, screenHeight - 12.0f);
  if (g_bgBrush != nullptr) {
    target->FillRectangle(background, g_bgBrush);
  }

  if (g_bodyFormat == nullptr) {
    return;
  }

  float y = baseY;
  const int start = count - shown;
  for (int index = start; index < count; ++index) {
    const ChatMessage& message = messages[index];
    std::string line = message.name + ": " + message.message;
    if (line.size() > 100) {
      line = line.substr(0, 100);
    }
    const std::wstring wide(line.begin(), line.end());
    target->DrawText(wide.c_str(), static_cast<UINT32>(wide.size()), g_bodyFormat,
                     D2D1::RectF(x + 8.0f, y, x + width - 8.0f, y + lineHeight),
                     g_textBrush);
    y += lineHeight;
  }

  if (open) {
    std::string line = "> " + input + "|";
    const std::wstring wide(line.begin(), line.end());
    target->DrawText(wide.c_str(), static_cast<UINT32>(wide.size()), g_bodyFormat,
                     D2D1::RectF(x + 8.0f, y, x + width - 8.0f, y + lineHeight),
                     g_accentBrush);
  }
}
}  // namespace

bool overlayInstall(IDXGISwapChain* swapChain) {
  if (g_d2dFactory == nullptr &&
      FAILED(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, &g_d2dFactory))) {
    return false;
  }
  if (g_dwriteFactory == nullptr &&
      FAILED(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED,
                                 __uuidof(IDWriteFactory),
                                 reinterpret_cast<IUnknown**>(&g_dwriteFactory)))) {
    return false;
  }

  if (g_titleFormat == nullptr && g_dwriteFactory != nullptr) {
    g_dwriteFactory->CreateTextFormat(
        L"Segoe UI", nullptr, DWRITE_FONT_WEIGHT_BOLD, DWRITE_FONT_STYLE_NORMAL,
        DWRITE_FONT_STRETCH_NORMAL, 16.0f, L"en-us", &g_titleFormat);
  }
  if (g_bodyFormat == nullptr && g_dwriteFactory != nullptr) {
    g_dwriteFactory->CreateTextFormat(
        L"Segoe UI", nullptr, DWRITE_FONT_WEIGHT_NORMAL, DWRITE_FONT_STYLE_NORMAL,
        DWRITE_FONT_STRETCH_NORMAL, 13.0f, L"en-us", &g_bodyFormat);
  }

  return createRenderTarget(swapChain);
}

void overlayRender(IDXGISwapChain* swapChain) {
  if (g_d2dFactory == nullptr || g_dwriteFactory == nullptr) {
    if (!overlayInstall(swapChain)) {
      return;
    }
  }
  if (g_renderTarget == nullptr || g_swapChain != swapChain) {
    if (!createRenderTarget(swapChain)) {
      return;
    }
  }

  const auto players = getNearbyPlayers();

  g_renderTarget->BeginDraw();

  const float panelWidth = 560.0f;
  const float textRight = 12.0f + panelWidth - 180.0f;
  const size_t rows = players.size() > 5 ? players.size() : 5;
  const float panelHeight = 70.0f + static_cast<float>(rows) * 22.0f + 30.0f;
  D2D1_RECT_F panel =
      D2D1::RectF(12.0f, 12.0f, 12.0f + panelWidth, 12.0f + panelHeight);
  g_renderTarget->FillRectangle(panel, g_bgBrush);

  wchar_t buffer[256];

  if (g_titleFormat != nullptr) {
    const wchar_t* title = L"FreightMP - Multijoueur";
    D2D1_RECT_F titleRect = D2D1::RectF(24.0f, 18.0f, textRight, 40.0f);
    g_renderTarget->DrawText(title, static_cast<UINT32>(wcslen(title)),
                             g_titleFormat, titleRect, g_accentBrush);
  }

  if (g_bodyFormat != nullptr) {
    swprintf_s(buffer, L"%u joueur(s) proche(s)",
               static_cast<unsigned>(players.size()));
    D2D1_RECT_F countRect = D2D1::RectF(24.0f, 40.0f, textRight, 60.0f);
    g_renderTarget->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)),
                             g_bodyFormat, countRect, g_textBrush);

    // Météo + heure du jour partagées.
    const EnvironmentState environment = getEnvironment();
    const int hours = (environment.timeOfDay / 60) % 24;
    const int minutes = environment.timeOfDay % 60;
    swprintf_s(buffer, L"Meteo : %hs  -  %02d:%02d", environment.weather.c_str(),
               hours, minutes);
    D2D1_RECT_F envRect = D2D1::RectF(24.0f, 62.0f, textRight, 82.0f);
    g_renderTarget->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)),
                             g_bodyFormat, envRect, g_textBrush);

    float y = 88.0f;
    for (const auto& player : players) {
      swprintf_s(buffer, L"#%u  -  %.0f km/h  -  (%.0f, %.0f)", player.numId,
                 player.speed, player.x, player.z);
      D2D1_RECT_F rect = D2D1::RectF(24.0f, y, textRight, y + 20.0f);
      g_renderTarget->DrawText(buffer, static_cast<UINT32>(wcslen(buffer)),
                               g_bodyFormat, rect, g_textBrush);
      y += 22.0f;
    }
  }

  // Radar (en haut à droite du panneau).
  drawRadar(g_renderTarget, 12.0f + panelWidth - 100.0f, 12.0f + 95.0f, 70.0f,
            players);

  // Panneau TAB (touche TAB).
  if (isTabPanelVisible()) {
    drawTabPanel(g_renderTarget);
  }

  // Chat in-game (Y pour saisir).
  const D2D1_SIZE_F size = g_renderTarget->GetSize();
  drawChat(g_renderTarget, size.height);

  // Alerte de collision (bandeau rouge en haut).
  drawCollisionWarning(g_renderTarget, size.width);

  g_renderTarget->EndDraw();
}

void overlayShutdown() {
  releaseBrushes();
  if (g_renderTarget != nullptr) {
    g_renderTarget->Release();
    g_renderTarget = nullptr;
  }
  if (g_titleFormat != nullptr) {
    g_titleFormat->Release();
    g_titleFormat = nullptr;
  }
  if (g_bodyFormat != nullptr) {
    g_bodyFormat->Release();
    g_bodyFormat = nullptr;
  }
  if (g_dwriteFactory != nullptr) {
    g_dwriteFactory->Release();
    g_dwriteFactory = nullptr;
  }
  if (g_d2dFactory != nullptr) {
    g_d2dFactory->Release();
    g_d2dFactory = nullptr;
  }
}

}  // namespace fmp
