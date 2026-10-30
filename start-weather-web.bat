@echo off
title Skyline Weather - local server
cd /d "%~dp0"
echo Starting Skyline on http://127.0.0.1:5500/
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:5500/"
python -m http.server 5500 --bind 127.0.0.1
pause
