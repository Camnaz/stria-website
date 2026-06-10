"""
Core protocol interfaces for the ingestion pipeline.

These define the contracts that all implementations must satisfy.
Using Python protocols for structural subtyping.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import AsyncIterator, Iterator
from typing import Any, Generic, Protocol, TypeVar

from .models import (
    IngestionRecord,
    PipelineConfig,
    PipelineContext,
    ProcessingResult,
    RecordMetadata,
    TraceSpan,
    TraceContext,
    ValidationIssue,
    ValidationSeverity,
)

T = TypeVar("T")
R = TypeVar("R")


class IngestionSource(Protocol[T]):
    """
    Protocol for data sources that produce records.

    Implementations: HTTP API poller, Kafka consumer, DB CDC, file watcher, etc.
    """

    @property
    def source_id(self) -> str: ...

    @property
    def source_type(self) -> str: ...

    async def fetch_batch(self, batch_size: int) -> list[IngestionRecord[T]]:
        """Fetch a batch of records from the source."""
        ...

    async def acknowledge(self, records: list[IngestionRecord[T]]) -> None:
        """Acknowledge successful processing (e.g., commit Kafka offsets)."""
        ...

    async def negative_acknowledge(
        self, records: list[IngestionRecord[T]], error: Exception
    ) -> None:
        """Handle failed records (e.g., retry, dead letter)."""
        ...

    async def health_check(self) -> bool:
        """Check if source is healthy and reachable."""
        ...

    async def close(self) -> None:
        """Clean up resources."""
        ...


class Transformer(Protocol[T, R]):
    """
    Protocol for transforming record payloads.

    Transformers are pure functions with no side effects.
    """

    @property
    def name(self) -> str: ...

    @property
    def input_type(self) -> type[T]: ...

    @property
    def output_type(self) -> type[R]: ...

    async def transform(self, record: IngestionRecord[T], ctx: PipelineContext) -> IngestionRecord[R]:
        """Transform a single record. Returns new record with transformed payload."""
        ...

    async def transform_batch(
        self, records: list[IngestionRecord[T]], ctx: PipelineContext
    ) -> list[IngestionRecord[R]]:
        """Transform a batch. Default: sequential. Override for vectorized ops."""
        results = []
        for r in records:
            results.append(await self.transform(r, ctx))
        return results


class Validator(Protocol[T]):
    """
    Protocol for validating record payloads.

    Validators return a list of issues. Pipeline decides pass/fail based on mode.
    """

    @property
    def name(self) -> str: ...

    @property
    def schema_version(self) -> str: ...

    async def validate(self, record: IngestionRecord[T], ctx: PipelineContext) -> list[ValidationIssue]:
        """Validate a record. Returns list of issues (empty = valid)."""
        ...

    async def validate_batch(
        self, records: list[IngestionRecord[T]], ctx: PipelineContext
    ) -> list[list[ValidationIssue]]:
        """Validate a batch. Default: sequential."""
        return [await self.validate(r, ctx) for r in records]


class StorageBackend(Protocol[T]):
    """
    Protocol for persisting processed records.

    Implementations: PostgreSQL, ClickHouse, S3/Parquet, Elasticsearch, etc.
    """

    @property
    def backend_id(self) -> str: ...

    @property
    def backend_type(self) -> str: ...

    async def write(self, records: list[IngestionRecord[T]], ctx: PipelineContext) -> ProcessingResult:
        """Write a batch of records. Returns processing result."""
        ...

    async def write_one(self, record: IngestionRecord[T], ctx: PipelineContext) -> ProcessingResult:
        """Write a single record. Default: batch of 1."""
        return await self.write([record], ctx)

    async def health_check(self) -> bool: ...

    async def close(self) -> None: ...


class TraceCollector(Protocol):
    """
    Protocol for collecting distributed traces.

    Implementations: Jaeger, Zipkin, OTel, custom backend, in-memory for tests.
    """

    @property
    def collector_id(self) -> str: ...

    @property
    def collector_type(self) -> str: ...

    def start_span(
        self,
        name: str,
        context: TraceContext | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> TraceSpan: ...

    def end_span(self, span: TraceSpan) -> None: ...

    def add_event(
        self, span: TraceSpan, name: str, attributes: dict[str, Any] | None = None
    ) -> None: ...

    def set_attribute(self, span: TraceSpan, key: str, value: Any) -> None: ...

    def record_exception(self, span: TraceSpan, exc: Exception) -> None: ...

    async def flush(self) -> None: ...

    async def close(self) -> None: ...


class PipelineStage(Protocol[T]):
    """
    Protocol for a single pipeline stage.

    Stages are composable units: Source -> Transform* -> Validate* -> Store
    """

    @property
    def name(self) -> str: ...

    @property
    def stage_type(self) -> StageType: ...

    async def process(
        self, records: list[IngestionRecord[T]], ctx: PipelineContext
    ) -> list[IngestionRecord[T]]:
        """Process a batch of records through this stage."""
        ...

    async def setup(self, ctx: PipelineContext) -> None:
        """One-time setup before processing begins."""
        ...

    async def teardown(self, ctx: PipelineContext) -> None:
        """Cleanup after processing ends."""
        ...


class StageType(Enum):
    SOURCE = "source"
    TRANSFORM = "transform"
    VALIDATE = "validate"
    ENRICH = "enrich"
    STORE = "store"
    SINK = "sink"


class DeadLetterHandler(Protocol[T]):
    """Protocol for handling records that fail permanently."""

    async def handle(
        self, records: list[IngestionRecord[T]], ctx: PipelineContext, error: Exception
    ) -> ProcessingResult: ...


class Enricher(Protocol[T]):
    """Protocol for enriching records with external data."""

    @property
    def name(self) -> str: ...

    async def enrich(self, record: IngestionRecord[T], ctx: PipelineContext) -> IngestionRecord[T]: ...

    async def enrich_batch(
        self, records: list[IngestionRecord[T]], ctx: PipelineContext
    ) -> list[IngestionRecord[T]]: ...