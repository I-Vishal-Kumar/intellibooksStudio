@echo off
REM ============================================
REM Intellibooks Studio - With Ray Distributed Processing
REM ============================================

echo.
echo ========================================
echo    Intellibooks Studio - Ray Mode
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running! Please start Docker Desktop first.
    pause
    exit /b 1
)

cd /d "%~dp0..\infrastructure\docker"

echo [1/4] Starting infrastructure + Ray cluster...
docker-compose --profile ray up -d postgres redis chroma rabbitmq neo4j ray-head ray-worker

echo.
echo [2/4] Waiting for services...
timeout /t 25 /nobreak >nul

echo.
echo [3/4] Starting application services with Ray enabled...
docker-compose --profile full up -d

echo.
echo [4/4] Service status:
docker-compose --profile ray --profile full ps

echo.
echo ========================================
echo    Ray Cluster Ready!
echo ========================================
echo.
echo   - Ray Dashboard:   http://localhost:8265
echo   - Ray Client:      ray://localhost:10001
echo.
echo Set USE_RAY=true in .env to enable distributed processing
echo.
pause
