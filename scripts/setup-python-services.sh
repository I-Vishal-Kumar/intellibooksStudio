#!/bin/bash
# Setup script to install all Python services as editable packages
# This ensures proper imports work regardless of working directory

set -e

echo "🔧 Setting up Python services as editable packages..."

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Install root package (if it has dependencies)
if [ -f "pyproject.toml" ]; then
    echo "📦 Installing root package..."
    pip install -e ".[dev]" || echo "⚠️  Root package installation skipped (optional)"
fi

# Install all Python services as editable packages
echo "📦 Installing Python services..."

SERVICES=("services/agents" "services/websocket" "services/rag")

for service in "${SERVICES[@]}"; do
    if [ -d "$service" ] && [ -f "$service/pyproject.toml" ]; then
        echo "  → Installing $service..."
        pip install -e "$service[dev]" || echo "    ⚠️  Failed to install $service (check dependencies)"
    else
        echo "  ⚠️  Skipping $service (not found or no pyproject.toml)"
    fi
done

# Install agent-framework package
if [ -d "packages/agent-framework" ] && [ -f "packages/agent-framework/pyproject.toml" ]; then
    echo "  → Installing agent-framework..."
    pip install -e "packages/agent-framework[dev]" || echo "    ⚠️  Failed to install agent-framework"
fi

echo ""
echo "✅ Python services setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Make sure your .env file is configured"
echo "   2. Run services with: pnpm dev:all"
echo "   3. Or run individually: pnpm dev:ws, pnpm dev:agents, etc."
echo ""

