# Deploy remoto: atualiza o repositório no VPS e executa deploy/deploy.sh (releases + Docker Compose + healthcheck).
#
# Lê credenciais e caminhos do arquivo .env na raiz do repositório (mesma pasta deste script), se existir:
#   WMS_SSH_HOST  — host ou usuario@host (compatível: WMS_SSH)
#   WMS_SSH_USER  — usuário usado se WMS_SSH_HOST não tiver "@" (padrão: root; compat: WMS_SSH_ROOT_USERNAME)
#   WMS_SSH_PASSWORD — opcional; com PuTTY plink.exe no PATH, login automático no Windows (compat: WMS_SSH_ROOT_PASSWORD)
#   WMS_REMOTE_REPO_PATH, WMS_BASE_DIR, WMS_GIT_BRANCH — opcionais
#
# Precedência: parâmetros explícitos > variáveis de ambiente > chaves no .env > padrões.
#
# Pré-requisitos no servidor:
#   - Git clone em RemoteRepoPath
#   - shared/.env sob BaseDir (ver deploy/README.md)
#   - Docker com plugin compose v2 (`docker compose`)
#
# Uso:
#   .\deploy-remote.ps1
#
#   .\deploy-remote.ps1 -SshTarget "deploy@203.0.113.10" -Branch master
#
param(
    [string] $SshTarget,
    [string] $RemoteRepoPath,
    [string] $BaseDir,
    [string] $Branch,
    [switch] $SkipGit,
    [switch] $DryRun,
    [switch] $ForceSsh
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$EnvFilePath = Join-Path $RepoRoot ".env"

function Import-WmsDotEnv {
    param([string] $Path)
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $map }
    Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^\s*#' -or $line -eq "") { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { return }
        $val = $line.Substring($eq + 1).Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $map[$key] = $val
    }
    return $map
}

$DotEnv = Import-WmsDotEnv -Path $EnvFilePath

function Get-WmsConfigValue {
    param(
        [string] $ParamValue,
        [string] $EnvName,
        [string] $DotEnvKey,
        [string] $Default
    )
    if (-not [string]::IsNullOrWhiteSpace($ParamValue)) { return $ParamValue.Trim() }
    $fromEnv = [Environment]::GetEnvironmentVariable($EnvName, "Process")
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) { return $fromEnv.Trim() }
    if ($DotEnv.ContainsKey($DotEnvKey) -and -not [string]::IsNullOrWhiteSpace($DotEnv[$DotEnvKey])) {
        return $DotEnv[$DotEnvKey].Trim()
    }
    return $Default
}

$RemoteRepoPath = Get-WmsConfigValue -ParamValue $(if ($PSBoundParameters.ContainsKey('RemoteRepoPath') -and -not [string]::IsNullOrWhiteSpace($RemoteRepoPath)) { $RemoteRepoPath } else { $null }) `
    -EnvName "WMS_REMOTE_REPO_PATH" -DotEnvKey "WMS_REMOTE_REPO_PATH" -Default "/opt/wms/repo"
$BaseDir = Get-WmsConfigValue -ParamValue $(if ($PSBoundParameters.ContainsKey('BaseDir') -and -not [string]::IsNullOrWhiteSpace($BaseDir)) { $BaseDir } else { $null }) `
    -EnvName "WMS_BASE_DIR" -DotEnvKey "WMS_BASE_DIR" -Default "/opt/wms"
$Branch = Get-WmsConfigValue -ParamValue $(if ($PSBoundParameters.ContainsKey('Branch') -and -not [string]::IsNullOrWhiteSpace($Branch)) { $Branch } else { $null }) `
    -EnvName "WMS_GIT_BRANCH" -DotEnvKey "WMS_GIT_BRANCH" -Default "master"

function Get-WmsFirstValue {
    param([string[]] $EnvNames, [string[]] $DotEnvKeys)
    foreach ($n in $EnvNames) {
        $v = [Environment]::GetEnvironmentVariable($n, "Process")
        if (-not [string]::IsNullOrWhiteSpace($v)) { return $v.Trim() }
    }
    foreach ($k in $DotEnvKeys) {
        if ($DotEnv.ContainsKey($k) -and -not [string]::IsNullOrWhiteSpace($DotEnv[$k])) {
            return $DotEnv[$k].Trim()
        }
    }
    return $null
}

if ($PSBoundParameters.ContainsKey('SshTarget') -and -not [string]::IsNullOrWhiteSpace($SshTarget)) {
    $resolvedSsh = $SshTarget.Trim()
}
else {
    $resolvedSsh = Get-WmsFirstValue -EnvNames @("WMS_SSH_HOST", "WMS_SSH") -DotEnvKeys @("WMS_SSH_HOST", "WMS_SSH")
}

if ([string]::IsNullOrWhiteSpace($resolvedSsh)) {
    Write-Host "Defina WMS_SSH_HOST no .env (raiz do repo), ou -SshTarget 'usuario@host', ou `$env:WMS_SSH_HOST." -ForegroundColor Red
    if (Test-Path -LiteralPath $EnvFilePath) {
        Write-Host "Arquivo encontrado: $EnvFilePath" -ForegroundColor Gray
    }
    else {
        Write-Host "Arquivo .env não encontrado em: $EnvFilePath" -ForegroundColor Gray
    }
    exit 1
}

