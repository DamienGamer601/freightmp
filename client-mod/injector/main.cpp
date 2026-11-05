#include <windows.h>

#include <cstdio>

/**
 * Injecteur minimal (LoadLibraryW via CreateRemoteThread).
 *
 * Usage : injector.exe <pid> <chemin_absolu_dll>
 *
 * ⚠️ À n'utiliser que sur ton propre jeu / processus de test.
 */
int wmain(int argc, wchar_t** argv) {
  if (argc < 3) {
    wprintf(L"usage: injector.exe <pid> <dll-path>\n");
    return 1;
  }

  DWORD pid = static_cast<DWORD>(wcstoul(argv[1], nullptr, 10));
  const wchar_t* dllPath = argv[2];

  HANDLE process = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
  if (process == nullptr) {
    wprintf(L"OpenProcess(%lu) a echoue : %lu\n", pid, GetLastError());
    return 1;
  }

  size_t size = (wcslen(dllPath) + 1) * sizeof(wchar_t);
  LPVOID remote = VirtualAllocEx(process, nullptr, size,
                                 MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (remote == nullptr) {
    wprintf(L"VirtualAllocEx a echoue : %lu\n", GetLastError());
    CloseHandle(process);
    return 1;
  }

  if (!WriteProcessMemory(process, remote, dllPath, size, nullptr)) {
    wprintf(L"WriteProcessMemory a echoue : %lu\n", GetLastError());
    CloseHandle(process);
    return 1;
  }

  HMODULE kernel = GetModuleHandleW(L"kernel32.dll");
  FARPROC loadLibrary = GetProcAddress(kernel, "LoadLibraryW");
  if (loadLibrary == nullptr) {
    wprintf(L"GetProcAddress(LoadLibraryW) a echoue\n");
    CloseHandle(process);
    return 1;
  }

  HANDLE thread =
      CreateRemoteThread(process, nullptr, 0,
                         reinterpret_cast<LPTHREAD_START_ROUTINE>(loadLibrary),
                         remote, 0, nullptr);
  if (thread == nullptr) {
    wprintf(L"CreateRemoteThread a echoue : %lu\n", GetLastError());
    CloseHandle(process);
    return 1;
  }

  WaitForSingleObject(thread, 5000);
  wprintf(L"DLL injectee dans pid=%lu\n", pid);

  CloseHandle(thread);
  CloseHandle(process);
  return 0;
}
