"""LLM-based Entity Extractor for Knowledge Graph construction."""

import logging
import json
import hashlib
from typing import List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from ..config import get_settings

logger = logging.getLogger(__name__)


class EntityType(str, Enum):
    """Domain-agnostic entity types."""
    PERSON = "Person"
    ORGANIZATION = "Organization"
    CONCEPT = "Concept"
    TOPIC = "Topic"
    EVENT = "Event"
    LOCATION = "Location"
    PRODUCT = "Product"
    TECHNOLOGY = "Technology"
    DATE = "Date"
    METRIC = "Metric"


class RelationshipType(str, Enum):
    """Relationship types between entities."""
    RELATED_TO = "RELATED_TO"
    PART_OF = "PART_OF"
    CAUSES = "CAUSES"
    MENTIONS = "MENTIONS"
    WORKS_FOR = "WORKS_FOR"
    LOCATED_IN = "LOCATED_IN"
    CREATED_BY = "CREATED_BY"
    DEPENDS_ON = "DEPENDS_ON"
    PRECEDES = "PRECEDES"
    FOLLOWS = "FOLLOWS"


@dataclass
class Entity:
    """Represents an extracted entity."""
    name: str
    type: EntityType
    description: Optional[str] = None
    confidence: float = 1.0
    id: str = field(default="")

    def __post_init__(self):
        if not self.id:
            # Generate deterministic ID from name and type
            self.id = hashlib.md5(
                f"{self.name.lower()}:{self.type}".encode()
            ).hexdigest()[:16]


@dataclass
class Relationship:
    """Represents a relationship between two entities."""
    source: Entity
    target: Entity
    relationship_type: RelationshipType
    confidence: float = 1.0
    id: str = field(default="")

    def __post_init__(self):
        if not self.id:
            self.id = hashlib.md5(
                f"{self.source.id}:{self.relationship_type}:{self.target.id}".encode()
            ).hexdigest()[:16]


EXTRACTION_PROMPT = """You are an entity extraction system. Analyze the given text and extract:
1. Named entities (people, organizations, concepts, topics, events, locations, products, technologies, dates, metrics)
2. Relationships between these entities

Output ONLY valid JSON with this exact structure:
{
    "entities": [
        {
            "name": "Entity Name",
            "type": "Person|Organization|Concept|Topic|Event|Location|Product|Technology|Date|Metric",
            "description": "Brief description",
            "confidence": 0.95
        }
    ],
    "relationships": [
        {
            "source": "Source Entity Name",
            "target": "Target Entity Name",
            "type": "RELATED_TO|PART_OF|CAUSES|MENTIONS|WORKS_FOR|LOCATED_IN|CREATED_BY|DEPENDS_ON|PRECEDES|FOLLOWS",
            "confidence": 0.9
        }
    ]
}

Guidelines:
- Extract specific, meaningful entities (not generic words)
- Normalize entity names (e.g., "Dr. John Smith" and "John Smith" should be the same entity)
- Confidence should reflect certainty (0.5-1.0)
- Only include relationships that are clearly stated or strongly implied
- Keep descriptions concise (under 100 characters)

Text to analyze:
{text}

JSON Output:"""


