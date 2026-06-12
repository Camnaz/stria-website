"""Pytest configuration and fixtures for MLX pipeline tests."""
import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Generator
import pytest

# Prevent multiprocessing issues
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test isolation."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield Path(tmp_dir)


@pytest.fixture
def mock_telemetry_data() -> list[dict]:
    """Sample telemetry data for testing."""
    return [
        {
            "timestamp": "2026-06-11T15:00:00Z",
            "request_id": "req_001",
            "user_id": "user_1",
            "session_id": "sess_1",
            "model": "gpt-4o",
            "endpoint": "/v1/chat/completions",
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "latency_ms": 500,
            "error": None,
            "trace_metadata": {
                "intent": "business_sensitive_workflow",
                "risk_level": "low"
            }
        }
    ]


@pytest.fixture
def mock_mlx_server():
    """Mock MLX server fixture - just a placeholder, real tests use actual server."""
    return "http://localhost:9001/v1/chat/completions"