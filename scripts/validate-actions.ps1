Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$Actions,
  [string]$Schema,
  [switch]$Build
)

$Root = Split-Path -Parent $PSScriptRoot
if (-not $Actions) { $Actions = Join-Path $Root "broker\\config\\actions.default.json" }
if (-not $Schema) { $Schema = Join-Path $Root "broker\\config\\actions.schema.json" }

if (-not (Test-Path $Actions)) { throw "Actions file not found: $Actions" }
if (-not (Test-Path $Schema)) { throw "Schema file not found: $Schema" }

$Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
$Image = "uncle-matt-broker:$Version"

function Image-Exists {
  try {
    docker image inspect $Image | Out-Null
    return $true
  } catch {
    return $false
  }
}

if ($Build -or -not (Image-Exists)) {
  Write-Host "Building broker image for validation..."
  docker build -t $Image (Join-Path $Root "broker")
}

$actionsPath = (Resolve-Path $Actions).Path
$schemaPath = (Resolve-Path $Schema).Path

$code = "const fs=require('fs');const Ajv=require('ajv/dist/2020');const actions=JSON.parse(fs.readFileSync('/tmp/actions.json','utf8'));const schema=JSON.parse(fs.readFileSync('/tmp/actions.schema.json','utf8'));const ajv=new Ajv({allErrors:true, strict:true});const validate=ajv.compile(schema);if(!validate(actions)){console.error('Invalid actions config:');for(const e of (validate.errors||[])){const p=String(e.instancePath||'');const m=String(e.message||'');console.error(p+' '+m);}process.exit(1);}console.log('Actions config OK');"

docker run --rm `
  -v "$actionsPath:/tmp/actions.json:ro" `
  -v "$schemaPath:/tmp/actions.schema.json:ro" `
  $Image `
  node -e $code
