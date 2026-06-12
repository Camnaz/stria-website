"""Contract tests for meta_rl_trainer.py"""
import numpy as np
from pathlib import Path
import pytest
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from meta_rl_trainer import (
    Experience,
    MetaPolicy,
    build_state_vector,
    load_experiences_from_decisions,
    load_experiences_from_orchestrator,
    train_policy,
    infer_action,
    INTENTS,
)


class TestMetaRLTrainer:
    """Contract tests for meta_rl_trainer.py"""

    def test_imports_work(self):
        """All imports should work."""
        assert Experience is not None
        assert MetaPolicy is not None
        assert INTENTS is not None

    def test_intents_list(self):
        """INTENTS should have 8 entries matching MetaIntent enum."""
        assert len(INTENTS) == 8
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
        assert INTENTS == expected

    def test_build_state_vector_returns_array(self):
        """build_state_vector should return numpy array of correct shape."""
        meta_state = {
            "effectiveness_scores": {
                "precision": 0.8,
                "recall": 0.7,
                "coverage": 0.9,
                "p50_trend": 0.1,
                "composite_reward": 0.5
            }
        }
        state = build_state_vector(meta_state)
        assert isinstance(state, np.ndarray)
        assert state.shape == (10,)  # 10 dims as per docstring

    def test_load_experiences_from_decisions_returns_list(self, temp_dir):
        """load_experiences_from_decisions should return list of Experience."""
        # Create mock decisions log
        log_path = temp_dir / "meta_decisions.jsonl"
        decisions = [
            {"timestamp": "2026-06-11T15:00:00", "decision": {"primary_intent": "need_more_telemetry", "confidence": 0.9, "secondary_intents": ["stable"]}, "actions_taken": ["spawned:test"]},
            {"timestamp": "2026-06-11T15:30:00", "decision": {"primary_intent": "stable", "confidence": 0.5, "secondary_intents": []}, "actions_taken": []},
        ]
        with open(log_path, "w") as f:
            for d in decisions:
                f.write(json.dumps(d) + "\n")
        
        experiences = load_experiences_from_decisions(log_path)
        assert isinstance(experiences, list)
        if experiences:
            assert isinstance(experiences[0], Experience)

    def test_load_experiences_from_orchestrator_returns_list(self, temp_dir):
        """load_experiences_from_orchestrator should return list of Experience."""
        # Create mock orchestrator log
        log_path = temp_dir / "meta_orchestrator.jsonl"
        entries = [
            {"timestamp": "2026-06-11T15:00:00", "effectiveness_scores": {"precision": 0.8, "recall": 0.7, "coverage": 0.9, "p50_trend": 0.1, "composite_reward": 0.5}, "actions_taken": ["spawned:test"]},
        ]
        with open(log_path, "w") as f:
            for e in entries:
                f.write(json.dumps(e) + "\n")
        
        experiences = load_experiences_from_orchestrator(log_path)
        assert isinstance(experiences, list)

    def test_train_policy_returns_array(self):
        """train_policy should execute without error."""
        # train_policy doesn't return, it saves to file
        # This test just verifies it doesn't crash with mock data
        import meta_rl_trainer
        original_policy_file = meta_rl_trainer.POLICY_FILE
        original_bias_file = meta_rl_trainer.BIAS_FILE
        test_policy_file = Path(tempfile.gettempdir()) / "test_meta_policy.npy"
        test_bias_file = Path(tempfile.gettempdir()) / "test_meta_policy_bias.npy"
        meta_rl_trainer.POLICY_FILE = test_policy_file
        meta_rl_trainer.BIAS_FILE = test_bias_file
        
        try:
            train_policy()  # Should not raise
        finally:
            meta_rl_trainer.POLICY_FILE = original_policy_file
            meta_rl_trainer.BIAS_FILE = original_bias_file
            # Cleanup
            if test_policy_file.exists():
                test_policy_file.unlink()
            if test_bias_file.exists():
                test_bias_file.unlink()

    def test_infer_action_returns_string(self):
        """infer_action should return intent string."""
        state = {
            "effectiveness_scores": {"precision": 0.8, "recall": 0.7, "coverage": 0.9, "p50_trend": 0.1, "composite_reward": 0.5}
        }
        action = infer_action(state)
        assert isinstance(action, str)
        assert action in INTENTS

    def test_save_and_load_policy(self, temp_dir):
        """MetaPolicy.save and MetaPolicy.load should round-trip."""
        # Patch the policy file paths
        import meta_rl_trainer
        original_policy_file = meta_rl_trainer.POLICY_FILE
        original_bias_file = meta_rl_trainer.BIAS_FILE
        test_policy_file = temp_dir / "meta_policy.npy"
        test_bias_file = temp_dir / "meta_policy_bias.npy"
        meta_rl_trainer.POLICY_FILE = test_policy_file
        meta_rl_trainer.BIAS_FILE = test_bias_file
        
        try:
            policy = MetaPolicy(state_dim=10, num_actions=8)
            # Modify weights
            policy.W = np.random.rand(8, 10)
            policy.b = np.random.rand(8)
            
            policy.save()
            loaded = MetaPolicy.load()
            
            assert np.allclose(policy.W, loaded.W)
            assert np.allclose(policy.b, loaded.b)
        finally:
            meta_rl_trainer.POLICY_FILE = original_policy_file
            meta_rl_trainer.BIAS_FILE = original_bias_file

    def test_meta_policy_class(self):
        """MetaPolicy should be instantiable."""
        policy = MetaPolicy(state_dim=10, num_actions=8)
        assert policy.state_dim == 10
        assert policy.num_actions == 8


if __name__ == "__main__":
    pytest.main([__file__, "-v"])