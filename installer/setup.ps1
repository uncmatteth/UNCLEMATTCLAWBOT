Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [switch]$DryRun
)

Write-Host "Uncle Matt setup starting..."

$Root = Split-Path -Parent $PSScriptRoot
$OpenClawExtDir = $env:OPENCLAW_EXT_DIR
if (-not $OpenClawExtDir) { $OpenClawExtDir = Join-Path $HOME ".openclaw\\extensions" }

$CertDir = $env:UNCLEMATT_CERT_DIR
if (-not $CertDir) { $CertDir = Join-Path $HOME ".secure-openclaw\\certs" }

$BrokerUrl = $env:UNCLEMATT_BROKER_URL
if (-not $BrokerUrl) { $BrokerUrl = "https://127.0.0.1:8443" }

$BrokerTimeoutMs = $env:UNCLEMATT_BROKER_TIMEOUT_MS
if (-not $BrokerTimeoutMs) { $BrokerTimeoutMs = "15000" }

$VoicePackEnabled = $env:UNCLEMATT_VOICE_PACK_ENABLED
if (-not $VoicePackEnabled) { $VoicePackEnabled = "false" }

$SandboxMode = $env:UNCLEMATT_SANDBOX_MODE
if (-not $SandboxMode) { $SandboxMode = "all" }

$SkipValidation = $env:UNCLEMATT_SKIP_VALIDATION
if (-not $SkipValidation) { $SkipValidation = "0" }

function Run {
  param([string]$Command, [string[]]$Args = @())
  $full = $Args -join " "
  Write-Host "+ $Command $full"
  if (-not $DryRun) {
    & $Command @Args
  }
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Require-Command docker
Require-Command openssl
Require-Command openclaw
Require-Command curl.exe

$ComposeCmd = $null
try {
  docker compose version | Out-Null
  $ComposeCmd = "docker"
} catch {
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $ComposeCmd = "docker-compose"
  } else {
    throw "Docker Compose not found (docker compose or docker-compose)."
  }
}

Write-Host "OpenClaw extension dir: $OpenClawExtDir"
Write-Host "Cert dir: $CertDir"
Write-Host "Broker URL: $BrokerUrl"

docker info | Out-Null

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

$CaCrt = Join-Path $CertDir "ca.crt"
$ClientCrt = Join-Path $CertDir "client.crt"
$ClientKey = Join-Path $CertDir "client.key"
$ServerCrt = Join-Path $CertDir "server.crt"
$ServerKey = Join-Path $CertDir "server.key"

if (-not (Test-Path $CaCrt) -or -not (Test-Path $ClientCrt) -or -not (Test-Path $ClientKey)) {
  $CaKey = Join-Path $CertDir "ca.key"
  $ServerCsr = Join-Path $CertDir "server.csr"
  $ClientCsr = Join-Path $CertDir "client.csr"
  $ExtFile = Join-Path $CertDir "server.ext"

  Run "openssl" @("genrsa", "-out", $CaKey, "4096")
  Run "openssl" @("req", "-x509", "-new", "-nodes", "-key", $CaKey, "-sha256", "-days", "3650", "-subj", "/CN=uncle-matt-ca", "-out", $CaCrt)

  Run "openssl" @("genrsa", "-out", $ServerKey, "2048")
  Run "openssl" @("req", "-new", "-key", $ServerKey, "-subj", "/CN=uncle-matt-broker", "-out", $ServerCsr)
  "subjectAltName=DNS:localhost,IP:127.0.0.1" | Set-Content -Path $ExtFile -Encoding ascii
  Run "openssl" @("x509", "-req", "-in", $ServerCsr, "-CA", $CaCrt, "-CAkey", $CaKey, "-CAcreateserial", "-out", $ServerCrt, "-days", "825", "-sha256", "-extfile", $ExtFile)

  Run "openssl" @("genrsa", "-out", $ClientKey, "2048")
  Run "openssl" @("req", "-new", "-key", $ClientKey, "-subj", "/CN=openclaw-client", "-out", $ClientCsr)
  Run "openssl" @("x509", "-req", "-in", $ClientCsr, "-CA", $CaCrt, "-CAkey", $CaKey, "-CAcreateserial", "-out", $ClientCrt, "-days", "825", "-sha256")

  Remove-Item -Force $ServerCsr, $ClientCsr, $ExtFile -ErrorAction SilentlyContinue
}

$BrokerCertDir = Join-Path $Root "broker\\certs"
New-Item -ItemType Directory -Force -Path $BrokerCertDir | Out-Null
Run "Copy-Item" @($CaCrt, (Join-Path $BrokerCertDir "ca.crt"), "-Force")
Run "Copy-Item" @($ServerCrt, (Join-Path $BrokerCertDir "server.crt"), "-Force")
Run "Copy-Item" @($ServerKey, (Join-Path $BrokerCertDir "server.key"), "-Force")

$PlugSrc = Join-Path $Root "openclaw\\extensions\\uncle-matt"
$PlugDest = Join-Path $OpenClawExtDir "uncle-matt"
New-Item -ItemType Directory -Force -Path $OpenClawExtDir | Out-Null
if (Test-Path $PlugDest) { Remove-Item -Recurse -Force $PlugDest }
Run "Copy-Item" @($PlugSrc, $PlugDest, "-Recurse", "-Force")

