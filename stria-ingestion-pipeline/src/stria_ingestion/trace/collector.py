"""
Trace collector implementations.

Provides:
- InMemoryTraceCollector: for testing and development
- NoOpTraceCollector: for production when tracing disabled
- Base class for custom exporters (OTel, Jaeger, Zipkin, etc.)
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass
from typing import Any

from .span import TraceSpan, TraceContext, SpanKind, SpanStatus


class TraceCollector(ABC):
    """Abstract base for trace collectors."""

    @property
    @abstractmethod
    def collector_id(self) -> str: ...

    @property
    @abstractmethod
    def collector_type(self) -> str: ...

    @abstractmethod
    def start_span(
        self,
        name: str,
        context: TraceContext | None = None,
        attributes: dict[str, Any] | None = None,
        kind: SpanKind = SpanKind.INTERNAL,
    ) -> TraceSpan: ...

    @abstractmethod
    def end_span(self, span: TraceSpan) -> None: ...

    @abstractmethod
    def add_event(
        self, span: TraceSpan, name: str, attributes: dict[str, Any] | None = None
    ) -> None: ...

    @abstractmethod
    def set_attribute(self, span: TraceSpan, key: str, value: Any) -> None: ...

    @abstractmethod
    def record_exception(self, span: TraceSpan, exc: Exception) -> None: ...

    @abstractmethod
    async def flush(self) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...


class InMemoryTraceCollector(TraceCollector):
    """
    In-memory trace collector for testing and development.

    Stores spans in memory with configurable retention.
    """

    def __init__(self, max_spans: int = 10000, enable_console_export: bool = False):
        self._spans: deque[TraceSpan] = deque(maxlen=max_spans)
        self._max_spans = max_spans
        self._enable_console_export = enable_console_export
        self._lock = asyncio.Lock()
        self._closed = False

    @property
    def collector_id(self) -> str:
        return "in-memory"

    @property
    def collector_type(self) -> str:
        return "in_memory"

    def start_span(
        self,
        name: str,
        context: TraceContext | None = None,
        attributes: dict[str, Any] | None = None,
        kind: SpanKind = SpanKind.INTERNAL,
    ) -> TraceSpan:
        if self._closed:
            raise RuntimeError("Collector is closed")

        ctx = context or TraceContext.new()
        span = TraceSpan(
            name=name,
            context=ctx,
            kind=kind,
            attributes=attributes or {},
        )
        return span

    def end_span(self, span: TraceSpan) -> None:
        if span.end_time_ns is None:
            span.end(SpanStatus.OK)
        # Store completed span
        self._spans.append(span)

        if self._enable_console_export:
            print(f"[TRACE] {span.name} ({span.duration_ms:.2f}ms) {span.status.value}")

    def add_event(
        self, span: TraceSpan, name: str, attributes: dict[str, Any] | None = None
    ) -> None:
        span.add_event(name, attributes)

    def set_attribute(self, span: TraceSpan, key: str, value: Any) -> None:
        span.set_attribute(key, value)

    def record_exception(self, span: TraceSpan, exc: Exception) -> None:
        span.record_exception(exc)

    async def flush(self) -> None:
        # In-memory has nothing to flush
        pass

    async def close(self) -> None:
        self._closed = True

    def get_spans(self, limit: int | None = None) -> list[TraceSpan]:
        """Get collected spans (newest first)."""
        spans = list(self._spans)
        if limit:
            spans = spans[-limit:]
        return spans

    def clear(self) -> None:
        """Clear collected spans."""
        self._spans.clear()

    def get_spans_by_trace(self, trace_id: str) -> list[TraceSpan]:
        """Get all spans for a trace ID."""
        return [s for s in self._spans if s.context.trace_id == trace_id]


class NoOpTraceCollector(TraceCollector):
    """No-op collector when tracing is disabled."""

    _instance: NoOpTraceCollector | None = None

    def __new__(cls) -> NoOpTraceCollector:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized"):
            return
        self._initialized = True

    @property
    def collector_id(self) -> str:
        return "noop"

    @property
    def collector_type(self) -> str:
        return "noop"

    def start_span(self, name: str, context: TraceContext | None = None, **kwargs) -> TraceSpan:
        # Return a minimal span that does nothing
        ctx = context or TraceContext.new(sampled=False)
        return TraceSpan(name=name, context=ctx)

    def end_span(self, span: TraceSpan) -> None:
        pass

    def add_event(self, span: TraceSpan, name: str, attributes: dict[str, Any] | None = None) -> None:
        pass

    def set_attribute(self, span: TraceSpan, key: str, value: Any) -> None:
        pass

    def record_exception(self, span: TraceSpan, exc: Exception) -> None:
        pass

    async def flush(self) -> None:
        pass

    async def close(self) -> None:
        pass


class CompositeTraceCollector(TraceCollector):
    """Forwards to multiple collectors."""

    def __init__(self, *collectors: TraceCollector):
        self._collectors = collectors

    @property
    def collector_id(self) -> str:
        return "composite"

    @property
    def collector_type(self) -> str:
        return "composite"

    def start_span(self, name: str, context: TraceContext | None = None, **kwargs) -> TraceSpan:
        # Use first collector to create span
        return self._collectors[0].start_span(name, context, **kwargs)

    def end_span(self, span: TraceSpan) -> None:
        for c in self._collectors:
            c.end_span(span)

    def add_event(self, span: TraceSpan, name: str, attributes: dict[str, Any] | None = None) -> None:
        for c in self._collectors:
            c.add_event(span, name, attributes)

    def set_attribute(self, span: TraceSpan, key: str, value: Any) -> None:
        for c in self._collectors:
            c.set_attribute(span, key, value)

    def record_exception(self, span: TraceSpan, exc: Exception) -> None:
        for c in self._collectors:
            c.record_exception(span, exc)

    async def flush(self) -> None:
        await asyncio.gather(*[c.flush() for c in self._collectors])

    async def close(self) -> None:
        await asyncio.gather(*[c.close() for c in self._collectors])