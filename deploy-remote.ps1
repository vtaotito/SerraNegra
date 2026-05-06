# Deploy remoto: atualiza o repositório no VPS e executa deploy/deploy.sh (releases + Docker Compose + healthcheck).
#
# Pré-requisitos no servidor:
#   - Git clone em $RemoteRepoPath (este repositório)
#   - /opt/wms/shared/.env (copiar de deploy/.env.example) — ou ajuste $BaseDir/$EnvRelative
#   - Docker com plugin compose v2 (`docker compose`)
#
# Uso:
#   $env:WMS_SSH = "deploy@203.0.113.10"
#   .\deploy-remote.ps1
#
#   .\deploy-remote.ps1 -SshTarget "deploy@203.0.113.10" -Branch master -RemoteRepoPath "/opt/wms/repo"
#
param(
    [string] $SshTarget = $env:WMS_SSH,
    [string] $RemoteRepoPath = $(if ($env:WMS_REMOTE_REPO_PATH) { $env:WMS_REMOTE_REPO_PATH } else { "/opt/wms/repo" }),
    [string] $BaseDir = $(if ($env:WMS_BASE_DIR) { $env:WMS_BASE_DIR } else { "/opt/wms" }),
    [string] $Branch = $(if ($env:WMS_GIT_BRANCH) { $env:WMS_GIT_BRANCH } else { "master" }),
    [switch] $SkipGit,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SshTarget)) {
    Write-Host "Defina o alvo SSH: -SshTarget 'usuario@host' ou variável de ambiente WMS_SSH." -ForegroundColor Red
    exit 1
}

$skipGitFlag = if ($SkipGit) { "1" } else { "0" }

function Escape-BashSingleQuoted([string]$Value) {
    if ($null -eq $Value) { return "" }
    return $Value -replace "'", "'\''"
}

# Script bash no servidor; placeholders evitam expansão incorreta pelo PowerShell.
$remote = @'
set -euo pipefail
REMOTE_REPO_PATH='__RP__'
BRANCH='__BR__'
BASE_DIR='__BD__'
SKIP_GIT='__SK__'
cd "$REMOTE_REPO_PATH"
if [ ! -f deploy/deploy.sh ]; then
  echo "deploy/deploy.sh não encontrado em $REMOTE_REPO_PATH" >&2
  exit 1
fi
if [ "$SKIP_GIT" != "1" ]; then
  git fetch origin
  git checkout "$BRANCH"
  if git pull --ff-only origin "$BRANCH"; then
    :
  else
    git reset --hard "origin/$BRANCH"
  fi
fi
export BASE_DIR="$BASE_DIR"
export ENV_FILE="${ENV_FILE:-$BASE_DIR/shared/.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente não encontrado: $ENV_FILE" >&2
  echo "Crie a partir de deploy/.env.example (ver deploy/README.md)." >&2
  exit 1
fi
exec bash ./deploy/deploy.sh
'@

$remote = $remote `
    -replace '__RP__', (Escape-BashSingleQuoted $RemoteRepoPath) `
    -replace '__BR__', (Escape-BashSingleQuoted $Branch) `
    -replace '__BD__', (Escape-BashSingleQuoted $BaseDir) `
    -replace '__SK__', (Escape-BashSingleQuoted $skipGitFlag)

Write-Host "Deploy remoto → $SshTarget" -ForegroundColor Cyan
Write-Host "  Repo:    $RemoteRepoPath" -ForegroundColor Gray
Write-Host "  BaseDir: $BaseDir" -ForegroundColor Gray
Write-Host "  Branch:  $Branch" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "--- Comando que seria executado no servidor ---" -ForegroundColor Yellow
    Write-Host $remote
    exit 0
}

$remote | ssh $SshTarget bash

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Deploy falhou (código $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy concluído no servidor." -ForegroundColor Green
