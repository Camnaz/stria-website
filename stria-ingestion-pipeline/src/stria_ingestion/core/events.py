"""
Event system for pipeline observability and coordination.

Events are emitted at key points in the pipeline lifecycle.
Consumers can subscribe for metrics, alerting, debugging, etc.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable
from uuid import uuid4

from .models import IngestionRecord, PipelineConfig, ProcessingResult, RecordMetadata


class EventType(Enum):
    """Pipeline event types."""

    # Lifecycle
    PIPELINE_STARTED = "pipeline.started"
    PIPELINE_STOPPED = "pipeline.stopped"
    PIPELINE_PAUSED = "pipeline.paused"
    PIPELINE_RESUMED = "pipeline.resumed"

    # Batch processing
    BATCH_FETCHED = "batch.fetched"
    BATCH_PROCESSING_STARTED = "batch.processing.started"
    BATCH_PROCESSING_COMPLETED = "batch.processing.completed"
    BATCH_PROCESSING_FAILED = "batch.processing.failed"

    # Stage events
    STAGE_STARTED = "stage.started"
    STAGE_COMPLETED = "stage.completed"
    STAGE_FAILED = "stage.failed"

    # Record events
    RECORD_RECEIVED = "record.received"
    RECORD_TRANSFORMED = "record.transformed"
    RECORD_VALIDATED = "record.validated"
    RECORD_ENRICHED = "record.enriched"
    RECORD_STORED = "record.stored"
    RECORD_FAILED = "record.failed"
    RECORD_DEAD_LETTERED = "record.dead_lettered"

    # Retry/backpressure
    RETRY_ATTEMPT = "retry.attempt"
    BACKPRESSURE_APPLIED = "backpressure.applied"
    BACKPRESSURE_RELEASED = "backpressure.released"

    # Health
    SOURCE_HEALTHY = "source.healthy"
    SOURCE_UNHEALTHY = "source.unhealthy"
    STORAGE_HEALTHY = "storage.healthy"
    STORAGE_UNHEALTHY = "storage.unhealthy"


@dataclass(frozen=True)
class PipelineEvent:
    """
    Immutable event emitted by the pipeline.

    All events carry correlation context for distributed tracing.
    """

    event_type: EventType
    pipeline_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    event_id: str = field(default_factory=lambda: str(uuid4()))
    correlation_id: str | None = None
    causation_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    tags: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_record(
        cls,
        event_type: EventType,
        record: IngestionRecord,
        pipeline_id: str,
        **extra_payload: Any,
    ) -> PipelineEvent:
        return cls(
            event_type=event_type,
            pipeline_id=pipeline_id,
            correlation_id=record.metadata.correlation_id,
            causation_id=record.metadata.causation_id,
            payload={"record": record, **extra_payload},
        )

    @classmethod
    def from_batch(
        cls,
        event_type: EventType,
        records: list[IngestionRecord],
        pipeline_id: str,
        result: ProcessingResult | None = None,
        **extra_payload: Any,
    ) -> PipelineEvent:
        corr_id = records[0].metadata.correlation_id if records else None
        return cls(
            event_type=event_type,
            pipeline_id=pipeline_id,
            correlation_id=corr_id,
            payload={
                "record_count": len(records),
                "result": result,
                **extra_payload,
            },
        )


# Event handler type
EventHandler = Callable[[PipelineEvent], Any]


class EventBus:
    """
    Simple synchronous event bus for pipeline events.

    For high-throughput async use, substitute with a proper message bus.
    """

    def __init__(self):
        self._subscribers: dict[EventType, list[EventHandler]] = {}
        self._wildcard: list[EventHandler] = []

    def subscribe(self, event_type: EventType, handler: EventHandler) -> None:
        self._subscribers.setdefault(event_type, []).append(handler)

    def subscribe_all(self, handler: EventHandler) -> None:
        self._wildcard.append(handler)

    def unsubscribe(self, event_type: EventType, handler: EventHandler) -> None:
        if event_type in self._subscribers:
            self._subscribers[event_type].remove(handler)

    def emit(self, event: PipelineEvent) -> None:
        # Specific subscribers
        for handler in self._subscribers.get(event.event_type, []):
            try:
                handler(event)
            except Exception:
                # Don't let handler errors break pipeline
                pass

        # Wildcard subscribers
        for handler in self._wildcard:
            try:
                handler(event)
            except Exception:
                pass

    async def emit_async(self, event: PipelineEvent) -> None:
        """Async emit - runs handlers in parallel if they're coroutines."""
        import asyncio

        handlers = self._subscribers.get(event.event_type, []) + self._wildcard
        if not handlers:
            return

        coros = []
        for h in handlers:
            try:
                result = h(event)
                if asyncio.iscoroutine(result):
                    coros.append(result)
            except Exception:
                pass

        if coros:
            await asyncio.gather(*coros, return_exceptions=True)


# Global event bus instance
event_bus = EventBus()