if ($resolvedSsh -notmatch '@') {
    $sshUser = Get-WmsFirstValue -EnvNames @("WMS_SSH_USER", "WMS_SSH_ROOT_USERNAME") -DotEnvKeys @("WMS_SSH_USER", "WMS_SSH_ROOT_USERNAME")
    if ([string]::IsNullOrWhiteSpace($sshUser)) { $sshUser = "root" }
    $resolvedSsh = "$sshUser@$resolvedSsh"
}

$SshTarget = $resolvedSsh
$SshPassword = Get-WmsFirstValue -EnvNames @("WMS_SSH_PASSWORD", "WMS_SSH_ROOT_PASSWORD") -DotEnvKeys @("WMS_SSH_PASSWORD", "WMS_SSH_ROOT_PASSWORD")
$SshHostKey = Get-WmsFirstValue -EnvNames @("WMS_SSH_HOSTKEY") -DotEnvKeys @("WMS_SSH_HOSTKEY")

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

# Normaliza quebras de linha para LF — bash em Linux falha com CRLF
# (ex.: "set -euo pipefail`r" vira `pipefail\r` e quebra parsing).
$remote = $remote -replace "`r`n", "`n"
$remote = $remote -replace "`r", "`n"

Write-Host "Deploy remoto → $($SshTarget -replace '^[^@]+@', '***@')" -ForegroundColor Cyan
Write-Host "  Repo:    $RemoteRepoPath" -ForegroundColor Gray
Write-Host "  BaseDir: $BaseDir" -ForegroundColor Gray
Write-Host "  Branch:  $Branch" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "--- Comando que seria executado no servidor ---" -ForegroundColor Yellow
    Write-Host $remote
    exit 0
}

$plExecutable = $null
if (-not $ForceSsh -and $null -ne $SshPassword) {
    $plExecutable = Get-Command plink.exe -ErrorAction SilentlyContinue
    if (-not $plExecutable) { $plExecutable = Get-Command plink -ErrorAction SilentlyContinue }
}

# Materializa o script em arquivo temporário com LF puro para evitar
# qualquer conversão CRLF do pipeline do PowerShell ao redirecionar via stdin.
$tmpScript = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "wms-deploy-$([System.Guid]::NewGuid().ToString('N')).sh")
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmpScript, $remote, $utf8NoBom)

try {
    if ($plExecutable) {
        Write-Host "Conexão SSH via plink (host: $($SshTarget -replace '^[^@]+@', '***@'))" -ForegroundColor DarkGray
        $plinkArgs = @("-batch", "-ssh", $SshTarget, "-pw", $SshPassword)
        if (-not [string]::IsNullOrWhiteSpace($SshHostKey)) {
            $plinkArgs += @("-hostkey", $SshHostKey)
        }
        $plinkArgs += @("bash", "-s")
        & cmd.exe /c "type `"$tmpScript`" | `"$($plExecutable.Source)`" $($plinkArgs -join ' ')"
        if ($LASTEXITCODE -ne 0 -and [string]::IsNullOrWhiteSpace($SshHostKey)) {
            Write-Host "Falha SSH. Se for primeira conexão, defina WMS_SSH_HOSTKEY (fingerprint) no .env e tente novamente." -ForegroundColor Yellow
            Write-Host "Para obter a fingerprint, conecte-se uma vez interativamente: plink -ssh $SshTarget" -ForegroundColor Yellow
        }
    }
    else {
        if (-not $ForceSsh -and $null -ne $SshPassword) {
            Write-Host "Instale PuTTY (plink.exe no PATH) para usar WMS_SSH_PASSWORD automaticamente; usando OpenSSH." -ForegroundColor Yellow
        }
        & cmd.exe /c "type `"$tmpScript`" | ssh $SshTarget bash"
    }
}
finally {
    Remove-Item -LiteralPath $tmpScript -ErrorAction SilentlyContinue
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Deploy falhou (código $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy concluído no servidor." -ForegroundColor Green
