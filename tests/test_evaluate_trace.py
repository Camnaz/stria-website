"""Contract tests for evaluate_trace.py"""
import asyncio
import json
from pathlib import Path
import pytest
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from evaluate_trace import (
    fetch_recent_telemetry,
    ask_mlx_server,
    append_to_continuous_learning,
    check_retrain_threshold,
    trigger_retrain,
    hot_swap_model,
    RETRAIN_THRESHOLD,
)


class TestEvaluateTrace:
    """Contract tests for evaluate_trace.py public API."""

    def test_fetch_recent_telemetry_returns_list(self, mock_telemetry_data):
        """fetch_recent_telemetry should return a list."""
        result = fetch_recent_telemetry(minutes=60)
        assert isinstance(result, list)

    def test_ask_mlx_server_returns_dict(self):
        """ask_mlx_server should return a dict with expected keys."""
        # This test requires MLX server to be running
        # Skip if server not available
        pytest.skip("Requires MLX server running")

    def test_append_to_continuous_learning_increments_count(self, temp_dir, mock_telemetry_data):
        """append_to_continuous_learning should write entry and return count."""
        import evaluate_trace
        # Monkey-patch the path
        original_path = evaluate_trace.CONTINUOUS_LEARNING_PATH
        test_path = temp_dir / "continuous_learning.jsonl"
        evaluate_trace.CONTINUOUS_LEARNING_PATH = test_path
        
        try:
            count = append_to_continuous_learning(mock_telemetry_data, {"latency_gaps": [], "insights": []})
            assert count >= 1
            # Verify file was written
            assert test_path.exists()
            content = test_path.read_text()
            assert "continuous_learning" in content or "mock_telemetry" in content
        finally:
            evaluate_trace.CONTINUOUS_LEARNING_PATH = original_path

    def test_check_retrain_threshold_returns_bool(self, temp_dir):
        """check_retrain_threshold should return boolean."""
        import evaluate_trace
        original_path = evaluate_trace.CONTINUOUS_LEARNING_PATH
        test_path = temp_dir / "continuous_learning.jsonl"
        evaluate_trace.CONTINUOUS_LEARNING_PATH = test_path
        
        try:
            # Empty file should return False
            test_path.write_text("")
            assert check_retrain_threshold() is False
            
            # Write threshold number of entries
            for i in range(RETRAIN_THRESHOLD):
                test_path.write_text(test_path.read_text() + '{"test": true}\n')
            
            assert check_retrain_threshold() is True
        finally:
            evaluate_trace.CONTINUOUS_LEARNING_PATH = original_path

    def test_trigger_retrain_returns_bool(self):
        """trigger_retrain should return boolean (may fail if no training env)."""
        # This requires full training environment
        pytest.skip("Requires full training environment")

    def test_hot_swap_model_returns_bool(self):
        """hot_swap_model should return boolean."""
        result = hot_swap_model()
        assert isinstance(result, bool)


class TestEvaluateTraceIntegration:
    """Integration tests requiring MLX server."""

    @pytest.mark.integration
    def test_full_flywheel_cycle(self):
        """Test full evaluate_trace -> continuous learning -> retrain cycle."""
        pytest.skip("Requires full environment")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])