#include "d3d_hook.h"
#include "overlay.h"

#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

namespace fmp {

namespace {

using PresentFn = HRESULT(WINAPI*)(IDXGISwapChain*, UINT, UINT);

PresentFn g_originalPresent = nullptr;
volatile long g_frameCount = 0;
void** g_swapChainVtable = nullptr;

LRESULT CALLBACK DummyWndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam) {
  return DefWindowProc(hwnd, msg, wparam, lparam);
}

HWND createDummyWindow() {
  const wchar_t* className = L"FmpDummyOverlayWindow";

  WNDCLASSEXW wndClass{};
  wndClass.cbSize = sizeof(wndClass);
  wndClass.lpfnWndProc = DummyWndProc;
  wndClass.hInstance = GetModuleHandleW(nullptr);
  wndClass.lpszClassName = className;
  RegisterClassExW(&wndClass);

  return CreateWindowExW(0, className, L"", WS_OVERLAPPEDWINDOW, 0, 0, 64, 64,
                         nullptr, nullptr, wndClass.hInstance, nullptr);
}

HRESULT WINAPI HookedPresent(IDXGISwapChain* swapChain, UINT syncInterval,
                             UINT flags) {
  // Rendering de l'overlay (stub pour l'instant).
  InterlockedIncrement(&g_frameCount);
  renderOverlay(swapChain);

  return g_originalPresent(swapChain, syncInterval, flags);
}

}  // namespace

void installD3D11Hook() {
  if (g_originalPresent != nullptr) {
    return;  // déjà installé
  }

  HWND window = createDummyWindow();
  if (window == nullptr) {
    OutputDebugStringA("[FMP] D3D11: impossible de creer la fenetre factice\n");
    return;
  }

  DXGI_SWAP_CHAIN_DESC desc{};
  desc.BufferCount = 1;
  desc.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
  desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
  desc.OutputWindow = window;
  desc.SampleDesc.Count = 1;
  desc.Windowed = TRUE;
  desc.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;

  ID3D11Device* device = nullptr;
  ID3D11DeviceContext* context = nullptr;
  IDXGISwapChain* swapChain = nullptr;

  HRESULT result = D3D11CreateDeviceAndSwapChain(
      nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, nullptr, 0,
      D3D11_SDK_VERSION, &desc, &swapChain, &device, nullptr, &context);

  if (FAILED(result) || swapChain == nullptr) {
    OutputDebugStringA("[FMP] D3D11: creation du device factice echouee\n");
    DestroyWindow(window);
    return;
  }

  // Vtable de IDXGISwapChain.
  g_swapChainVtable = *reinterpret_cast<void***>(swapChain);
  g_originalPresent =
      reinterpret_cast<PresentFn>(g_swapChainVtable[8]);  // Present = index 8

  DWORD oldProtect = 0;
  if (VirtualProtect(&g_swapChainVtable[8], sizeof(void*), PAGE_READWRITE,
                     &oldProtect)) {
    g_swapChainVtable[8] = reinterpret_cast<void*>(&HookedPresent);
    VirtualProtect(&g_swapChainVtable[8], sizeof(void*), oldProtect,
                   &oldProtect);
    OutputDebugStringA("[FMP] D3D11: hook Present installe\n");
  } else {
    OutputDebugStringA("[FMP] D3D11:VirtualProtect a echoue\n");
  }

  swapChain->Release();
  if (context != nullptr) {
    context->Release();
  }
  if (device != nullptr) {
    device->Release();
  }
  DestroyWindow(window);
}

void renderOverlay(void* swapChain) {
  // Rendu Direct2D/DirectWrite par-dessus le back buffer du jeu.
  overlayRender(static_cast<IDXGISwapChain*>(swapChain));
}

void uninstallD3D11Hook() {
  // TODO : restaurer g_swapChainVtable[8] = g_originalPresent.
}

}  // namespace fmp
