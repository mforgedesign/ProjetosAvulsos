param(
  [Parameter(Mandatory=$true)][string]$VpsHost,
  [string]$VpsUser = "jarvis",
  [string]$IdentityFile = "$env:USERPROFILE\.ssh\jarvis_sync_ed25519",
  [string]$WslDistribution = "",
  [string]$RemoteDirectory = "/opt/mforge-insights/inbox/conversas"
)

$ErrorActionPreference = "Stop"
$sourceWindows = "C:\Users\Acer\Documents\Log Whatsapp\conversas"
if (-not (Test-Path -LiteralPath $sourceWindows)) {
  throw "Pasta de conversas não encontrada: $sourceWindows"
}
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL não está instalado. Instale WSL e rsync antes de agendar este script."
}

$sourceWsl = (wsl.exe wslpath -a $sourceWindows).Trim()
$keyWsl = (wsl.exe wslpath -a $IdentityFile).Trim()
$distributionArgs = @()
if ($WslDistribution) { $distributionArgs = @("-d", $WslDistribution) }
$rsync = "rsync -az --delete-delay --partial --delay-updates -e 'ssh -i ""$keyWsl"" -o BatchMode=yes -o StrictHostKeyChecking=accept-new' ""$sourceWsl/"" ""$VpsUser@$VpsHost`:$RemoteDirectory/"""

& wsl.exe @distributionArgs bash -lc $rsync
if ($LASTEXITCODE -ne 0) { throw "rsync falhou com código $LASTEXITCODE" }
