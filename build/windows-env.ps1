$ErrorActionPreference = 'Stop'
$pictoraRoot = Split-Path -Parent $PSScriptRoot
$pictoraVswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$pictoraVsRoot = (& $pictoraVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
if (-not $pictoraVsRoot) { throw 'Microsoft C++ Build Tools are required. See research/m6/WINDOWS-ARCHITECTURE.md.' }
$pictoraVcRoot = (Get-ChildItem -LiteralPath (Join-Path $pictoraVsRoot 'VC\Tools\MSVC') -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1).FullName
$pictoraSdkRoot = $env:PICTORA_SDK_DIR
if (-not $pictoraSdkRoot) {
    $pictoraInstalledSdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
    $pictoraSdkRoot = if (Test-Path -LiteralPath (Join-Path $pictoraInstalledSdk 'Include')) { $pictoraInstalledSdk } else { Join-Path $pictoraRoot '.build-tools\windows-sdk' }
}
if (-not (Test-Path -LiteralPath (Join-Path $pictoraSdkRoot 'Include'))) { throw 'Windows SDK headers are required. Install the SDK or use the documented local official SDK acquisition scripts.' }
$pictoraSdkVersion = (Get-ChildItem -LiteralPath (Join-Path $pictoraSdkRoot 'Include') -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1).Name
$pictoraSdkInclude = Join-Path $pictoraSdkRoot "Include\$pictoraSdkVersion"
$pictoraSdkLibRoot = if (Test-Path -LiteralPath (Join-Path $pictoraSdkRoot "Lib\$pictoraSdkVersion\um\x64")) { Join-Path $pictoraSdkRoot "Lib\$pictoraSdkVersion" } else { $pictoraSdkRoot }
$pictoraVcBin = Join-Path $pictoraVcRoot 'bin\Hostx64\x64'
$pictoraSdkBin = Join-Path $pictoraSdkRoot "bin\$pictoraSdkVersion\x64"
$env:PATH = "$pictoraVcBin;$pictoraSdkBin;$env:PATH"
$env:INCLUDE = "$pictoraVcRoot\include;$pictoraSdkInclude\ucrt;$pictoraSdkInclude\shared;$pictoraSdkInclude\um;$pictoraSdkInclude\winrt;$pictoraSdkInclude\cppwinrt;$env:INCLUDE"
$env:LIB = "$pictoraVcRoot\lib\x64;$pictoraSdkLibRoot\um\x64;$pictoraSdkLibRoot\ucrt\x64;$env:LIB"
$env:WindowsSdkDir = "$pictoraSdkRoot\"
$env:WindowsSDKVersion = "$pictoraSdkVersion\"
$env:VCToolsInstallDir = "$pictoraVcRoot\"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = Join-Path $pictoraVcBin 'link.exe'
$env:RC = Join-Path $pictoraSdkBin 'rc.exe'
