#!/usr/bin/env python3
"""
Trains a lightweight policy network on meta-rewards.
Runs weekly to update the intent classifier's decision policy.
"""

import json
import sqlite3
import numpy as np
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Optional
from datetime import datetime, timedelta


LOG_FILE = Path("logs/meta_decisions.jsonl")
REWARD_DB = Path(".trace/meta_monitor.db")
POLICY_FILE = Path(".trace/meta_policy.npy")
BIAS_FILE = Path(".trace/meta_policy_bias.npy")

# Intent action space matches MetaIntent enum
INTENTS = [
    "need_more_telemetry",
    "need_model_upgrade",
    "need_harness_extension",
    "need_ci_fix",
    "need_perf_investigation",
    "need_data_hydration",
    "need_security_hardening",
    "stable",
]


@dataclass
class Experience:
    state: np.ndarray      # System state vector (10 dims)
    action: int            # Intent index (0-7)
    reward: float          # Meta-reward
    next_state: np.ndarray
    done: bool


def build_state_vector(meta_state: dict) -> np.ndarray:
    """Encode system state as fixed-size vector for RL."""
    eff = meta_state.get("effectiveness_scores", {})

    return np.array([
        eff.get("precision", 0),
        eff.get("recall", 0),
        eff.get("coverage", 0),
        eff.get("p50_trend", 0),
        eff.get("high_severity_ratio", 0),
        meta_state.get("telemetry_volume", 0) / 100,    # Normalize
        meta_state.get("synthetic_count", 0) / 1000,
        meta_state.get("ci_failures", 0) / 10,
        1.0 if meta_state.get("mlx_healthy", False) else 0.0,
        meta_state.get("high_risk_recall", 0),
    ], dtype=np.float32)


