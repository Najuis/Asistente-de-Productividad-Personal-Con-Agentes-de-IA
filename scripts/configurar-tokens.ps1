# Configurador interactivo de claves para el Asistente de Productividad.
# Ejecutar en PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configurar-tokens.ps1

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".."
$envPath = Join-Path $root ".env"

if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $root ".env.example") $envPath
    Write-Host "Se creo .env desde .env.example" -ForegroundColor Yellow
}

$script:content = Get-Content $envPath -Raw

function Set-EnvLine([string]$name, [string]$value) {
    if ([string]::IsNullOrEmpty($value)) { return }
    $pattern = "(?m)^$name=.*$"
    if ($script:content -match $pattern) {
        $script:content = [regex]::Replace($script:content, $pattern, "$name=$value")
    } else {
        $script:content = $script:content.TrimEnd() + "`n$name=$value`n"
    }
}

function Mask([string]$value) {
    if ($value.Length -le 8) { return $value.Substring(0, [Math]::Min(2, $value.Length)) + "***" }
    return $value.Substring(0, 4) + "..." + $value.Substring($value.Length - 4)
}

Write-Host ""
Write-Host "=== Configuracion de claves ==="
Write-Host "Elige el proveedor de IA:"
Write-Host "  1) Gemini (Google) - gratis, responde en segundos (recomendado)"
Write-Host "  2) DeepSeek - requiere saldo en la cuenta"
Write-Host "  3) Ollama local - sin claves, usa tu CPU"
$provider = (Read-Host "Opcion (1/2/3)").Trim()
if ($provider -notmatch "^[123]$") { $provider = "1" }

Write-Host ""
Write-Host "(Pega cada valor y presiona Enter; Enter vacio para omitir)"
Write-Host ""

$deepseek = ""
$gemini = ""
if ($provider -eq "1") {
    $gemini = (Read-Host "Clave de Gemini (empieza con AIza...)").Trim()
} elseif ($provider -eq "2") {
    $deepseek = (Read-Host "Clave de DeepSeek (empieza con sk-)").Trim()
}
$telegram = (Read-Host "Token del bot de Telegram (formato 123456:AA...)").Trim()
$chatId = (Read-Host "Tu chat id numerico de Telegram (con @userinfobot)").Trim()

if ($gemini -ne "" -and $gemini -notmatch "^AIza[0-9A-Za-z_-]{20,}$") {
    Write-Host "La clave de Gemini no parece valida (debe empezar con AIza- y tener mas de 20 caracteres)" -ForegroundColor Red
    $gemini = ""
}
if ($deepseek -ne "" -and $deepseek -notmatch "^sk-.{20,}$") {
    Write-Host "La clave de DeepSeek no parece valida (debe empezar con sk- y tener mas de 20 caracteres)" -ForegroundColor Red
    $deepseek = ""
}
if ($telegram -ne "" -and $telegram -notmatch "^\d+:[A-Za-z0-9_-]{30,}$") {
    Write-Host "El token de Telegram no parece valido (formato 123456789:AA...)" -ForegroundColor Red
    $telegram = ""
}
if ($chatId -ne "" -and $chatId -notmatch "^\d+$") {
    Write-Host "El chat id debe ser numerico (ej: 123456789). Escribele a @userinfobot para obtenerlo." -ForegroundColor Red
    $chatId = ""
}

if ($provider -eq "1" -and -not [string]::IsNullOrEmpty($gemini)) {
    Set-EnvLine "LLM_PROVIDER" "openai"
    Set-EnvLine "OPENAI_API_KEY" $gemini
    Set-EnvLine "OPENAI_MODEL" "gemini-2.5-flash"
    Set-EnvLine "OPENAI_BASE_URL" "https://generativelanguage.googleapis.com/v1beta/openai"
} elseif ($provider -eq "2" -and -not [string]::IsNullOrEmpty($deepseek)) {
    Set-EnvLine "LLM_PROVIDER" "openai"
    Set-EnvLine "OPENAI_API_KEY" $deepseek
    Set-EnvLine "OPENAI_MODEL" "deepseek-chat"
    Set-EnvLine "OPENAI_BASE_URL" "https://api.deepseek.com"
} elseif ($provider -eq "3") {
    Set-EnvLine "LLM_PROVIDER" "ollama"
}
Set-EnvLine "TELEGRAM_BOT_TOKEN" $telegram
Set-EnvLine "TG_ALLOWED_CHAT" $chatId

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $script:content, $utf8NoBom)

Write-Host ""
Write-Host "=== Resumen (enmascarado) ==="
if (-not [string]::IsNullOrEmpty($gemini)) {
    Write-Host ("Gemini: " + (Mask $gemini) + "  -> LLM_PROVIDER=openai, modelo gemini-2.5-flash") -ForegroundColor Green
} elseif ($provider -eq "1") {
    Write-Host "Gemini: no configurada (se mantiene la actual)" -ForegroundColor Yellow
}
if (-not [string]::IsNullOrEmpty($deepseek)) {
    Write-Host ("DeepSeek: " + (Mask $deepseek) + "  -> LLM_PROVIDER=openai, modelo deepseek-chat") -ForegroundColor Green
} elseif ($provider -eq "2") {
    Write-Host "DeepSeek: no configurada (se mantiene la actual)" -ForegroundColor Yellow
}
if ($provider -eq "3") {
    Write-Host "Ollama local: LLM_PROVIDER=ollama" -ForegroundColor Green
}
if (-not [string]::IsNullOrEmpty($telegram)) {
    Write-Host ("Telegram bot token: " + (Mask $telegram)) -ForegroundColor Green
} else {
    Write-Host "Telegram: no configurado (se mantiene la actual)" -ForegroundColor Yellow
}
if (-not [string]::IsNullOrEmpty($chatId)) {
    Write-Host ("Chat id permitido: " + $chatId) -ForegroundColor Green
} else {
    Write-Host "Chat id: no configurado" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Listo. Las claves quedaron en .env (no se suben a git)."
