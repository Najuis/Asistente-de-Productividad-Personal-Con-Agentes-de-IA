# Configurador interactivo de claves para el Asistente de Productividad.
# Te pide las claves por consola (entrada oculta) y las guarda en .env.
#
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
        $script:content = $script:content.TrimEnd() + "`r`n$name=$value`r`n"
    }
}

function Read-Secret([string]$label) {
    $secure = Read-Host -Prompt $label -AsSecureString
    if ($null -eq $secure -or $secure.Length -eq 0) { return "" }
    return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

function Mask([string]$value) {
    if ($value.Length -le 8) { return $value.Substring(0, [Math]::Min(2, $value.Length)) + "***" }
    return $value.Substring(0, 4) + "..." + $value.Substring($value.Length - 4)
}

Write-Host ""
Write-Host "=== Configuracion de claves (no se muestran en pantalla) ==="
Write-Host ""

$deepseek = Read-Secret "Clave de DeepSeek (sk-...) [Enter para omitir]"
$telegram = Read-Secret "Token del bot de Telegram [Enter para omitir]"
$chatId = Read-Host "Chat id autorizado para el bot [Enter para omitir]"

$deepseek = $deepseek.Trim()
$telegram = $telegram.Trim()
$chatId = $chatId.Trim()

if (-not [string]::IsNullOrEmpty($deepseek)) {
    Set-EnvLine "LLM_PROVIDER" "openai"
    Set-EnvLine "OPENAI_API_KEY" $deepseek
    Set-EnvLine "OPENAI_MODEL" "deepseek-chat"
    Set-EnvLine "OPENAI_BASE_URL" "https://api.deepseek.com"
}
Set-EnvLine "TELEGRAM_BOT_TOKEN" $telegram
Set-EnvLine "TG_ALLOWED_CHAT" $chatId

Set-Content -LiteralPath $envPath -Value $script:content -NoNewline

Write-Host ""
Write-Host "=== Resumen (enmascarado) ==="
if (-not [string]::IsNullOrEmpty($deepseek)) {
    Write-Host ("DeepSeek: " + (Mask $deepseek) + "  -> LLM_PROVIDER=openai, modelo deepseek-chat") -ForegroundColor Green
} else {
    Write-Host "DeepSeek: no configurada (se mantiene la actual)" -ForegroundColor Yellow
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
