@echo off
REM ============================================
REM Intellibooks Studio - Run Everything in Docker
REM ============================================

echo.
echo ========================================
echo    Intellibooks Studio - Full Stack
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

echo [1/3] Starting infrastructure services...
docker-compose up -d postgres redis chroma rabbitmq neo4j

echo.
echo [2/3] Waiting for infrastructure to be healthy (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo [3/3] Starting all application services...
docker-compose --profile app up -d --build

echo.
echo ========================================
echo    All Services Started!
echo ========================================
echo.
docker-compose --profile app ps
echo.
echo ========================================
echo    Service URLs:
echo ========================================
echo.
echo   UI:              http://localhost:3000
echo   Integrations:    http://localhost:3000/settings/integrations
echo   RAG Service:     http://localhost:8002
echo   WebSocket:       http://localhost:8004
echo   MCP Gateway:     http://localhost:8005
echo   Context Agg:     http://localhost:8006
echo   Agent Factory:   http://localhost:8007
echo.
echo   PostgreSQL:      localhost:5433
echo   Redis:           localhost:6379
echo   ChromaDB:        http://localhost:8000
echo   RabbitMQ:        http://localhost:15672 (admin/devpassword123)
echo   Neo4j:           http://localhost:7474 (neo4j/devpassword123)
echo.
echo ========================================
echo    Commands:
echo ========================================
echo   View logs:       docker-compose --profile app logs -f
echo   Stop all:        docker-compose --profile app down
echo   With Ray:        docker-compose --profile app --profile ray up -d
echo   With Dev Tools:  docker-compose --profile app --profile tools up -d
echo.
pause
