"""
Trace context propagation utilities.

Supports W3C TraceContext (standard) and B3 (Zipkin) formats.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .span import TraceContext


class TracePropagator(ABC):
    """Abstract base for trace context propagators."""

    @property
    @abstractmethod
    def header_names(self) -> list[str]: ...

    @abstractmethod
    def inject(self, context: TraceContext, carrier: dict[str, str]) -> None: ...

    @abstractmethod
    def extract(self, carrier: dict[str, str]) -> TraceContext | None: ...


class W3CPropagator(TracePropagator):
    """
    W3C TraceContext propagator.

    Headers:
    - traceparent: version-trace-id-parent-id-flags
    - tracestate: vendor-specific state
    """

    HEADER_TRACEPARENT = "traceparent"
    HEADER_TRACESTATE = "tracestate"

    @property
    def header_names(self) -> list[str]:
        return [self.HEADER_TRACEPARENT, self.HEADER_TRACESTATE]

    def inject(self, context: TraceContext, carrier: dict[str, str]) -> None:
        carrier[self.HEADER_TRACEPARENT] = context.to_traceparent()
        if context.trace_state:
            carrier[self.HEADER_TRACESTATE] = context.trace_state

    def extract(self, carrier: dict[str, str]) -> TraceContext | None:
        traceparent = carrier.get(self.HEADER_TRACEPARENT)
        if not traceparent:
            return None
        tracestate = carrier.get(self.HEADER_TRACESTATE)
        return TraceContext.from_headers(traceparent, tracestate)


class B3Propagator(TracePropagator):
    """
    B3 (Zipkin) propagator.

    Headers:
    - X-B3-TraceId
    - X-B3-SpanId
    - X-B3-Sampled (1/0/d)
    - X-B3-Flags (1=debug)
    """

    HEADER_TRACE_ID = "x-b3-traceid"
    HEADER_SPAN_ID = "x-b3-spanid"
    HEADER_SAMPLED = "x-b3-sampled"
    HEADER_FLAGS = "x-b3-flags"

    @property
    def header_names(self) -> list[str]:
        return [
            self.HEADER_TRACE_ID,
            self.HEADER_SPAN_ID,
            self.HEADER_SAMPLED,
            self.HEADER_FLAGS,
        ]

    def inject(self, context: TraceContext, carrier: dict[str, str]) -> None:
        carrier[self.HEADER_TRACE_ID] = context.trace_id
        carrier[self.HEADER_SPAN_ID] = context.span_id
        carrier[self.HEADER_SAMPLED] = "1" if context.is_sampled else "0"

    def extract(self, carrier: dict[str, str]) -> TraceContext | None:
        trace_id = carrier.get(self.HEADER_TRACE_ID)
        span_id = carrier.get(self.HEADER_SPAN_ID)
        if not trace_id or not span_id:
            return None

        sampled = carrier.get(self.HEADER_SAMPLED, "0") == "1"
        return TraceContext(
            trace_id=trace_id,
            span_id=span_id,
            trace_flags=1 if sampled else 0,
        )


class MultiPropagator(TracePropagator):
    """Tries multiple propagators in order."""

    def __init__(self, *propagators: TracePropagator):
        self._propagators = propagators

    @property
    def header_names(self) -> list[str]:
        names = []
        for p in self._propagators:
            names.extend(p.header_names)
        return list(dict.fromkeys(names))  # deduplicate preserving order

    def inject(self, context: TraceContext, carrier: dict[str, str]) -> None:
        for p in self._propagators:
            p.inject(context, carrier)

    def extract(self, carrier: dict[str, str]) -> TraceContext | None:
        for p in self._propagators:
            ctx = p.extract(carrier)
            if ctx:
                return ctx
        return None


# Default propagator supporting both W3C and B3
DEFAULT_PROPAGATOR = MultiPropagator(W3CPropagator(), B3Propagator())