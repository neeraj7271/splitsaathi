# Loads apps/api/.env, ensures splitsaathi DB exists, runs migrations.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root "apps\api\.env"

if (-not (Test-Path $EnvFile)) {
  throw "Missing $EnvFile"
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^([^#\s][^=]*)=(.*)$') {
    $key = $matches[1].Trim()
    $val = $matches[2].Trim()
    Set-Item -Path "Env:$key" -Value $val
  }
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is not set in apps/api/.env"
}

$PgBin = "F:\postgres\bin"
if (-not (Test-Path "$PgBin\psql.exe")) {
  throw "psql not found at $PgBin\psql.exe. Update PgBin in scripts/setup-local-db.ps1 if Postgres is elsewhere."
}

if ($env:DATABASE_URL -notmatch '^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/(.+)$') {
  throw "DATABASE_URL format not recognized."
}

$pgUser = $matches[1]
$pgPass = [uri]::UnescapeDataString($matches[2])
$pgHost = $matches[3]
$pgPort = $matches[4]
$pgDb = $matches[5]

$env:PGPASSWORD = $pgPass

Write-Host "Checking database '$pgDb' on ${pgHost}:${pgPort}..." -ForegroundColor Cyan
$exists = & "$PgBin\psql.exe" -U $pgUser -h $pgHost -p $pgPort -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$pgDb';" 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Could not connect to Postgres: $exists"
}

if ($exists.Trim() -ne "1") {
  Write-Host "Creating database '$pgDb'..." -ForegroundColor Yellow
  & "$PgBin\psql.exe" -U $pgUser -h $pgHost -p $pgPort -d postgres -c "CREATE DATABASE $pgDb;"
  if ($LASTEXITCODE -ne 0) { throw "CREATE DATABASE failed." }
  Write-Host "Database created." -ForegroundColor Green
} else {
  Write-Host "Database '$pgDb' already exists." -ForegroundColor Green
}

Write-Host "Running migrations..." -ForegroundColor Yellow
Set-Location $Root
npm run migration:run
if ($LASTEXITCODE -ne 0) { throw "Migration failed." }

Write-Host "Local database ready." -ForegroundColor Green
