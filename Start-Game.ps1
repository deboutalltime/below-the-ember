$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $gameNode = $nodeCommand.Source }
else { $gameNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $gameNode)) { throw 'Install Node.js 22 LTS, then run npm install and npm run dev.' }
if (-not (Test-Path -LiteralPath 'node_modules\vite\bin\vite.js')) { throw 'Dependencies missing. Run npm install first.' }
& $gameNode 'node_modules\vite\bin\vite.js' --host 127.0.0.1 --port 5180 --open
