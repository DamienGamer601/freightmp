param(
  [Parameter(Mandatory = $true)]
  [string]$Token,

  [string]$TruckId = "damiengamer60",
  [string]$Game = "ETS2",
  [string]$ApiHost = "192.168.1.58",
  [string]$ClientDir = "C:\FreightMP\telemetry-client",
  [switch]$Mock
)

# --- Configuration FreightMP ---
$env:FMP_API_URL  = "http://${ApiHost}:4000"
$env:MP_HOST      = $ApiHost
$env:MP_UDP_PORT  = "5000"
$env:MP_HTTP_PORT = "5001"
$env:MP_TOKEN     = $Token
$env:FMP_MP       = "1"
$env:FMP_GAME     = $Game
$env:FMP_TRUCK_ID = $TruckId

if (-not (Test-Path $ClientDir)) {
  Write-Host "Dossier introuvable : $ClientDir" -ForegroundColor Red
  Write-Host "Modifie -ClientDir pour pointer vers telemetry-client."
  exit 1
}

Set-Location $ClientDir
Write-Host "FreightMP : API=$($env:FMP_API_URL) · MP=$($env:MP_HOST):$($env:MP_UDP_PORT) · camion=$TruckId" -ForegroundColor Cyan

if ($Mock) {
  Write-Host "Mode MOCK (sans jeu)" -ForegroundColor Yellow
  npm run mock
} else {
  Write-Host "Mode JEU (lance ETS2/ATS et prends un job)" -ForegroundColor Green
  npm run dev
}