Write-Host "Configuring OpenClaw..."
Run "openclaw" @("config", "set", "plugins.enabled", "true")
Run "openclaw" @("config", "set", "plugins.allow", "[`"uncle-matt`"]", "--json")
Run "openclaw" @("config", "set", "plugins.load.paths", "[`"$PlugDest`"]", "--json")
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".enabled", "true")
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".config.baseUrl", $BrokerUrl)
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".config.caPath", $CaCrt)
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".config.clientCertPath", $ClientCrt)
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".config.clientKeyPath", $ClientKey)
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".config.timeoutMs", $BrokerTimeoutMs)
Run "openclaw" @("config", "set", "plugins.entries.`"uncle-matt`".config.voicePackEnabled", $VoicePackEnabled)

Run "openclaw" @("config", "set", "agents.defaults.sandbox.mode", $SandboxMode)
Run "openclaw" @("config", "set", "agents.defaults.sandbox.workspaceAccess", "none")
Run "openclaw" @("config", "set", "agents.defaults.sandbox.docker.network", "none")
Run "openclaw" @("config", "set", "agents.defaults.sandbox.docker.readOnlyRoot", "true")

Run "openclaw" @("config", "set", "tools.profile", "minimal")
Run "openclaw" @("config", "set", "tools.allow", "[`"uncle_matt_action`"]", "--json")
Run "openclaw" @("config", "set", "tools.deny", "[`"group:runtime`",`"group:fs`",`"group:ui`",`"group:browser`"]", "--json")

$ActionFile = Join-Path $Root "broker\\config\\actions.default.json"
if (-not (Test-Path $ActionFile)) {
  $Template = Join-Path $Root "installer\\templates\\broker.actions.example.json"
  Write-Host "Actions file missing; copying template to $ActionFile"
  Run "Copy-Item" @($Template, $ActionFile, "-Force")
}

$SecretRefs = @()
try {
  $actions = Get-Content -Raw $ActionFile | ConvertFrom-Json
  foreach ($policy in $actions.actions.PSObject.Properties.Value) {
    $auth = $policy.auth
    if ($null -ne $auth -and $auth.kind -ne "none" -and $auth.secretRef) {
      $SecretRefs += $auth.secretRef
    }
  }
} catch {
  Write-Warning "Failed to parse actions file; skipping secretRef extraction."
}

if ($SecretRefs.Count -gt 0) {
  $Allowed = @("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "BRAVE_API_KEY")
  foreach ($ref in $SecretRefs) {
    if (-not ($Allowed -contains $ref)) {
      throw "Secret '$ref' not declared in docker-compose.yml. Add it to compose or mount a secrets dir."
    }
  }

  $swarmState = docker info --format '{{.Swarm.LocalNodeState}}'
  if ($swarmState -ne "active") {
    throw "Docker Swarm is not active; Docker secrets unavailable. Enable Swarm or use local secrets dir."
  }

  $existing = docker secret ls --format '{{.Name}}'
  foreach ($ref in $SecretRefs) {
    if ($existing -contains $ref) {
      Write-Host "Docker secret exists: $ref"
      continue
    }
    if ($env:UNCLEMATT_SECRETS_FROM_ENV -eq "1") {
      $val = [Environment]::GetEnvironmentVariable($ref)
      if (-not $val) { throw "Missing env var for secret $ref (expected `$env:$ref)" }
      $val | docker secret create $ref - | Out-Null
    } else {
      $secure = Read-Host "Enter value for secret $ref" -AsSecureString
      $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        if (-not $plain) { throw "Empty secret value for $ref; aborting." }
        $plain | docker secret create $ref - | Out-Null
      } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      }
    }
  }
}

Write-Host "Starting broker via Docker Compose..."
if ($ComposeCmd -eq "docker") {
  Run "docker" @("compose", "-f", (Join-Path $Root "docker-compose.yml"), "up", "-d", "--build")
} else {
  Run "docker-compose" @("-f", (Join-Path $Root "docker-compose.yml"), "up", "-d", "--build")
}

Write-Host "Generating ACTIONS.generated.md..."
$ActionsOut = Join-Path $Root "openclaw\\skills\\uncle-matt\\ACTIONS.generated.md"
if (-not $DryRun) {
  $json = & curl.exe --silent --show-error --fail --cacert $CaCrt --cert $ClientCrt --key $ClientKey "$BrokerUrl/v1/actions"
  $lines = @(
    "# Actions (Generated)",
    "",
    "Generated: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')",
    "",
    "```json"
  )
  $lines += ($json | ConvertFrom-Json | ConvertTo-Json -Depth 20)
  $lines += "```"
  $lines | Set-Content -Path $ActionsOut -Encoding ascii
  Write-Host "Wrote $ActionsOut"
}

if ($SkipValidation -ne "1") {
  Write-Host "Running validation checks..."
  if (& openclaw security audit --deep) {
    Write-Host "OpenClaw security audit passed."
  } elseif ($env:OPENCLAW_AUDIT_FIX -eq "1") {
    & openclaw security audit --fix
    & openclaw security audit --deep
  } else {
    throw "OpenClaw security audit failed. Set OPENCLAW_AUDIT_FIX=1 to auto-fix."
  }
} else {
  Write-Host "Validation skipped (UNCLEMATT_SKIP_VALIDATION=1)."
}

Write-Host "Setup complete."
