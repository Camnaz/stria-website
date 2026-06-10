"""
Stria Ingestion Pipeline - Trace Subsystem

Distributed tracing for pipeline observability.
Implements W3C TraceContext standard for interoperability.
"""

from .span import TraceSpan, TraceContext, SpanStatus, SpanKind
from .collector import TraceCollector, InMemoryTraceCollector, NoOpTraceCollector
from .propagation import TracePropagator, W3CPropagator, B3Propagator
from .sampler import Sampler, AlwaysOnSampler, AlwaysOffSampler, ProbabilisticSampler, RateLimitingSampler

__all__ = [
    "TraceSpan",
    "TraceContext",
    "SpanStatus",
    "SpanKind",
    "TraceCollector",
    "InMemoryTraceCollector",
    "NoOpTraceCollector",
    "TracePropagator",
    "W3CPropagator",
    "B3Propagator",
    "Sampler",
    "AlwaysOnSampler",
    "AlwaysOffSampler",
    "ProbabilisticSampler",
    "RateLimitingSampler",
]