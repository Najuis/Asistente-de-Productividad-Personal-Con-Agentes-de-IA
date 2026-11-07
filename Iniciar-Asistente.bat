@echo off
title Asistente - MODO DIAGNOSTICO
color 0B

echo ============================================================
echo   MODO SEGURO - DETECCION DE ERRORES
echo   (Presiona una tecla despues de cada paso)
echo ============================================================
echo.

:: 1. Ubicación
cd /d "%~dp0"
echo [PASO 1/6] Carpeta actual: %CD%
pause

:: 2. Limpieza
echo [PASO 2/6] Cerrando procesos antiguos...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% neq 0 (echo   -> No habia procesos para cerrar)
pause

:: 3. Espera (Usamos ping en lugar de timeout para evitar errores)
echo [PASO 3/6] Esperando 3 segundos...
ping 127.0.0.1 -n 4 >nul
pause

:: 4. Verificar Node
echo [PASO 4/6] Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node no encontrado.
    pause
    exit /b
)
pause

:: 5. Compilar
echo [PASO 5/6] Compilando codigo (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: La compilacion fallo. Revisa los mensajes rojos de arriba.
    pause
    exit /b
)
echo -> Compilacion OK.
pause

:: 6. Iniciar
echo [PASO 6/6] INICIANDO SERVIDOR WEB Y BOT...
echo (Si todo sale bien, veras textos AZUL y MAGENTA)
echo (Para detener, presiona Ctrl + C)
echo.
pause

call npm run dev:all

echo.
echo ============================================================
echo   EL PROGRAMA SE HA DETENIDO O CERRADO.
echo ============================================================
pause