"""Contract tests for meta_intent_classifier.py"""
from pathlib import Path
import pytest
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from meta_intent_classifier import (
    MetaIntent,
    CronJobSpec,
    HarnessExtension,
    MetaDecision,
    MetaIntentClassifier,
    INTENT_PROMPT,
)


class TestMetaIntentClassifier:
    """Contract tests for meta_intent_classifier.py"""

    def test_meta_intent_enum_values(self):
        """MetaIntent enum should have all expected values."""
        expected = [
            "need_more_telemetry",
            "need_model_upgrade", 
            "need_harness_extension",
            "need_ci_fix",
            "need_perf_investigation",
            "need_data_hydration",
            "need_security_hardening",
            "stable"
        ]
        for val in expected:
            assert any(e.value == val for e in MetaIntent)

    def test_cron_job_spec_dataclass(self):
        """CronJobSpec should accept all fields."""
        job = CronJobSpec(
            name="test-job",
            schedule="0 * * * *",
            script="/path/to/script.py",
            args=["--arg", "value"],
            priority="high",
            reason="test reason"
        )
        assert job.name == "test-job"
        assert job.schedule == "0 * * * *"
        assert job.script == "/path/to/script.py"
        assert job.args == ["--arg", "value"]
        assert job.priority == "high"
        assert job.reason == "test reason"

    def test_harness_extension_dataclass(self):
        """HarnessExtension should accept all fields."""
        ext = HarnessExtension(
            file="scripts/new_check.py",
            description="Test check",
            category="latency_gap"
        )
        assert ext.file == "scripts/new_check.py"
        assert ext.description == "Test check"
        assert ext.category == "latency_gap"

    def test_meta_decision_dataclass(self):
        """MetaDecision should accept all fields."""
        decision = MetaDecision(
            primary_intent=MetaIntent.NEED_MORE_TELEMETRY,
            confidence=0.9,
            reasoning="Test reasoning",
            secondary_intents=[MetaIntent.STABLE],
            proposed_cron_jobs=[],
            harness_extensions=[]
        )
        assert decision.primary_intent == MetaIntent.NEED_MORE_TELEMETRY
        assert decision.confidence == 0.9
        assert decision.reasoning == "Test reasoning"
        assert len(decision.secondary_intents) == 1

    def test_intent_prompt_contains_all_intents(self):
        """INTENT_PROMPT should reference all intent types."""
        for intent in MetaIntent:
            assert intent.value.upper() in INTENT_PROMPT

    def test_classifier_initialization(self):
        """MetaIntentClassifier should initialize with defaults."""
        classifier = MetaIntentClassifier()
        assert classifier.mlx_url == "http://localhost:9001/v1/chat/completions"
        assert classifier.state_path.name == "meta_state.json"

    def test_gather_state_returns_dict(self):
        """gather_state should return dict with all expected keys."""
        classifier = MetaIntentClassifier()
        state = classifier.gather_state()
        
        assert isinstance(state, dict)
        required = ["effectiveness", "mlx_health", "synthetic_count", 
                   "telemetry_volume", "ci_health", "active_adapter",
                   "error_patterns", "retrains", "production"]
        for key in required:
            assert key in state

    def test_classify_without_mlx(self):
        """classify should return stable when MLX unavailable."""
        classifier = MetaIntentClassifier(mlx_url="http://invalid:9999")
        state = classifier.gather_state()
        decision = classifier.classify(state)
        
        # Should fall back to stable when MLX unreachable
        assert decision.primary_intent == MetaIntent.STABLE
        assert decision.confidence == 0.5

    def test_spawn_cron_job_script_not_found(self):
        """_spawn_cron_job should return False for missing script."""
        classifier = MetaIntentClassifier()
        job = CronJobSpec(
            name="test",
            schedule="0 * * * *",
            script="/nonexistent/script.py",
            args=[],
            priority="high",
            reason="test"
        )
        result = classifier._spawn_cron_job(job)
        assert result is False

    def test_create_harness_extension(self, temp_dir):
        """_create_harness_extension should create proposal file."""
        classifier = MetaIntentClassifier()
        ext = HarnessExtension(
            file="scripts/test_check.py",
            description="Test check",
            category="latency_gap"
        )
        # This would create in the project, skip for isolation
        pytest.skip("Creates files in project directory")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])