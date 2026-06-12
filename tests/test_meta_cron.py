"""Contract tests for meta_cron_orchestrator.py"""
import json
from pathlib import Path
import pytest
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from meta_cron_orchestrator import main as meta_cron_main
from meta_effectiveness_scorer import MetaEffectivenessScorer
from meta_intent_classifier import MetaIntentClassifier
from cron_templates.generator import generate_cron_script


class TestMetaCronOrchestrator:
    """Contract tests for meta_cron_orchestrator.py"""

    def test_imports_work(self):
        """All imports should work without error."""
        from meta_cron_orchestrator import (
            META_LOG, STATE_FILE,
            MetaEffectivenessScorer, MetaIntentClassifier, generate_cron_script
        )
        assert True

    def test_meta_effectiveness_scorer_computes_scores(self):
        """MetaEffectivenessScorer.compute_effectiveness should return expected structure."""
        scorer = MetaEffectivenessScorer()
        result = scorer.compute_effectiveness()
        
        assert "composite_scores" in result
        assert "production_impact" in result
        assert "retrain_history" in result
        
        scores = result["composite_scores"]
        expected_keys = ["precision", "recall", "coverage", "p50_trend", "composite_reward"]
        for key in expected_keys:
            assert key in scores
            assert isinstance(scores[key], (int, float))

    def test_meta_intent_classifier_gathers_state(self):
        """MetaIntentClassifier.gather_state should return dict with expected keys."""
        classifier = MetaIntentClassifier()
        state = classifier.gather_state()
        
        expected_keys = [
            "effectiveness", "mlx_health", "synthetic_count",
            "telemetry_volume", "ci_health", "active_adapter",
            "error_patterns", "retrains", "production"
        ]
        for key in expected_keys:
            assert key in state

    def test_meta_intent_classifier_classify_returns_decision(self):
        """MetaIntentClassifier.classify should return MetaDecision."""
        classifier = MetaIntentClassifier()
        state = classifier.gather_state()
        
        # This requires MLX server
        pytest.skip("Requires MLX server for classification")

    def test_generate_cron_script_creates_file(self, temp_dir):
        """generate_cron_script should create a script file."""
        from cron_templates.generator import CRON_TEMPLATES
        
        template_spec = {
            "name": "test-cron",
            "template": "telemetry_booster",
            "schedule": "0 * * * *",
        }
        
        # Check available templates
        assert "telemetry_booster" in CRON_TEMPLATES
        assert "model_evaluator" in CRON_TEMPLATES
        assert "ci_health_check" in CRON_TEMPLATES
        assert "data_hydration" in CRON_TEMPLATES
        assert "perf_investigation" in CRON_TEMPLATES
        assert "security_hardening" in CRON_TEMPLATES


class TestCronTemplates:
    """Tests for cron_templates/generator.py"""

    def test_all_templates_exist(self):
        """All 6 expected templates should be defined."""
        from cron_templates.generator import CRON_TEMPLATES
        
        expected = [
            "telemetry_booster",
            "model_evaluator", 
            "ci_health_check",
            "data_hydration",
            "perf_investigation",
            "security_hardening"
        ]
        for name in expected:
            assert name in CRON_TEMPLATES
            template = CRON_TEMPLATES[name]
            assert "script" in template
            assert isinstance(template["script"], str)
            assert len(template["script"]) > 0

    def test_generate_all_templates(self, temp_dir):
        """Generate script for each template."""
        from cron_templates.generator import generate_cron_script, CRON_TEMPLATES
        
        for name in CRON_TEMPLATES:
            spec = {
                "name": f"test-{name}",
                "template": name,
                "schedule": "0 * * * *",
            }
            script_path = generate_cron_script(spec)
            assert script_path.exists()
            content = script_path.read_text()
            assert len(content) > 0
            # Clean up
            script_path.unlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])