class EntityExtractor:
    """
    LLM-based entity and relationship extractor.

    Uses OpenRouter/OpenAI/Anthropic to extract entities and relationships
    from text chunks for building a knowledge graph.
    """

    def __init__(self):
        self.settings = get_settings()
        self._client = None

    async def _get_client(self):
        """Lazy initialization of LLM client."""
        if self._client is not None:
            return self._client

        provider = self.settings.default_llm_provider

        if provider == "openrouter" and self.settings.openrouter_api_key:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.settings.openrouter_api_key,
            )
            self._model = self.settings.openrouter_model
        elif provider == "openai" and self.settings.openai_api_key:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            self._model = "gpt-4o-mini"
        elif provider == "anthropic" and self.settings.anthropic_api_key:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=self.settings.anthropic_api_key)
            self._model = "claude-3-haiku-20240307"
        else:
            logger.warning("No LLM provider configured for entity extraction")
            return None

        return self._client

    async def extract_from_text(
        self, text: str, max_retries: int = 2
    ) -> Tuple[List[Entity], List[Relationship]]:
        """
        Extract entities and relationships from text using LLM.

        Args:
            text: The text to analyze
            max_retries: Number of retry attempts on failure

        Returns:
            Tuple of (entities, relationships)
        """
        client = await self._get_client()
        if client is None:
            return [], []

        # Truncate text if too long
        max_chars = 4000
        if len(text) > max_chars:
            text = text[:max_chars] + "..."

        prompt = EXTRACTION_PROMPT.format(text=text)

        for attempt in range(max_retries + 1):
            try:
                if hasattr(client, 'chat'):  # OpenAI-style
                    response = await client.chat.completions.create(
                        model=self._model,
                        messages=[
                            {"role": "system", "content": "You are a precise entity extraction system. Output only valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.1,
                        max_tokens=2000,
                    )
                    result_text = response.choices[0].message.content
                else:  # Anthropic-style
                    response = await client.messages.create(
                        model=self._model,
                        max_tokens=2000,
                        messages=[{"role": "user", "content": prompt}]
                    )
                    result_text = response.content[0].text

                # Parse JSON response
                return self._parse_extraction_result(result_text)

            except Exception as e:
                logger.warning(f"Entity extraction attempt {attempt + 1} failed: {e}")
                if attempt == max_retries:
                    logger.error(f"Entity extraction failed after {max_retries + 1} attempts")
                    return [], []

        return [], []

    def _parse_extraction_result(
        self, result_text: str
    ) -> Tuple[List[Entity], List[Relationship]]:
        """Parse the LLM response into Entity and Relationship objects."""
        try:
            # Try to extract JSON from the response
            result_text = result_text.strip()

            # Handle markdown code blocks
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]

            data = json.loads(result_text)

            # Parse entities
            entities = []
            entity_map = {}  # name -> Entity for relationship resolution

            for e_data in data.get("entities", []):
                try:
                    entity_type = EntityType(e_data.get("type", "Concept"))
                except ValueError:
                    entity_type = EntityType.CONCEPT

                entity = Entity(
                    name=e_data["name"],
                    type=entity_type,
                    description=e_data.get("description"),
                    confidence=float(e_data.get("confidence", 0.8)),
                )
                entities.append(entity)
                entity_map[entity.name.lower()] = entity

            # Parse relationships
            relationships = []
            for r_data in data.get("relationships", []):
                source_name = r_data.get("source", "").lower()
                target_name = r_data.get("target", "").lower()

                source = entity_map.get(source_name)
                target = entity_map.get(target_name)

                if source and target:
                    try:
                        rel_type = RelationshipType(r_data.get("type", "RELATED_TO"))
                    except ValueError:
                        rel_type = RelationshipType.RELATED_TO

                    relationship = Relationship(
                        source=source,
                        target=target,
                        relationship_type=rel_type,
                        confidence=float(r_data.get("confidence", 0.8)),
                    )
                    relationships.append(relationship)

            logger.info(f"Extracted {len(entities)} entities and {len(relationships)} relationships")
            return entities, relationships

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse extraction result as JSON: {e}")
            return [], []
        except Exception as e:
            logger.error(f"Error parsing extraction result: {e}")
            return [], []

    async def extract_from_chunks(
        self, chunks: List[str], batch_size: int = 5
    ) -> Tuple[List[Entity], List[Relationship]]:
        """
        Extract entities from multiple text chunks, deduplicating results.

        Args:
            chunks: List of text chunks to analyze
            batch_size: Number of chunks to process concurrently

        Returns:
            Tuple of (deduplicated entities, deduplicated relationships)
        """
        all_entities: dict[str, Entity] = {}
        all_relationships: dict[str, Relationship] = {}

        # Process chunks
        import asyncio
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            tasks = [self.extract_from_text(chunk) for chunk in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Chunk extraction failed: {result}")
                    continue

                entities, relationships = result

                # Deduplicate entities by ID
                for entity in entities:
                    if entity.id not in all_entities:
                        all_entities[entity.id] = entity
                    else:
                        # Update confidence if new extraction has higher confidence
                        existing = all_entities[entity.id]
                        if entity.confidence > existing.confidence:
                            all_entities[entity.id] = entity

                # Deduplicate relationships by ID
                for rel in relationships:
                    if rel.id not in all_relationships:
                        all_relationships[rel.id] = rel

        return list(all_entities.values()), list(all_relationships.values())
