"""
Stria Ingestion Pipeline - Core Domain Models

This module defines the fundamental types and interfaces that all
pipeline components depend on. No external dependencies here.
"""

from .models import *
from .interfaces import *
from .events import *

__all__ = [
    # Models
    "IngestionRecord",
    "RecordMetadata",
    "PipelineContext",
    "ProcessingResult",
    "TraceSpan",
    "TraceContext",
    # Interfaces
    "IngestionSource",
    "Transformer",
    "Validator",
    "StorageBackend",
    "TraceCollector",
    "PipelineStage",
    # Events
    "PipelineEvent",
    "EventType",
]