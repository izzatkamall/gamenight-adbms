@echo off
REM ============================================================
REM  GameNight - start the live-voting server for a demo
REM  Run this whenever you want live voting to work on the
REM  deployed site: https://gamenight-adbms.vercel.app
REM
REM  Everything EXCEPT live voting works 24/7 without this
REM  (auth, library, rooms, chat, profiles run on Supabase).
REM  This script powers the real-time voting feature.
REM ============================================================

echo.
echo  Starting GameNight live-voting server...
echo  (Keep BOTH windows that open below running during your demo.)
echo.

REM 1) Make sure Redis is running (redis-cli ping should say PONG).
REM    If it is not, start redis-server first.

REM 2) Start the Node middleware (WebSocket + Redis) on port 4000
start "GameNight Middleware" cmd /k "cd /d %~dp0middleware && node index.js"

REM Give the middleware a moment to bind to the port
timeout /t 3 >nul

REM 3) Start the ngrok tunnel on your PERMANENT domain
start "GameNight Tunnel (ngrok)" cmd /k "ngrok http 4000 --domain=marbled-patrol-vagrantly.ngrok-free.dev"

echo.
echo  Done. Two windows opened:
echo    - GameNight Middleware  (must show: [middleware] listening on :4000)
echo    - GameNight Tunnel      (must show: started tunnel ... ngrok-free.dev)
echo.
echo  Live voting is now online. Close both windows to stop it.
echo.
pause
