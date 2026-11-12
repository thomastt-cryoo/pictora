param([switch]$NoBundle, [switch]$OfflineInstaller)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-env.ps1')
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path '.build-tools' | Out-Null
& node build/windows-notices.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$pictoraArguments = @('build', '--target', 'x86_64-pc-windows-msvc')
if ($NoBundle -or $OfflineInstaller) { $pictoraArguments += '--no-bundle' }
& node node_modules/@tauri-apps/cli/tauri.js @pictoraArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($OfflineInstaller -and -not $NoBundle) {
    & node node_modules/@tauri-apps/cli/tauri.js bundle --target x86_64-pc-windows-msvc --bundles nsis --config src-tauri/tauri.offline.conf.json
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
