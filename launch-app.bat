@echo off
title GenTIC OS
cd /d C:\Users\ninja\gentic-os

REM --- Start the backend headless (no console) if port 7777 isn't already up ---
curl -s -o nul http://127.0.0.1:7777/api/health
if not errorlevel 1 goto launch

echo Starting GenTIC OS backend...
start "GenTIC Backend" /min pythonw -m uvicorn backend.main:app --host 127.0.0.1 --port 7777

set /a tries=0
:wait
timeout /t 1 /nobreak >nul
curl -s -o nul http://127.0.0.1:7777/api/health
if not errorlevel 1 goto launch
set /a tries+=1
if %tries% lss 20 goto wait

:launch
set "URL=http://127.0.0.1:7777"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%URL% --window-size=1440,900
) else if exist "%CHROME%" (
  start "" "%CHROME%" --app=%URL% --window-size=1440,900
) else (
  start "" %URL%
)
