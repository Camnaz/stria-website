"""
Trace span and context models.

Implements W3C TraceContext specification:
- traceparent: version-trace-id-parent-id-flags
- tracestate: vendor-specific state
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SpanStatus(Enum):
    """Span status per OpenTelemetry spec."""

    UNSET = "unset"
    OK = "ok"
    ERROR = "error"


class SpanKind(Enum):
    """Span kind per OpenTelemetry spec."""

    INTERNAL = "internal"
    SERVER = "server"
    CLIENT = "client"
    PRODUCER = "producer"
    CONSUMER = "consumer"


@dataclass(frozen=True)
class TraceContext:
    """
    Immutable trace context for propagation.

    Contains the minimal identifiers needed for distributed tracing.
    """

    trace_id: str
    span_id: str
    trace_flags: int = 1  # Bit 0 = sampled (1) or not (0)
    trace_state: str | None = None

    @classmethod
    def new(cls, sampled: bool = True) -> TraceContext:
        """Create a new root trace context."""
        return cls(
            trace_id=uuid.uuid4().hex,
            span_id=cls._generate_span_id(),
            trace_flags=1 if sampled else 0,
        )

    @classmethod
    def child_of(cls, parent: TraceContext) -> TraceContext:
        """Create a child trace context."""
        return cls(
            trace_id=parent.trace_id,
            span_id=cls._generate_span_id(),
            trace_flags=parent.trace_flags,
            trace_state=parent.trace_state,
        )

    @classmethod
    def from_headers(cls, traceparent: str, tracestate: str | None = None) -> TraceContext | None:
        """Parse W3C traceparent header."""
        try:
            parts = traceparent.split("-")
            if len(parts) != 4:
                return None
            version, trace_id, span_id, flags = parts
            if version != "00":
                return None
            return cls(
                trace_id=trace_id,
                span_id=span_id,
                trace_flags=int(flags, 16),
                trace_state=tracestate,
            )
        except Exception:
            return None

    def to_traceparent(self) -> str:
        """Serialize to W3C traceparent header."""
        return f"00-{self.trace_id}-{self.span_id}-{self.trace_flags:02x}"

    @staticmethod
    def _generate_span_id() -> str:
        return uuid.uuid4().hex[:16]

    @property
    def is_sampled(self) -> bool:
        return (self.trace_flags & 0x01) == 1


@dataclass
class TraceSpan:
    """
    A single span in a distributed trace.

    Spans are created by TraceCollector.start_span() and ended by
    TraceCollector.end_span(). They are not thread-safe.
    """

    name: str
    context: TraceContext
    kind: SpanKind = SpanKind.INTERNAL
    start_time_ns: int = field(default_factory=lambda: time.time_ns())
    end_time_ns: int | None = None
    status: SpanStatus = SpanStatus.UNSET
    attributes: dict[str, Any] = field(default_factory=dict)
    events: list[SpanEvent] = field(default_factory=list)
    links: list[SpanLink] = field(default_factory=list)
    parent_span_id: str | None = None

    def end(self, status: SpanStatus = SpanStatus.OK) -> None:
        """Mark span as ended."""
        self.end_time_ns = time.time_ns()
        self.status = status

    def add_event(self, name: str, attributes: dict[str, Any] | None = None) -> None:
        """Add an event to this span."""
        self.events.append(SpanEvent(name=name, attributes=attributes or {}))

    def set_attribute(self, key: str, value: Any) -> None:
        """Set a span attribute."""
        self.attributes[key] = value

    def record_exception(self, exc: Exception) -> None:
        """Record an exception on this span."""
        self.status = SpanStatus.ERROR
        self.set_attribute("exception.type", type(exc).__name__)
        self.set_attribute("exception.message", str(exc))
        # Could add stack trace here

    @property
    def duration_ns(self) -> int | None:
        if self.end_time_ns is None:
            return None
        return self.end_time_ns - self.start_time_ns

    @property
    def duration_ms(self) -> float | None:
        d = self.duration_ns
        return d / 1_000_000 if d is not None else None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for export."""
        return {
            "name": self.name,
            "trace_id": self.context.trace_id,
            "span_id": self.context.span_id,
            "parent_span_id": self.parent_span_id,
            "kind": self.kind.value,
            "start_time_ns": self.start_time_ns,
            "end_time_ns": self.end_time_ns,
            "duration_ns": self.duration_ns,
            "status": self.status.value,
            "attributes": self.attributes,
            "events": [e.to_dict() for e in self.events],
            "links": [l.to_dict() for l in self.links],
        }


@dataclass(frozen=True)
class SpanEvent:
    """An event within a span (annotation)."""

    name: str
    timestamp_ns: int = field(default_factory=lambda: time.time_ns())
    attributes: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "timestamp_ns": self.timestamp_ns,
            "attributes": self.attributes,
        }


@dataclass(frozen=True)
class SpanLink:
    """A link to another span (for non-parent-child relationships)."""

    trace_id: str
    span_id: str
    attributes: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "attributes": self.attributes,
        }