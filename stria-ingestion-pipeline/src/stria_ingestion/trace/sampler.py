"""
Trace sampling strategies.

Samplers decide whether a trace should be recorded and exported.
"""

from __future__ import annotations

import hashlib
import random
import time
from abc import ABC, abstractmethod
from threading import Lock
from typing import Any

from .span import TraceContext


class Sampler(ABC):
    """Base sampler interface."""

    @abstractmethod
    def should_sample(
        self,
        trace_id: str,
        parent_context: TraceContext | None,
        name: str,
        kind: str,
        attributes: dict[str, Any] | None = None,
    ) -> bool: ...

    @abstractmethod
    def get_description(self) -> str: ...


class AlwaysOnSampler(Sampler):
    """Sample all traces."""

    def should_sample(self, *args, **kwargs) -> bool:
        return True

    def get_description(self) -> str:
        return "AlwaysOnSampler"


class AlwaysOffSampler(Sampler):
    """Sample no traces."""

    def should_sample(self, *args, **kwargs) -> bool:
        return False

    def get_description(self) -> str:
        return "AlwaysOffSampler"


class ProbabilisticSampler(Sampler):
    """
    Sample a fixed percentage of traces.

    Uses trace_id for consistent sampling decisions across services.
    """

    def __init__(self, rate: float):
        if not 0 <= rate <= 1:
            raise ValueError("Rate must be between 0 and 1")
        self._rate = rate
        self._threshold = int(rate * 0xFFFFFFFFFFFFFFFF)

    def should_sample(
        self,
        trace_id: str,
        parent_context: TraceContext | None,
        name: str,
        kind: str,
        attributes: dict[str, Any] | None = None,
    ) -> bool:
        # If parent is sampled, always sample
        if parent_context and parent_context.is_sampled:
            return True

        # Deterministic sampling based on trace_id
        try:
            trace_id_int = int(trace_id, 16)
        except ValueError:
            # Fallback for non-hex trace IDs
            trace_id_int = int(hashlib.md5(trace_id.encode()).hexdigest(), 16)

        return (trace_id_int & 0xFFFFFFFFFFFFFFFF) < self._threshold

    def get_description(self) -> str:
        return f"ProbabilisticSampler(rate={self._rate})"


class RateLimitingSampler(Sampler):
    """
    Sample at most N traces per second.

    Uses token bucket algorithm for smooth rate limiting.
    """

    def __init__(self, max_traces_per_second: float):
        if max_traces_per_second <= 0:
            raise ValueError("Rate must be positive")
        self._rate = max_traces_per_second
        self._tokens = max_traces_per_second
        self._last_refill = time.monotonic()
        self._lock = Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._rate, self._tokens + elapsed * self._rate)
        self._last_refill = now

    def should_sample(
        self,
        trace_id: str,
        parent_context: TraceContext | None,
        name: str,
        kind: str,
        attributes: dict[str, Any] | None = None,
    ) -> bool:
        # If parent is sampled, always sample (don't count against rate)
        if parent_context and parent_context.is_sampled:
            return True

        with self._lock:
            self._refill()
            if self._tokens >= 1:
                self._tokens -= 1
                return True
            return False

    def get_description(self) -> str:
        return f"RateLimitingSampler(rate={self._rate}/sec)"


class ParentBasedSampler(Sampler):
    """
    Delegate sampling decision to parent context, fallback to child sampler.

    This is the recommended default for distributed tracing.
    """

    def __init__(self, root_sampler: Sampler):
        self._root_sampler = root_sampler

    def should_sample(
        self,
        trace_id: str,
        parent_context: TraceContext | None,
        name: str,
        kind: str,
        attributes: dict[str, Any] | None = None,
    ) -> bool:
        # Parent sampled -> sample
        if parent_context and parent_context.is_sampled:
            return True

        # Parent not sampled -> don't sample
        if parent_context and not parent_context.is_sampled:
            return False

        # No parent -> use root sampler
        return self._root_sampler.should_sample(
            trace_id, parent_context, name, kind, attributes
        )

    def get_description(self) -> str:
        return f"ParentBasedSampler(root={self._root_sampler.get_description()})"


# Convenience factory
def create_default_sampler(
    rate: float = 1.0,
    max_per_second: float | None = None,
) -> Sampler:
    """Create a production-ready sampler."""
    root: Sampler
    if max_per_second:
        root = RateLimitingSampler(max_per_second)
    else:
        root = ProbabilisticSampler(rate)
    return ParentBasedSampler(root)