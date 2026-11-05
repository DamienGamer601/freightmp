#include <windows.h>

#include "core.h"

namespace {
DWORD WINAPI ThreadProc(LPVOID) {
  fmp::run();
  return 0;
}
}  // namespace

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID reserved) {
  (void)reserved;

  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(module);

    HANDLE thread = CreateThread(nullptr, 0, ThreadProc, nullptr, 0, nullptr);
    if (thread != nullptr) {
      CloseHandle(thread);
    }
  }

  return TRUE;
}
