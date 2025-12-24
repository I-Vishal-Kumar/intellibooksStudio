"""
Long-Term Memory Backend for Deep Agents

Implements CompositeBackend pattern for routing filesystem operations
to different storage backends based on path prefixes.
"""

from typing import Dict, Any, Optional, List
from pathlib import Path
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class BackendProtocol:
    """Protocol interface for backend implementations."""
    
    def read(self, path: str) -> str:
        """Read content from path."""
        raise NotImplementedError
    
    def write(self, path: str, content: str) -> None:
        """Write content to path."""
        raise NotImplementedError
    
    def exists(self, path: str) -> bool:
        """Check if path exists."""
        raise NotImplementedError
    
    def list(self, path: str) -> List[str]:
        """List contents of directory."""
        raise NotImplementedError
    
    def delete(self, path: str) -> None:
        """Delete path."""
        raise NotImplementedError


class StateBackend(BackendProtocol):
    """
    Ephemeral in-memory storage for session data (/workspace/).
    
    Used for temporary files and workspace operations.
    """
    
    def __init__(self):
        self._storage: Dict[str, str] = {}
        logger.debug("StateBackend initialized (in-memory storage)")
    
    def read(self, path: str) -> str:
        """Read content from in-memory storage."""
        if path not in self._storage:
            raise FileNotFoundError(f"Path not found: {path}")
        return self._storage[path]
    
    def write(self, path: str, content: str) -> None:
        """Write content to in-memory storage."""
        self._storage[path] = content
        logger.debug(f"StateBackend.write: {path}")
    
    def exists(self, path: str) -> bool:
        """Check if path exists in storage."""
        return path in self._storage
    
    def list(self, path: str) -> List[str]:
        """List paths with given prefix."""
        prefix = path.rstrip("/") + "/"
        return [
            p for p in self._storage.keys()
            if p.startswith(prefix)
        ]
    
    def delete(self, path: str) -> None:
        """Delete path from storage."""
        if path in self._storage:
            del self._storage[path]
            logger.debug(f"StateBackend.delete: {path}")


class StoreBackend(BackendProtocol):
    """
    Persistent storage using file system for /memories/ paths.
    
    Stores data in JSON files organized by session_id.
    """
    
    def __init__(self, base_directory: str, session_id: Optional[str] = None):
        """
        Initialize StoreBackend.
        
        Args:
            base_directory: Base directory for storing memories
            session_id: Optional session ID for namespace isolation
        """
        self.base_directory = Path(base_directory)
        self.session_id = session_id or "default"
        self.memory_dir = self.base_directory / "memories" / f"session_{self.session_id}"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"StoreBackend initialized: {self.memory_dir}")
    
    def _resolve_path(self, path: str) -> Path:
        """Resolve memory path to file system path."""
        # Remove /memories/ prefix if present
        if path.startswith("/memories/"):
            path = path[len("/memories/"):]
        
        # Ensure path is within memory directory
        resolved = self.memory_dir / path.lstrip("/")
        resolved.parent.mkdir(parents=True, exist_ok=True)
        return resolved
    
    def read(self, path: str) -> str:
        """Read content from persistent storage."""
        file_path = self._resolve_path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"Path not found: {path}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        logger.debug(f"StoreBackend.read: {path}")
        return content
    
    def write(self, path: str, content: str) -> None:
        """Write content to persistent storage."""
        file_path = self._resolve_path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        logger.debug(f"StoreBackend.write: {path}")
    
    def exists(self, path: str) -> bool:
        """Check if path exists."""
        file_path = self._resolve_path(path)
        return file_path.exists()
    
    def list(self, path: str) -> List[str]:
        """List contents of directory."""
        dir_path = self._resolve_path(path)
        if not dir_path.exists() or not dir_path.is_dir():
            return []
        
        return [
            str(p.relative_to(self.memory_dir))
            for p in dir_path.iterdir()
        ]
    
    def delete(self, path: str) -> None:
        """Delete path."""
        file_path = self._resolve_path(path)
        if file_path.exists():
            if file_path.is_dir():
                import shutil
                shutil.rmtree(file_path)
            else:
                file_path.unlink()
            logger.debug(f"StoreBackend.delete: {path}")


class CompositeBackend(BackendProtocol):
    """
    Routes filesystem operations by path prefix to different backends.
    
    Example:
        backend = CompositeBackend(
            default=StateBackend(),
            routes={
                '/memories/': StoreBackend(base_directory='./data'),
                '/workspace/': StateBackend(),
            }
        )
    """
    
    def __init__(
        self,
        default: BackendProtocol,
        routes: Optional[Dict[str, BackendProtocol]] = None,
    ):
        """
        Initialize CompositeBackend.
        
        Args:
            default: Default backend for unmatched paths
            routes: Dictionary mapping path prefixes to backends
        """
        self.default = default
        self.routes = routes or {}
        # Sort routes by length (longest first) for proper prefix matching
        self._sorted_routes = sorted(
            self.routes.items(),
            key=lambda x: len(x[0]),
            reverse=True
        )
        logger.info(f"CompositeBackend initialized with {len(self.routes)} routes")
    
    def _get_backend(self, path: str) -> BackendProtocol:
        """Get backend for given path based on prefix matching."""
        for prefix, backend in self._sorted_routes:
            if path.startswith(prefix):
                return backend
        return self.default
    
    def read(self, path: str) -> str:
        """Read from appropriate backend."""
        backend = self._get_backend(path)
        return backend.read(path)
    
    def write(self, path: str, content: str) -> None:
        """Write to appropriate backend."""
        backend = self._get_backend(path)
        backend.write(path, content)
    
    def exists(self, path: str) -> bool:
        """Check existence in appropriate backend."""
        backend = self._get_backend(path)
        return backend.exists(path)
    
    def list(self, path: str) -> List[str]:
        """List contents from appropriate backend."""
        backend = self._get_backend(path)
        return backend.list(path)
    
    def delete(self, path: str) -> None:
        """Delete from appropriate backend."""
        backend = self._get_backend(path)
        backend.delete(path)


def create_memory_backend(
    base_directory: str,
    session_id: Optional[str] = None,
) -> CompositeBackend:
    """
    Create a CompositeBackend configured for research agent memory.
    
    Args:
        base_directory: Base directory for data storage
        session_id: Session ID for namespace isolation
        
    Returns:
        Configured CompositeBackend instance
    """
    # Create StoreBackend for /memories/ with session isolation
    store_backend = StoreBackend(
        base_directory=base_directory,
        session_id=session_id,
    )
    
    # Create StateBackend for /workspace/ (temporary files)
    state_backend = StateBackend()
    
    # Create CompositeBackend with routing
    composite = CompositeBackend(
        default=state_backend,
        routes={
            "/memories/": store_backend,
            "/workspace/": state_backend,
        }
    )
    
    logger.info(f"Memory backend created for session: {session_id}")
    return composite

