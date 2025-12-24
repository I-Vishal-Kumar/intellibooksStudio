"""PostgreSQL database provider implementation."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

try:
    import asyncpg
    from asyncpg import Pool, Connection
    ASYNCPG_AVAILABLE = True
except ImportError:
    asyncpg = None
    Pool = None
    Connection = None
    ASYNCPG_AVAILABLE = False

from .base import (
    DatabaseProvider,
    DatabaseConfig,
    DatabaseType,
    QueryResult,
    SchemaInfo,
)

logger = logging.getLogger(__name__)


class PostgreSQLProvider(DatabaseProvider):
    """PostgreSQL database provider."""

    def __init__(self, config: DatabaseConfig):
        if not ASYNCPG_AVAILABLE:
            raise ImportError(
                "asyncpg is required for PostgreSQL support. Install with: pip install asyncpg"
            )
        super().__init__(config)
        self._pool: Optional[Pool] = None

    @property
    def db_type(self) -> DatabaseType:
        return DatabaseType.POSTGRESQL

    async def connect(self) -> bool:
        """Establish PostgreSQL connection pool."""
        try:
            # Build connection parameters
            conn_params = {
                "host": self.config.host,
                "port": self.config.port,
                "database": self.config.database,
                "user": self.config.user,
                "password": self.config.password,
                "min_size": 2,
                "max_size": self.config.pool_size,
            }

            # Add SSL mode if specified
            if self.config.ssl_mode:
                conn_params["ssl"] = self.config.ssl_mode

            # Add extra parameters
            if self.config.extra_params:
                conn_params.update(self.config.extra_params)

            self._pool = await asyncpg.create_pool(**conn_params)

            # Test connection
            async with self._pool.acquire() as conn:
                await conn.fetchval("SELECT 1")

            logger.info(f"✅ Connected to PostgreSQL at {self.config.host}:{self.config.port}/{self.config.database}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            return False

    async def disconnect(self) -> None:
        """Close PostgreSQL connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("PostgreSQL connection pool closed")

    async def execute_query(
        self,
        query: str,
        params: Optional[List[Any]] = None,
        timeout: Optional[int] = None,
    ) -> QueryResult:
        """Execute a SQL query and return results."""
        start_time = time.time()
        params = params or []

        conn = None
        try:
            conn = await self._get_connection()
            # Set timeout if provided
            if timeout:
                conn._timeout = timeout

            # Execute query
            rows = await conn.fetch(query, *params)

            # Get column names from first row
            columns = list(rows[0].keys()) if rows else []

            # Convert rows to dictionaries
            row_dicts = [dict(row) for row in rows]

            execution_time = (time.time() - start_time) * 1000  # Convert to ms

            return QueryResult(
                rows=row_dicts,
                columns=columns,
                row_count=len(row_dicts),
                execution_time_ms=execution_time,
                query=query,
            )
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"Query execution failed: {e}")
            return QueryResult(
                rows=[],
                columns=[],
                row_count=0,
                execution_time_ms=execution_time,
                query=query,
                error=str(e),
            )
        finally:
            if conn:
                await self._release_connection(conn)

    async def _get_connection(self):
        """Get a database connection, creating a new one if pool is not available or in different loop."""
        import asyncio
        
        # Always create a new connection for tool calls to avoid event loop issues
        # The pool is mainly for initialization/testing, but tools run in different loops
        # For better performance in production, we could cache connections per event loop
        conn_params = {
            "host": self.config.host,
            "port": self.config.port,
            "database": self.config.database,
            "user": self.config.user,
            "password": self.config.password,
        }
        
        if self.config.ssl_mode:
            conn_params["ssl"] = self.config.ssl_mode
        
        if self.config.extra_params:
            conn_params.update(self.config.extra_params)
        
        return await asyncpg.connect(**conn_params)

    async def _release_connection(self, conn):
        """Release a connection by closing it."""
        if not conn:
            return
            
        try:
            # Always close connections (they're created fresh for each tool call)
            await conn.close()
        except Exception as e:
            logger.warning(f"Error closing connection: {e}")
            # Ignore errors when closing

    async def get_schema(
        self,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
    ) -> SchemaInfo:
        """Get PostgreSQL schema information."""
        schema_name = schema_name or self.config.schema or "public"

        conn = None
        try:
            conn = await self._get_connection()
            # Get tables
            table_query = """
                SELECT 
                    table_schema,
                    table_name,
                    table_type
                FROM information_schema.tables
                WHERE table_schema = $1
            """
            if table_name:
                table_query += " AND table_name = $2"
                table_rows = await conn.fetch(table_query, schema_name, table_name)
            else:
                table_query += " ORDER BY table_name"
                table_rows = await conn.fetch(table_query, schema_name)

            tables = [
                {
                    "schema": row["table_schema"],
                    "name": row["table_name"],
                    "type": row["table_type"],
                }
                for row in table_rows
            ]

            # Get columns for each table
            columns: Dict[str, List[Dict[str, Any]]] = {}
            for table in tables:
                column_query = """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        character_maximum_length,
                        numeric_precision,
                        numeric_scale
                    FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    ORDER BY ordinal_position
                """
                column_rows = await conn.fetch(column_query, schema_name, table["name"])
                columns[table["name"]] = [
                    {
                        "name": row["column_name"],
                        "type": row["data_type"],
                        "nullable": row["is_nullable"] == "YES",
                        "default": row["column_default"],
                        "max_length": row["character_maximum_length"],
                        "precision": row["numeric_precision"],
                        "scale": row["numeric_scale"],
                    }
                    for row in column_rows
                ]

            # Get foreign key relationships
            fk_query = """
                SELECT
                    tc.table_schema,
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_schema AS foreign_table_schema,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1
            """
            if table_name:
                fk_query += " AND tc.table_name = $2"
                fk_rows = await conn.fetch(fk_query, schema_name, table_name)
            else:
                fk_query += " ORDER BY tc.table_name, kcu.column_name"
                fk_rows = await conn.fetch(fk_query, schema_name)

            relationships = [
                {
                    "from_schema": row["table_schema"],
                    "from_table": row["table_name"],
                    "from_column": row["column_name"],
                    "to_schema": row["foreign_table_schema"],
                    "to_table": row["foreign_table_name"],
                    "to_column": row["foreign_column_name"],
                }
                for row in fk_rows
            ]

            return SchemaInfo(
                tables=tables,
                columns=columns,
                relationships=relationships,
            )
        except Exception as e:
            logger.error(f"Failed to get schema: {e}")
            raise
        finally:
            if conn:
                await self._release_connection(conn)

    async def validate_query(self, query: str) -> Dict[str, Any]:
        """Validate PostgreSQL query syntax and safety."""
        validation_result = {
            "valid": False,
            "errors": [],
            "warnings": [],
            "is_select": False,
            "estimated_cost": None,
        }

        # Basic safety checks
        query_lower = query.strip().lower()

        # Check for dangerous operations
        dangerous_ops = ["drop", "delete", "truncate", "alter", "create", "insert", "update"]
        for op in dangerous_ops:
            if query_lower.startswith(op):
                validation_result["errors"].append(
                    f"Operation '{op.upper()}' is not allowed. Only SELECT queries are permitted."
                )
                return validation_result

        # Check if it's a SELECT query
        if query_lower.startswith("select"):
            validation_result["is_select"] = True
        else:
            validation_result["errors"].append("Only SELECT queries are allowed.")
            return validation_result

        # Try to parse the query using EXPLAIN
        conn = None
        try:
            conn = await self._get_connection()
            explain_query = f"EXPLAIN {query}"
            await conn.fetch(explain_query)
            validation_result["valid"] = True

            # Try to get estimated cost
            try:
                cost_query = f"EXPLAIN (FORMAT JSON) {query}"
                result = await conn.fetch(cost_query)
                if result:
                    # Parse JSON to extract cost estimate
                    import json
                    plan = json.loads(result[0][0])
                    if plan and len(plan) > 0:
                        total_cost = plan[0].get("Plan", {}).get("Total Cost", None)
                        if total_cost:
                            validation_result["estimated_cost"] = total_cost
            except Exception:
                pass  # Cost estimation is optional

        except Exception as e:
            validation_result["errors"].append(f"Query syntax error: {str(e)}")
            return validation_result
        finally:
            if conn:
                await self._release_connection(conn)

        # Check for potential expensive operations
        if "join" in query_lower and query_lower.count("join") > 5:
            validation_result["warnings"].append("Query contains many JOINs, may be expensive.")

        if "order by" in query_lower and "limit" not in query_lower:
            validation_result["warnings"].append("Query lacks LIMIT clause, may return large result set.")

        return validation_result

    async def health_check(self) -> Dict[str, Any]:
        """Check PostgreSQL connection health."""
        if not self._pool:
            return {
                "status": "disconnected",
                "message": "Database not connected",
            }

        try:
            async with self._pool.acquire() as conn:
                version = await conn.fetchval("SELECT version()")
                pool_size = self._pool.get_size()

            return {
                "status": "healthy",
                "version": version.split(",")[0] if version else "unknown",
                "pool_size": pool_size,
                "database": self.config.database,
                "host": self.config.host,
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": str(e),
            }

