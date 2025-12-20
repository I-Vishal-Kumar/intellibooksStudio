# PowerShell script to install all Python services as editable packages
# This ensures proper imports work regardless of working directory

Write-Host "🔧 Setting up Python services as editable packages..." -ForegroundColor Cyan

# Get the script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

# Check if virtual environment exists
if (-not (Test-Path ".venv")) {
    Write-Host "⚠️  Virtual environment not found. Creating one..." -ForegroundColor Yellow
    python -m venv .venv
}

# Activate virtual environment
Write-Host "📦 Activating virtual environment..." -ForegroundColor Cyan
& .\.venv\Scripts\Activate.ps1

# Install root package (if it has dependencies)
if (Test-Path "pyproject.toml") {
    Write-Host "📦 Installing root package..." -ForegroundColor Cyan
    pip install -e ".[dev]" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Root package installation skipped (optional)" -ForegroundColor Yellow
    }
}

# Install all Python services as editable packages
Write-Host "📦 Installing Python services..." -ForegroundColor Cyan

$Services = @("services/agents", "services/websocket", "services/rag")

foreach ($service in $Services) {
    if ((Test-Path $service) -and (Test-Path "$service/pyproject.toml")) {
        Write-Host "  → Installing $service..." -ForegroundColor Green
        pip install -e "$service[dev]" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    ⚠️  Failed to install $service (check dependencies)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Skipping $service (not found or no pyproject.toml)" -ForegroundColor Yellow
    }
}

# Install agent-framework package
if ((Test-Path "packages/agent-framework") -and (Test-Path "packages/agent-framework/pyproject.toml")) {
    Write-Host "  → Installing agent-framework..." -ForegroundColor Green
    pip install -e "packages/agent-framework[dev]" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ⚠️  Failed to install agent-framework" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Python services setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Make sure your .env file is configured"
Write-Host "   2. Run services with: pnpm dev:all"
Write-Host "   3. Or run individually: pnpm dev:ws, pnpm dev:agents, etc."
Write-Host ""

