# Lance le launcher FreightMP.
#
# Certains environnements (IDE, outils Node, shells) définissent
# ELECTRON_RUN_AS_NODE=1 : Electron tourne alors en Node pur, sans API
# app/BrowserWindow, et le launcher plante. On retire la variable ici.

Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

Set-Location $PSScriptRoot
npx electron .
