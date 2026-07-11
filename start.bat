@echo off
chcp 65001 >nul 2>&1

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start.ps1"

echo.
echo ----------------------------------------
echo Script finished (success or error shown above).
pause
