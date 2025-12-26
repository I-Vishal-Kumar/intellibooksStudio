@echo off
REM ============================================
REM Intellibooks Studio - Stop All Services
REM ============================================

echo.
echo ========================================
echo    Stopping All Services...
echo ========================================
echo.

cd /d "%~dp0..\infrastructure\docker"

docker-compose --profile full --profile mcp --profile ray --profile tools down

echo.
echo All services stopped.
echo.
echo To also remove volumes (WARNING: deletes all data):
echo   docker-compose down -v
echo.
pause