def load_experiences_from_decisions() -> List[Experience]:
    """Load experiences from meta_decisions.jsonl and meta_rewards DB."""
    experiences = []

    if not LOG_FILE.exists():
        return experiences

    # Read decisions log
    decisions = []
    with open(LOG_FILE) as f:
        for line in f:
            try:
                decisions.append(json.loads(line.strip()))
            except:
                pass

    # Read rewards from DB
    rewards_by_time = {}
    if REWARD_DB.exists():
        with sqlite3.connect(REWARD_DB) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT cycle_end, reward_score, actions_taken
                FROM meta_rewards
                ORDER BY cycle_end
            """)
            for row in cursor.fetchall():
                rewards_by_time[row["cycle_end"]] = {
                    "reward": row["reward_score"],
                    "actions": json.loads(row["actions_taken"]) if row["actions_taken"] else []
                }

    # Match decisions to subsequent rewards (next cycle's reward after decision)
    for i, decision in enumerate(decisions):
        decision_time = decision.get("timestamp")
        if not decision_time:
            continue

        # Find next reward after this decision
        next_reward = None
        for reward_time, reward_data in rewards_by_time.items():
            if reward_time > decision_time:
                next_reward = reward_data["reward"]
                break

        if next_reward is None:
            continue

        # Build state from decision's logged state
        # We need to infer state - for now use defaults
        state = np.zeros(10, dtype=np.float32)
        next_state = np.zeros(10, dtype=np.float32)

        # Map primary_intent to action index
        intent = decision.get("decision", {}).get("primary_intent", "stable")
        try:
            action = INTENTS.index(intent)
        except ValueError:
            action = 7  # stable

        experiences.append(Experience(
            state=state,
            action=action,
            reward=next_reward,
            next_state=next_state,
            done=False
        ))

    return experiences


def load_experiences_from_orchestrator() -> List[Experience]:
    """Load experiences from meta_orchestrator.jsonl (richer state)."""
    orchestrator_log = Path("logs/meta_orchestrator.jsonl")
    if not orchestrator_log.exists():
        return []

    experiences = []
    with open(orchestrator_log) as f:
        lines = [json.loads(line.strip()) for line in f if line.strip()]

    for i, entry in enumerate(lines):
        state_vec = build_state_vector(entry)
        action = INTENTS.index(entry["last_decision"]["intent"]) if entry["last_decision"]["intent"] in INTENTS else 7
        reward = entry.get("meta_reward", 0.0)

        next_state_vec = np.zeros(10, dtype=np.float32)
        if i + 1 < len(lines):
            next_state_vec = build_state_vector(lines[i + 1])

        done = i == len(lines) - 1
        experiences.append(Experience(
            state=state_vec,
            action=action,
            reward=reward,
            next_state=next_state_vec,
            done=done
        ))

    return experiences


# Simple policy: Linear layer with softmax
# State dim: 10, Action dim: 8
class MetaPolicy:
    def __init__(self, state_dim: int = 10, action_dim: int = 8):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.W = np.random.randn(action_dim, state_dim) * 0.01
        self.b = np.zeros(action_dim)

    def predict(self, state: np.ndarray) -> Tuple[int, np.ndarray]:
        logits = self.W @ state + self.b
        probs = np.exp(logits - np.max(logits))
        probs = probs / np.sum(probs)
        return int(np.argmax(probs)), probs

    def log_prob(self, state: np.ndarray, action: int) -> float:
        _, probs = self.predict(state)
        return np.log(probs[action] + 1e-8)

    def update(self, experiences: List[Experience], lr: float = 0.01, gamma: float = 0.99):
        """REINFORCE with baseline (average reward)."""
        if not experiences:
            return 0.0

        rewards = np.array([e.reward for e in experiences])
        baseline = np.mean(rewards)

        total_loss = 0.0
        for exp in experiences:
            advantage = exp.reward - baseline
            logp = self.log_prob(exp.state, exp.action)

            # Gradient: ∇logπ(a|s) * advantage
            logits = self.W @ exp.state + self.b
            probs = np.exp(logits - np.max(logits))
            probs = probs / np.sum(probs)

            grad_W = np.zeros_like(self.W)
            grad_W[exp.action] = exp.state * (1 - probs[exp.action])
            for a in range(self.action_dim):
                if a != exp.action:
                    grad_W[a] = -exp.state * probs[a]

            self.W += lr * advantage * grad_W
            self.b += lr * advantage * (np.eye(self.action_dim)[exp.action] - probs)

            total_loss += -advantage * logp

        return total_loss / len(experiences)

    def save(self):
        POLICY_FILE.parent.mkdir(parents=True, exist_ok=True)
        np.save(POLICY_FILE, self.W)
        np.save(BIAS_FILE, self.b)
        print(f"✅ Meta-policy saved to {POLICY_FILE}")

    @classmethod
    def load(cls) -> "MetaPolicy":
        policy = cls()
        if POLICY_FILE.exists() and BIAS_FILE.exists():
            policy.W = np.load(POLICY_FILE)
            policy.b = np.load(BIAS_FILE)
            print(f"✅ Meta-policy loaded from {POLICY_FILE}")
        else:
            print("⚠️  No saved policy found, using random initialization")
        return policy

    def get_action_distribution(self, state: np.ndarray) -> dict:
        """Get action probabilities for inspection."""
        _, probs = self.predict(state)
        return {INTENTS[i]: float(probs[i]) for i in range(len(INTENTS))}


def train_policy():
    """Main training entry point."""
    print("🧠 Meta-RL Trainer: Loading experiences...")

    # Try orchestrator log first (richer state)
    experiences = load_experiences_from_orchestrator()
    if not experiences:
        experiences = load_experiences_from_decisions()

    print(f"📊 Loaded {len(experiences)} experiences")

    if len(experiences) < 5:
        print(f"⏭️  Only {len(experiences)} experiences, need 5+ for training. Skipping.")
        return

    # Load or create policy
    policy = MetaPolicy.load()

    print(f"🏋️  Training on {len(experiences)} experiences...")

    # Shuffle and train
    np.random.shuffle(experiences)

    for epoch in range(20):
        loss = policy.update(experiences, lr=0.01)
        if epoch % 5 == 0:
            rewards = [e.reward for e in experiences]
            print(f"  Epoch {epoch}: loss = {loss:.4f}, mean reward = {np.mean(rewards):.3f}")

    # Save updated policy
    policy.save()

    # Show learned policy for current state
    if experiences:
        current_state = experiences[-1].state
        dist = policy.get_action_distribution(current_state)
        print("\n📈 Current state action distribution:")
        for intent, prob in sorted(dist.items(), key=lambda x: -x[1]):
            print(f"  {intent}: {prob:.3f}")

    print("✅ Meta-RL training complete")


def infer_action(state: dict) -> str:
    """Infer best action for given state (for use by intent classifier)."""
    policy = MetaPolicy.load()
    state_vec = build_state_vector(state)
    action_idx, _ = policy.predict(state_vec)
    return INTENTS[action_idx]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Meta-RL Policy Trainer")
    parser.add_argument("--train", action="store_true", help="Train the policy")
    parser.add_argument("--infer", action="store_true", help="Infer action for current state")

    args = parser.parse_args()

    if args.train:
        train_policy()
    elif args.infer:
        # Load current state from meta_state.json
        state_file = Path(".trace/meta_state.json")
        if state_file.exists():
            state = json.loads(state_file.read_text())
            action = infer_action(state)
            print(f"Inferred action: {action}")
        else:
            print("No state file found")
    else:
        train_policy()