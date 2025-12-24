"""Base database provider interface for analytics agent."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class DatabaseType(str, Enum):
    """Supported database types."""
    POSTGRESQL = "postgresql"
    SNOWFLAKE = "snowflake"
    MYSQL = "mysql"
    SQLITE = "sqlite"


@dataclass
class DatabaseConfig:
    """Database connection configuration."""
    db_type: DatabaseType
    host: str
    port: int
    database: str
    user: str
    password: str
    # Additional connection parameters
    schema: Optional[str] = None
    ssl_mode: Optional[str] = None
    pool_size: int = 10
    max_overflow: int = 20
    # Provider-specific options
    extra_params: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> "DatabaseConfig":
        """Create DatabaseConfig from dictionary."""
        db_type = DatabaseType(config_dict.get("db_type", "postgresql").lower())
        return cls(
            db_type=db_type,
            host=config_dict.get("host", "localhost"),
            port=int(config_dict.get("port", 5432)),
            database=config_dict.get("database", ""),
            user=config_dict.get("user", ""),
            password=config_dict.get("password", ""),
            schema=config_dict.get("schema"),
            ssl_mode=config_dict.get("ssl_mode"),
            pool_size=int(config_dict.get("pool_size", 10)),
            max_overflow=int(config_dict.get("max_overflow", 20)),
            extra_params=config_dict.get("extra_params"),
        )


@dataclass
class QueryResult:
    """Result of a database query."""
    rows: List[Dict[str, Any]]
    columns: List[str]
    row_count: int
    execution_time_ms: float
    query: str
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "rows": self.rows,
            "columns": self.columns,
            "row_count": self.row_count,
            "execution_time_ms": self.execution_time_ms,
            "query": self.query,
            "error": self.error,
        }


@dataclass
class SchemaInfo:
    """Database schema information."""
    tables: List[Dict[str, Any]]  # List of table metadata
    columns: Dict[str, List[Dict[str, Any]]]  # Table name -> list of column metadata
    relationships: List[Dict[str, Any]]  # Foreign key relationships


class DatabaseProvider(ABC):
    """Abstract base class for database providers."""

    def __init__(self, config: DatabaseConfig):
        self.config = config
        self._connection = None
        self._pool = None

    @abstractmethod
    async def connect(self) -> bool:
        """Establish database connection."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Close database connection."""
        pass

    @abstractmethod
    async def execute_query(
        self,
        query: str,
        params: Optional[List[Any]] = None,
        timeout: Optional[int] = None,
    ) -> QueryResult:
        """Execute a SQL query and return results."""
        pass

    @abstractmethod
    async def get_schema(
        self,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
    ) -> SchemaInfo:
        """Get database schema information."""
        pass

    @abstractmethod
    async def validate_query(self, query: str) -> Dict[str, Any]:
        """Validate SQL query syntax and safety."""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check database connection health."""
        pass

    @property
    @abstractmethod
    def db_type(self) -> DatabaseType:
        """Get database type."""
        pass

    def get_connection_string(self) -> str:
        """Get connection string (for logging, not for direct use)."""
        return f"{self.db_type.value}://{self.config.user}@{self.config.host}:{self.config.port}/{self.config.database}"

