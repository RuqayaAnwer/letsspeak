@echo off
echo Starting servers...
start "Laravel Backend" cmd /k "cd /d %~dp0backend && php artisan serve"
timeout /t 2 /nobreak >nul
start "React Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Servers are starting in separate windows...

