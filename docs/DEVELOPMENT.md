# Development Guide

## Python Services Setup

### Initial Setup

To ensure proper imports work across all Python services, install them as editable packages:

**Linux/macOS:**
```bash
./scripts/setup-python-services.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\setup-python-services.ps1
```

**Manual setup:**
```bash
# Activate virtual environment
source .venv/bin/activate  # Linux/macOS
# or
.venv\Scripts\Activate.ps1  # Windows PowerShell

# Install services as editable packages
pip install -e services/agents[dev]
pip install -e services/websocket[dev]
pip install -e services/rag[dev]
pip install -e packages/agent-framework[dev]
```

### Why This Matters

Installing services as editable packages ensures:
- ✅ Imports work regardless of working directory
- ✅ Changes to service code are immediately available (no reinstall needed)
- ✅ Proper Python package resolution
- ✅ Consistent behavior across different execution contexts

### Running Services

All services should be run from the **workspace root**:

```bash
# Run all services
pnpm dev:all

# Run individual services
# Ports are automatically read from packages/core/ports.json
pnpm dev:ws      # WebSocket service
pnpm dev:agents  # Agent service
pnpm dev:rag     # RAG service
```

**Note:** Service ports are centrally managed in `packages/core/ports.json`. The npm scripts automatically read ports from this file, so you don't need to hardcode ports anywhere.

### Import Patterns

When importing from other services, use one of these patterns:

**Preferred (if services are installed):**
```python
from services.agents.src.agents.chat_agent import ChatAgent
```

**Fallback (if not installed, but running from workspace root):**
```python
from agents.src.agents.chat_agent import ChatAgent
```

**With sys.path manipulation (last resort):**
```python
import sys
from pathlib import Path
project_root = Path(__file__).parent.parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
from services.agents.src.agents.chat_agent import ChatAgent
```

### Troubleshooting

**Issue: `ModuleNotFoundError: No module named 'services'`**

**Solution:** Install services as editable packages (see Initial Setup above)

**Issue: `ModuleNotFoundError: No module named 'agents'`**

**Solution:** 
1. Make sure you're running from workspace root
2. Install services as editable packages
3. Check that `PYTHONPATH` includes workspace root

**Issue: Import works in one service but not another**

**Solution:** Ensure all services are installed as editable packages from the same virtual environment

### Best Practices

1. **Always install services as editable packages** during initial setup
2. **Run services from workspace root** using the npm scripts
3. **Use absolute imports** from workspace root (`services.*` or `packages.*`)
4. **Avoid relative imports** across service boundaries
5. **Keep virtual environment activated** when running services

