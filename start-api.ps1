# Load .env file into current process environment
$envFile = Join-Path $PSScriptRoot "apps\api\.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#\s][^=]*)=(.*)$') {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
        Set-Item -Path "Env:$key" -Value $val
    }
}

Write-Host "✅ Environment loaded from .env" -ForegroundColor Green
Write-Host "   DATABASE_URL = $env:DATABASE_URL" -ForegroundColor Cyan
Write-Host "   PORT = $env:PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Starting SplitSaathi API..." -ForegroundColor Yellow

Set-Location $PSScriptRoot
npm run start:dev -w @splitsaathi/api
