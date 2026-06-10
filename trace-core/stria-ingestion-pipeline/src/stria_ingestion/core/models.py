"""
Core data models for the ingestion pipeline.

These are the canonical types that flow through the system.
All adapters, transformers, and storage backends operate on these.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class RecordStatus(Enum):
    """Lifecycle status of an ingestion record."""

    PENDING = "pending"
    PROCESSING = "processing"
    VALIDATED = "validated"
    ENRICHED = "enriched"
    STORED = "stored"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


class ValidationSeverity(Enum):
    """Severity of validation issues."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass(frozen=True)
class RecordMetadata:
    """Immutable metadata attached to every ingestion record."""

    source_id: str
    source_type: str  # "http", "kafka", "database", "file", etc.
    ingestion_timestamp: datetime = field(default_factory=datetime.utcnow)
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    causation_id: str | None = None  # For linking to parent records
    partition_key: str | None = None
    sequence_number: int | None = None
    schema_version: str = "1.0"
    tags: dict[str, str] = field(default_factory=dict)

    def with_causation(self, parent: RecordMetadata) -> RecordMetadata:
        """Create new metadata with causation link to parent."""
        return RecordMetadata(
            source_id=self.source_id,
            source_type=self.source_type,
            ingestion_timestamp=self.ingestion_timestamp,
            correlation_id=parent.correlation_id,
            causation_id=parent.correlation_id,
            partition_key=self.partition_key,
            sequence_number=self.sequence_number,
            schema_version=self.schema_version,
            tags=self.tags,
        )


@dataclass
class IngestionRecord(Generic[T]):
    """
    The fundamental unit of data flowing through the pipeline.

    Generic over payload type T to allow type-safe transformation stages.
    """

    payload: T
    metadata: RecordMetadata
    status: RecordStatus = RecordStatus.PENDING
    validation_errors: list[ValidationIssue] = field(default_factory=list)
    enrichment_data: dict[str, Any] = field(default_factory=dict)
    trace_spans: list[TraceSpan] = field(default_factory=list)
    retry_count: int = 0
    last_error: str | None = None

    def add_validation_error(self, issue: ValidationIssue) -> None:
        self.validation_errors.append(issue)
        if issue.severity in (ValidationSeverity.ERROR, ValidationSeverity.CRITICAL):
            self.status = RecordStatus.FAILED

    def mark_processing(self) -> None:
        self.status = RecordStatus.PROCESSING

    def mark_validated(self) -> None:
        if self.status != RecordStatus.FAILED:
            self.status = RecordStatus.VALIDATED

    def mark_enriched(self) -> None:
        self.status = RecordStatus.ENRICHED

    def mark_stored(self) -> None:
        self.status = RecordStatus.STORED

    def mark_failed(self, error: str) -> None:
        self.status = RecordStatus.FAILED
        self.last_error = error
        self.retry_count += 1


@dataclass(frozen=True)
class ValidationIssue:
    """A single validation finding."""

    field_path: str
    message: str
    severity: ValidationSeverity
    code: str
    expected: Any | None = None
    actual: Any | None = None


@dataclass
class PipelineContext:
    """
    Execution context passed through all pipeline stages.

    Carries configuration, shared clients, and runtime state.
    """

    config: PipelineConfig
    trace_collector: TraceCollector | None = None
    metrics: MetricsCollector | None = None
    runtime: dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        return self.runtime.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self.runtime[key] = value


@dataclass(frozen=True)
class PipelineConfig:
    """Pipeline-wide configuration."""

    pipeline_id: str
    max_retries: int = 3
    retry_backoff_base: float = 1.0
    batch_size: int = 100
    flush_interval_seconds: float = 5.0
    dead_letter_queue: str | None = None
    enable_tracing: bool = True
    trace_sample_rate: float = 1.0
    validation_mode: ValidationMode = ValidationMode.STRICT


class ValidationMode(Enum):
    STRICT = "strict"  # Fail on any ERROR/CRITICAL
    LENIENT = "lenient"  # Only fail on CRITICAL
    PERMISSIVE = "permissive"  # Log only, never fail


@dataclass
class ProcessingResult:
    """Result of processing a batch of records."""

    processed: int = 0
    succeeded: int = 0
    failed: int = 0
    dead_lettered: int = 0
    errors: list[tuple[IngestionRecord, Exception]] = field(default_factory=list)
    latency_ms: float = 0.0

    @property
    def success_rate(self) -> float:
        if self.processed == 0:
            return 1.0
        return self.succeeded / self.processed


# Metrics placeholder - implemented in observability module
class MetricsCollector:
    def increment(self, name: str, tags: dict[str, str] | None = None) -> None: ...
    def histogram(self, name: str, value: float, tags: dict[str, str] | None = None) -> None: ...
    def gauge(self, name: str, value: float, tags: dict[str, str] | None = None) -> None: ...