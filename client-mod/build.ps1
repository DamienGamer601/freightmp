# Compile la DLL client et l'injecteur FreightMP (MSVC x64).
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$vcvars = Get-ChildItem "C:\Program Files (x86)\Microsoft Visual Studio" -Recurse -Filter "vcvarsall.bat" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $vcvars) {
  throw "vcvarsall.bat introuvable : installe 'Desktop development with C++' (VS Build Tools)."
}
Write-Host "vcvars : $($vcvars.FullName)"

$bat = @"
call "$($vcvars.FullName)" x64 >nul
cd /d "$root"
cl /nologo /LD /O2 /EHsc /Fe:"$buildDir\fmp-client.dll" dll\dllmain.cpp dll\core.cpp dll\entity.cpp dll\interpolation.cpp dll\pattern.cpp dll\game_adapter.cpp dll\overlay.cpp dll\d3d_hook.cpp /link ws2_32.lib user32.lib d3d11.lib dxgi.lib d2d1.lib dwrite.lib
if errorlevel 1 exit /b 1
cl /nologo /O2 /EHsc /Fe:"$buildDir\injector.exe" injector\main.cpp
"@
$bat | Out-File -Encoding ascii "$buildDir\build.bat"
cmd /c "$buildDir\build.bat"

if (Test-Path "$buildDir\fmp-client.dll") {
  Write-Host "OK : $buildDir\fmp-client.dll"
}
if (Test-Path "$buildDir\injector.exe") {
  Write-Host "OK : $buildDir\injector.exe"
}
