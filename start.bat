@echo off
title GenTIC OS
echo ═══════════════════════════════════════
echo   GENTIC OS — Starting...
echo ═══════════════════════════════════════
echo.

echo [1/2] Starting backend (port 7777)...
start "GenTIC Backend" cmd /c "cd /d C:\Users\ninja\gentic-os && python -m uvicorn backend.main:app --host 127.0.0.1 --port 7777"
timeout /t 2 /nobreak >nul

echo [2/2] Starting frontend (port 5173)...
start "GenTIC Frontend" cmd /c "cd /d C:\Users\ninja\gentic-os\frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ═══════════════════════════════════════
echo   GenTIC OS is running!
echo   Dashboard: http://localhost:5173
echo   API:       http://127.0.0.1:7777
echo ═══════════════════════════════════════
start http://localhost:5173
