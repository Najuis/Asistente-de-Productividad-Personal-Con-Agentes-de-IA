# Carga la clave de Gemini desde el portapapeles en .env (sin necesidad de pegarla en un chat).
# Uso:
#   1. Copia la clave (AIza...) en el navegador de Google AI Studio.
#   2. Ejecuta:  powershell -ExecutionPolicy Bypass -File .\scripts\cargar-gemini.ps1

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".."
$envPath = Join-Path $root ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "No existe .env. Ejecuta primero .\scripts\configurar-tokens.ps1" -ForegroundColor Red
    exit 1
}

$key = (Get-Clipboard -Raw).Trim()
if ([string]::IsNullOrEmpty($key)) {
    Write-Host "El portapapeles esta vacio. Copia la clave primero (Ctrl+C en el navegador)." -ForegroundColor Red
    exit 1
}
if ($key -notmatch "^(AIza|AQ\.[0-9A-Za-z_.-]+)[0-9A-Za-z_.-]{20,}$") {
    Write-Host "El portapapeles no contiene una clave de Gemini valida (debe empezar con AIza o AQ. y tener mas de 20 caracteres)." -ForegroundColor Red
    Write-Host ("Contenido del portapapeles: '" + $key.Substring(0, [Math]::Min(20, $key.Length)) + "...'") -ForegroundColor Yellow
    exit 1
}

$script:content = Get-Content $envPath -Raw

function Set-EnvLine([string]$name, [string]$value) {
    $pattern = "(?m)^$name=.*$"
    if ($script:content -match $pattern) {
        $script:content = [regex]::Replace($script:content, $pattern, "$name=$value")
    } else {
        $script:content = $script:content.TrimEnd() + "`n$name=$value`n"
    }
}

Set-EnvLine "LLM_PROVIDER" "gemini"
Set-EnvLine "OPENAI_API_KEY" $key
Set-EnvLine "GEMINI_MODEL" "gemini-3.6-flash"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $script:content, $utf8NoBom)

Write-Host ""
Write-Host ("Gemini cargada: " + $key.Substring(0, 7) + "... (de " + $key.Length + " caracteres)") -ForegroundColor Green
Write-Host "LLM_PROVIDER=gemini, modelo gemini-3.6-flash" -ForegroundColor Green
Write-Host "Listo. Ahora reinicia los procesos con pm2."
