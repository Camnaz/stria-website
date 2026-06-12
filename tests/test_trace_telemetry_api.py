"""Contract tests for trace_telemetry_api.py"""
import asyncio
import json
from pathlib import Path
import pytest
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from trace_telemetry_api import (
    TelemetryHandler,
    ensure_telemetry_log,
    generate_sample_telemetry,
    TELEMETRY_LOG,
    PORT,
    HOST,
)


class TestTraceTelemetryAPI:
    """Contract tests for trace_telemetry_api.py"""

    def test_imports_work(self):
        """All imports should work."""
        assert TelemetryHandler is not None
        assert ensure_telemetry_log is not None
        assert generate_sample_telemetry is not None

    def test_generate_sample_telemetry(self):
        """generate_sample_telemetry should return list of events."""
        events = generate_sample_telemetry(10)
        assert isinstance(events, list)
        assert len(events) == 10
        
        for event in events:
            assert "timestamp" in event
            assert "request_id" in event
            assert "user_id" in event
            assert "model" in event
            assert "latency_ms" in event
            assert "trace_metadata" in event
            assert event["trace_metadata"]["intent"] in [
                "potentially_malicious_or_unsafe",
                "business_sensitive_workflow"
            ]
            assert event["trace_metadata"]["risk_level"] in ["high", "low"]

    def test_ensure_telemetry_log_creates_file(self, temp_dir):
        """ensure_telemetry_log should create telemetry log file."""
        # Monkey-patch the path
        import trace_telemetry_api
        original_path = trace_telemetry_api.TELEMETRY_LOG
        test_path = temp_dir / "trace_telemetry.jsonl"
        trace_telemetry_api.TELEMETRY_LOG = test_path
        
        try:
            ensure_telemetry_log()
            assert test_path.exists()
            
            # Verify content
            lines = test_path.read_text().strip().split("\n")
            assert len(lines) == 500
            
            for line in lines:
                event = json.loads(line)
                assert "timestamp" in event
                assert "request_id" in event
        finally:
            trace_telemetry_api.TELEMETRY_LOG = original_path

    def test_constants_defined(self):
        """Constants should be defined."""
        assert isinstance(PORT, int)
        assert PORT == 3000
        assert isinstance(HOST, str)
        assert HOST == "127.0.0.1"
        assert isinstance(TELEMETRY_LOG, Path)

    @pytest.mark.asyncio
    async def test_telemetry_handler_structure(self):
        """TelemetryHandler should have required methods."""
        handler = TelemetryHandler
        assert hasattr(handler, "do_GET")
        assert hasattr(handler, "handle_recent_telemetry")
        assert hasattr(handler, "handle_health")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])