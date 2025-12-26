@echo off
REM ============================================
REM Intellibooks Studio - Local Development Startup
REM ============================================

echo.
echo ========================================
echo    Intellibooks Studio - Starting Up
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running! Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Navigate to docker directory
cd /d "%~dp0..\infrastructure\docker"

echo [1/4] Starting infrastructure services (Postgres, Redis, ChromaDB, RabbitMQ, Neo4j)...
docker-compose up -d postgres redis chroma rabbitmq neo4j

echo.
echo [2/4] Waiting for services to be healthy...
timeout /t 15 /nobreak >nul

echo.
echo [3/4] Checking service health...
docker-compose ps

echo.
echo ========================================
echo    Infrastructure is ready!
echo ========================================
echo.
echo Service URLs:
echo   - PostgreSQL:  localhost:5433
echo   - Redis:       localhost:6379
echo   - ChromaDB:    http://localhost:8000
echo   - RabbitMQ:    http://localhost:15672 (admin/devpassword123)
echo   - Neo4j:       http://localhost:7474 (neo4j/devpassword123)
echo.
echo ========================================
echo    Next Steps:
echo ========================================
echo.
echo 1. Start RAG Service:
echo    cd services\rag
echo    pip install -r requirements.txt
echo    python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload
echo.
echo 2. Start UI (in new terminal):
echo    cd apps\ui
echo    npm install
echo    npm run dev
echo.
echo 3. Open browser: http://localhost:3000
echo.
pause
