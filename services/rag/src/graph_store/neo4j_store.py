"""Neo4j Store for Knowledge Graph storage and retrieval."""

import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from contextlib import asynccontextmanager

try:
    from neo4j import AsyncGraphDatabase, AsyncDriver
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    AsyncGraphDatabase = None
    AsyncDriver = None

from ..config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """Represents a node in the knowledge graph."""
    id: str
    name: str
    type: str  # Person, Organization, Concept, Topic, Event, Location
    description: Optional[str] = None
    confidence: float = 1.0
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class GraphEdge:
    """Represents an edge/relationship in the knowledge graph."""
    id: str
    source_id: str
    target_id: str
    relationship_type: str  # RELATED_TO, PART_OF, CAUSES, MENTIONS, etc.
    confidence: float = 1.0
    metadata: Optional[Dict[str, Any]] = None


class Neo4jStore:
    """
    Neo4j-based graph store for knowledge graph operations.

    Implements graceful fallback - if Neo4j is unavailable, operations
    will log warnings but not fail the application.
    """

    def __init__(self, uri: str, user: str, password: str, database: str = "neo4j"):
        self.uri = uri
        self.user = user
        self.password = password
        self.database = database
        self._driver: Optional[AsyncDriver] = None
        self._available = False

    async def connect(self) -> bool:
        """Establish connection to Neo4j."""
        if not NEO4J_AVAILABLE:
            logger.warning("Neo4j driver not installed. Run: pip install neo4j")
            return False

        try:
            self._driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_pool_size=50,
            )
            # Verify connectivity
            async with self._driver.session(database=self.database) as session:
                await session.run("RETURN 1")
            self._available = True
            logger.info(f"✅ Connected to Neo4j at {self.uri}")

            # Initialize schema constraints
            await self._initialize_schema()
            return True
        except Exception as e:
            logger.warning(f"⚠️ Neo4j connection failed: {e}. Knowledge graph features will use fallback.")
            self._available = False
            return False

    async def _initialize_schema(self):
        """Create indexes and constraints for optimal performance."""
        if not self._available:
            return

        constraints = [
            # Unique constraint on Entity id
            "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
            # Unique constraint on Document id
            "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
            # Unique constraint on Chunk id
            "CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE",
            # Index on Entity name for fast lookups
            "CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name)",
            # Index on Entity type for filtering
            "CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)",
        ]

        async with self._driver.session(database=self.database) as session:
            for constraint in constraints:
                try:
                    await session.run(constraint)
                except Exception as e:
                    # Constraint might already exist
                    logger.debug(f"Schema setup: {e}")

    async def close(self):
        """Close the Neo4j connection."""
        if self._driver:
            await self._driver.close()
            self._driver = None
            self._available = False
            logger.info("Neo4j connection closed")

    @property
    def is_available(self) -> bool:
        """Check if Neo4j is available."""
        return self._available

    @asynccontextmanager
    async def session(self):
        """Get a Neo4j session context manager."""
        if not self._available or not self._driver:
            raise RuntimeError("Neo4j is not available")
        async with self._driver.session(database=self.database) as session:
            yield session

    # ==================== Entity Operations ====================

    async def add_entity(self, entity: GraphNode, document_id: Optional[str] = None,
                         chunk_id: Optional[str] = None) -> bool:
        """Add an entity node to the graph."""
        if not self._available:
            logger.debug("Neo4j unavailable, skipping add_entity")
            return False

        query = """
        MERGE (e:Entity {id: $id})
        SET e.name = $name,
            e.type = $type,
            e.description = $description,
            e.confidence = $confidence,
            e.metadata = $metadata,
            e.updated_at = datetime()
        WITH e
        OPTIONAL MATCH (c:Chunk {id: $chunk_id})
        FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
            MERGE (e)-[:EXTRACTED_FROM]->(c)
        )
        RETURN e
        """

        try:
            async with self.session() as session:
                await session.run(
                    query,
                    id=entity.id,
                    name=entity.name,
                    type=entity.type,
                    description=entity.description,
                    confidence=entity.confidence,
                    metadata=str(entity.metadata) if entity.metadata else None,
                    chunk_id=chunk_id,
                )
            return True
        except Exception as e:
            logger.error(f"Failed to add entity: {e}")
            return False

    async def add_entities_batch(self, entities: List[GraphNode],
                                  chunk_id: Optional[str] = None) -> int:
        """Add multiple entities in a batch operation."""
        if not self._available:
            return 0

        query = """
        UNWIND $entities AS entity
        MERGE (e:Entity {id: entity.id})
        SET e.name = entity.name,
            e.type = entity.type,
            e.description = entity.description,
            e.confidence = entity.confidence,
            e.updated_at = datetime()
        WITH e, entity
        OPTIONAL MATCH (c:Chunk {id: $chunk_id})
        FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
            MERGE (e)-[:EXTRACTED_FROM]->(c)
        )
        RETURN count(e) as count
        """

        try:
            entities_data = [
                {
                    "id": e.id,
                    "name": e.name,
                    "type": e.type,
                    "description": e.description,
                    "confidence": e.confidence,
                }
                for e in entities
            ]

            async with self.session() as session:
                result = await session.run(query, entities=entities_data, chunk_id=chunk_id)
                record = await result.single()
                return record["count"] if record else 0
        except Exception as e:
            logger.error(f"Failed to add entities batch: {e}")
            return 0

    async def get_entity(self, entity_id: str) -> Optional[GraphNode]:
        """Get an entity by ID."""
        if not self._available:
            return None

        query = """
        MATCH (e:Entity {id: $id})
        RETURN e
        """

        try:
            async with self.session() as session:
                result = await session.run(query, id=entity_id)
                record = await result.single()
                if record:
                    e = record["e"]
                    return GraphNode(
                        id=e["id"],
                        name=e["name"],
                        type=e["type"],
                        description=e.get("description"),
                        confidence=e.get("confidence", 1.0),
                    )
        except Exception as e:
            logger.error(f"Failed to get entity: {e}")
        return None

    # ==================== Relationship Operations ====================

    async def add_relationship(self, edge: GraphEdge) -> bool:
        """Add a relationship between two entities."""
        if not self._available:
            return False

        query = """
        MATCH (source:Entity {id: $source_id})
        MATCH (target:Entity {id: $target_id})
        MERGE (source)-[r:RELATED_TO {id: $id}]->(target)
        SET r.type = $relationship_type,
            r.confidence = $confidence,
            r.updated_at = datetime()
        RETURN r
        """

        try:
            async with self.session() as session:
                await session.run(
                    query,
                    id=edge.id,
                    source_id=edge.source_id,
                    target_id=edge.target_id,
                    relationship_type=edge.relationship_type,
                    confidence=edge.confidence,
                )
            return True
        except Exception as e:
            logger.error(f"Failed to add relationship: {e}")
            return False

    async def add_relationships_batch(self, edges: List[GraphEdge]) -> int:
        """Add multiple relationships in a batch operation."""
        if not self._available:
            return 0

        query = """
        UNWIND $edges AS edge
        MATCH (source:Entity {id: edge.source_id})
        MATCH (target:Entity {id: edge.target_id})
        MERGE (source)-[r:RELATED_TO {id: edge.id}]->(target)
        SET r.type = edge.relationship_type,
            r.confidence = edge.confidence,
            r.updated_at = datetime()
        RETURN count(r) as count
        """

        try:
            edges_data = [
                {
                    "id": e.id,
                    "source_id": e.source_id,
                    "target_id": e.target_id,
                    "relationship_type": e.relationship_type,
                    "confidence": e.confidence,
                }
                for e in edges
            ]

            async with self.session() as session:
                result = await session.run(query, edges=edges_data)
                record = await result.single()
                return record["count"] if record else 0
        except Exception as e:
            logger.error(f"Failed to add relationships batch: {e}")
            return 0

    # ==================== Document/Chunk Operations ====================

    async def add_document(self, document_id: str, filename: str,
                           session_id: Optional[str] = None) -> bool:
        """Add a document node to the graph."""
        if not self._available:
            return False

        query = """
        MERGE (d:Document {id: $id})
        SET d.filename = $filename,
            d.session_id = $session_id,
            d.created_at = datetime()
        RETURN d
        """

        try:
            async with self.session() as session:
                await session.run(
                    query,
                    id=document_id,
                    filename=filename,
                    session_id=session_id,
                )
            return True
        except Exception as e:
            logger.error(f"Failed to add document: {e}")
            return False

    async def add_chunk(self, chunk_id: str, document_id: str,
                        content: str, position: int) -> bool:
        """Add a chunk node linked to its document."""
        if not self._available:
            return False

        query = """
        MERGE (c:Chunk {id: $chunk_id})
        SET c.content = $content,
            c.position = $position
        WITH c
        MATCH (d:Document {id: $document_id})
        MERGE (c)-[:PART_OF]->(d)
        RETURN c
        """

        try:
            async with self.session() as session:
                await session.run(
                    query,
                    chunk_id=chunk_id,
                    document_id=document_id,
                    content=content[:500],  # Store truncated content
                    position=position,
                )
            return True
        except Exception as e:
            logger.error(f"Failed to add chunk: {e}")
            return False

    # ==================== Query Operations ====================

    async def get_all_entities(self, entity_type: Optional[str] = None,
                                limit: int = 100) -> List[GraphNode]:
        """Get all entities, optionally filtered by type."""
        if not self._available:
            return []

        if entity_type:
            query = """
            MATCH (e:Entity {type: $type})
            RETURN e
            ORDER BY e.name
            LIMIT $limit
            """
            params = {"type": entity_type, "limit": limit}
        else:
            query = """
            MATCH (e:Entity)
            RETURN e
            ORDER BY e.name
            LIMIT $limit
            """
            params = {"limit": limit}

        try:
            async with self.session() as session:
                result = await session.run(query, **params)
                entities = []
                async for record in result:
                    e = record["e"]
                    entities.append(GraphNode(
                        id=e["id"],
                        name=e["name"],
                        type=e["type"],
                        description=e.get("description"),
                        confidence=e.get("confidence", 1.0),
                    ))
                return entities
        except Exception as e:
            logger.error(f"Failed to get entities: {e}")
            return []

    async def get_entity_relationships(self, entity_id: str) -> Dict[str, Any]:
        """Get an entity with all its relationships."""
        if not self._available:
            return {"entity": None, "relationships": []}

        query = """
        MATCH (e:Entity {id: $id})
        OPTIONAL MATCH (e)-[r]-(related:Entity)
        RETURN e,
               collect(DISTINCT {
                   relationship: type(r),
                   related_id: related.id,
                   related_name: related.name,
                   related_type: related.type,
                   direction: CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END
               }) as relationships
        """

        try:
            async with self.session() as session:
                result = await session.run(query, id=entity_id)
                record = await result.single()
                if record:
                    e = record["e"]
                    return {
                        "entity": GraphNode(
                            id=e["id"],
                            name=e["name"],
                            type=e["type"],
                            description=e.get("description"),
                            confidence=e.get("confidence", 1.0),
                        ),
                        "relationships": record["relationships"],
                    }
        except Exception as e:
            logger.error(f"Failed to get entity relationships: {e}")
        return {"entity": None, "relationships": []}

    async def get_knowledge_graph(self, session_id: Optional[str] = None,
                                   limit: int = 100) -> Dict[str, Any]:
        """
        Get the full knowledge graph for visualization.
        Returns nodes and edges in a format compatible with React Flow.
        """
        if not self._available:
            return {"nodes": [], "edges": []}

        # Query all entities and their relationships
        if session_id:
            query = """
            MATCH (e:Entity)-[:EXTRACTED_FROM]->(:Chunk)-[:PART_OF]->(d:Document {session_id: $session_id})
            WITH DISTINCT e
            OPTIONAL MATCH (e)-[r:RELATED_TO]-(other:Entity)
            WHERE other.id IN [x IN collect(DISTINCT e.id)]
            RETURN DISTINCT e, r, other
            LIMIT $limit
            """
            params = {"session_id": session_id, "limit": limit}
        else:
            # Global knowledge graph
            query = """
            MATCH (e:Entity)
            OPTIONAL MATCH (e)-[r:RELATED_TO]->(other:Entity)
            RETURN e, r, other
            LIMIT $limit
            """
            params = {"limit": limit}

        try:
            nodes_map = {}
            edges = []

            async with self.session() as session:
                result = await session.run(query, **params)
                async for record in result:
                    e = record["e"]
                    if e["id"] not in nodes_map:
                        nodes_map[e["id"]] = {
                            "id": e["id"],
                            "label": e["name"],
                            "type": e["type"],
                            "description": e.get("description"),
                            "confidence": e.get("confidence", 1.0),
                        }

                    if record["r"] and record["other"]:
                        other = record["other"]
                        if other["id"] not in nodes_map:
                            nodes_map[other["id"]] = {
                                "id": other["id"],
                                "label": other["name"],
                                "type": other["type"],
                                "description": other.get("description"),
                                "confidence": other.get("confidence", 1.0),
                            }

                        r = record["r"]
                        edge_id = f"{e['id']}-{other['id']}"
                        edges.append({
                            "id": edge_id,
                            "source": e["id"],
                            "target": other["id"],
                            "label": r.get("type", "RELATED_TO"),
                            "confidence": r.get("confidence", 1.0),
                        })

            return {
                "nodes": list(nodes_map.values()),
                "edges": edges,
            }
        except Exception as e:
            logger.error(f"Failed to get knowledge graph: {e}")
            return {"nodes": [], "edges": []}

    async def find_path(self, source_id: str, target_id: str,
                        max_depth: int = 5) -> List[Dict[str, Any]]:
        """Find shortest path between two entities."""
        if not self._available:
            return []

        query = """
        MATCH path = shortestPath(
            (source:Entity {id: $source_id})-[*..{max_depth}]-(target:Entity {id: $target_id})
        )
        RETURN nodes(path) as nodes, relationships(path) as rels
        """.replace("{max_depth}", str(max_depth))

        try:
            async with self.session() as session:
                result = await session.run(query, source_id=source_id, target_id=target_id)
                record = await result.single()
                if record:
                    path_nodes = [
                        {"id": n["id"], "name": n["name"], "type": n["type"]}
                        for n in record["nodes"]
                    ]
                    return path_nodes
        except Exception as e:
            logger.error(f"Failed to find path: {e}")
        return []

    async def search_entities(self, query_text: str, limit: int = 20) -> List[GraphNode]:
        """Search entities by name (case-insensitive contains)."""
        if not self._available:
            return []

        query = """
        MATCH (e:Entity)
        WHERE toLower(e.name) CONTAINS toLower($query)
        RETURN e
        ORDER BY e.name
        LIMIT $limit
        """

        try:
            async with self.session() as session:
                result = await session.run(query, query=query_text, limit=limit)
                entities = []
                async for record in result:
                    e = record["e"]
                    entities.append(GraphNode(
                        id=e["id"],
                        name=e["name"],
                        type=e["type"],
                        description=e.get("description"),
                        confidence=e.get("confidence", 1.0),
                    ))
                return entities
        except Exception as e:
            logger.error(f"Failed to search entities: {e}")
            return []

    async def get_stats(self) -> Dict[str, int]:
        """Get graph statistics."""
        if not self._available:
            return {"entities": 0, "relationships": 0, "documents": 0, "chunks": 0}

        query = """
        MATCH (e:Entity) WITH count(e) as entities
        MATCH ()-[r:RELATED_TO]->() WITH entities, count(r) as relationships
        MATCH (d:Document) WITH entities, relationships, count(d) as documents
        MATCH (c:Chunk)
        RETURN entities, relationships, documents, count(c) as chunks
        """

        try:
            async with self.session() as session:
                result = await session.run(query)
                record = await result.single()
                if record:
                    return {
                        "entities": record["entities"],
                        "relationships": record["relationships"],
                        "documents": record["documents"],
                        "chunks": record["chunks"],
                    }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
        return {"entities": 0, "relationships": 0, "documents": 0, "chunks": 0}


# Singleton instance
_neo4j_store: Optional[Neo4jStore] = None


async def get_neo4j_store() -> Neo4jStore:
    """Get or create the Neo4j store singleton."""
    global _neo4j_store

    if _neo4j_store is None:
        settings = get_settings()
        _neo4j_store = Neo4jStore(
            uri=settings.neo4j_uri,
            user=settings.neo4j_user,
            password=settings.neo4j_password,
            database=settings.neo4j_database,
        )
        await _neo4j_store.connect()

    return _neo4j_store
