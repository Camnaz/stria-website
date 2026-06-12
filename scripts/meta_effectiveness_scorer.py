#!/usr/bin/env python3
"""
Meta-Monitor Layer: Scores the quality of monitor outputs.
Feeds RL loop: (eval findings) -> (retrain outcome) -> (production metrics)
"""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import statistics

META_DB = Path(".trace/meta_monitor.db")
EFFECTIVENESS_WINDOW_DAYS = 7

class FindingCategory(Enum):
    LATENCY_GAP = "latency_gap"
    INTENT_DRIFT = "intent_drift"
    EDGE_CASE = "edge_case"
    RISK_GAP = "risk_gap"

@dataclass
class MonitorFinding:
    category: FindingCategory
    severity: str  # high|medium|low
    description: str
    synthetic_generated: int
    timestamp: str
    analysis_id: str

@dataclass
class RetrainOutcome:
    adapter_version: str
    train_loss: float
    val_loss: float
    probe_intent_acc: float
    probe_risk_acc: float
    high_risk_recall: float
    timestamp: str
    training_samples: int

@dataclass
class ProductionMetrics:
    adapter_version: str
    p50_latency_ms: float
    p99_latency_ms: float
    error_rate: float
    classification_accuracy: float
    timestamp: str

class MetaEffectivenessScorer:
    def __init__(self, db_path: Path = META_DB):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS monitor_findings (
                    id INTEGER PRIMARY KEY,
                    category TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description TEXT,
                    synthetic_generated INTEGER,
                    timestamp TEXT NOT NULL,
                    analysis_id TEXT,
                    validated BOOLEAN DEFAULT 0,
                    validation_outcome TEXT
                );
                
                CREATE TABLE IF NOT EXISTS retrain_outcomes (
                    id INTEGER PRIMARY KEY,
                    adapter_version TEXT UNIQUE NOT NULL,
                    train_loss REAL,
                    val_loss REAL,
                    probe_intent_acc REAL,
                    probe_risk_acc REAL,
                    high_risk_recall REAL,
                    timestamp TEXT NOT NULL,
                    training_samples INTEGER
                );
                
                CREATE TABLE IF NOT EXISTS production_metrics (
                    id INTEGER PRIMARY KEY,
                    adapter_version TEXT NOT NULL,
                    p50_latency_ms REAL,
                    p99_latency_ms REAL,
                    error_rate REAL,
                    classification_accuracy REAL,
                    timestamp TEXT NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS meta_rewards (
                    id INTEGER PRIMARY KEY,
                    cycle_start TEXT NOT NULL,
                    cycle_end TEXT NOT NULL,
                    findings_caught INTEGER,
                    false_positives INTEGER,
                    perf_delta_p50 REAL,
                    perf_delta_p99 REAL,
                    coverage_score REAL,
                    reward_score REAL,
                    actions_taken TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_findings_time ON monitor_findings(timestamp);
                CREATE INDEX IF NOT EXISTS idx_retrain_version ON retrain_outcomes(adapter_version);
                CREATE INDEX IF NOT EXISTS idx_prod_adapter ON production_metrics(adapter_version);
            """)
    
    def log_monitor_findings(self, analysis: Dict, analysis_id: str) -> int:
        """Record what the monitor found this cycle."""
        findings = []
        for cat_key, category in [
            ("latency_gaps", FindingCategory.LATENCY_GAP),
            ("intent_drifts", FindingCategory.INTENT_DRIFT),
            ("edge_cases", FindingCategory.EDGE_CASE),
            ("risk_gaps", FindingCategory.RISK_GAP),
        ]:
            for finding in analysis.get(cat_key, []):
                findings.append(MonitorFinding(
                    category=category,
                    severity=finding.get("severity", "medium"),
                    description=finding.get("pattern") or finding.get("category") or finding.get("expected_risk", ""),
                    synthetic_generated=0,
                    timestamp=datetime.utcnow().isoformat(),
                    analysis_id=analysis_id,
                ))
        
        synthetic_count = len(analysis.get("new_test_synthetic_dataset", []))
        for f in findings:
            f.synthetic_generated = synthetic_count
        
        with sqlite3.connect(self.db_path) as conn:
            for f in findings:
                conn.execute("""
                    INSERT INTO monitor_findings 
                    (category, severity, description, synthetic_generated, timestamp, analysis_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (f.category.value, f.severity, f.description, f.synthetic_generated, f.timestamp, f.analysis_id))
            conn.commit()
        
        return len(findings)
    
    def log_retrain_outcome(self, outcome: RetrainOutcome):
        """Record retraining results."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO retrain_outcomes
                (adapter_version, train_loss, val_loss, probe_intent_acc, probe_risk_acc, 
                 high_risk_recall, timestamp, training_samples)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                outcome.adapter_version, outcome.train_loss, outcome.val_loss,
                outcome.probe_intent_acc, outcome.probe_risk_acc, outcome.high_risk_recall,
                outcome.timestamp, outcome.training_samples
            ))
            conn.commit()
    
    def log_production_metrics(self, metrics: ProductionMetrics):
        """Record production performance for current adapter."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO production_metrics
                (adapter_version, p50_latency_ms, p99_latency_ms, error_rate, classification_accuracy, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                metrics.adapter_version, metrics.p50_latency_ms, metrics.p99_latency_ms,
                metrics.error_rate, metrics.classification_accuracy, metrics.timestamp
            ))
            conn.commit()
    
    def compute_effectiveness(self, days: int = EFFECTIVENESS_WINDOW_DAYS) -> Dict[str, Any]:
        """Compute meta-effectiveness score for the monitor."""
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            cursor = conn.execute("""
                SELECT mf.category, mf.severity, COUNT(*) as count,
                       AVG(mf.synthetic_generated) as avg_synthetic
                FROM monitor_findings mf
                WHERE mf.timestamp > ? AND mf.validated = 1
                GROUP BY mf.category, mf.severity
            """, (since,))
            finding_stats = [dict(r) for r in cursor.fetchall()]
            
            cursor = conn.execute("""
                SELECT adapter_version, probe_intent_acc, probe_risk_acc, high_risk_recall,
                       train_loss, val_loss, timestamp
                FROM retrain_outcomes
                WHERE timestamp > ?
                ORDER BY timestamp DESC
            """, (since,))
            retrain_history = [dict(r) for r in cursor.fetchall()]
            
            cursor = conn.execute("""
                SELECT ro.adapter_version,
                       AVG(pm.p50_latency_ms) as avg_p50,
                       AVG(pm.p99_latency_ms) as avg_p99,
                       AVG(pm.error_rate) as avg_error,
                       AVG(pm.classification_accuracy) as avg_acc
                FROM retrain_outcomes ro
                JOIN production_metrics pm ON ro.adapter_version = pm.adapter_version
                WHERE ro.timestamp > ?
                GROUP BY ro.adapter_version
            """, (since,))
            prod_impact = [dict(r) for r in cursor.fetchall()]
        
        scores = self._compute_scores(finding_stats, retrain_history, prod_impact)
        
        return {
            "window_days": days,
            "finding_stats": finding_stats,
            "retrain_history": retrain_history,
            "production_impact": prod_impact,
            "composite_scores": scores,
            "computed_at": datetime.utcnow().isoformat()
        }
    
    def _compute_scores(self, findings: List[Dict], retrains: List[Dict], prod: List[Dict]) -> Dict[str, float]:
        """Calculate effectiveness metrics."""
        total_findings = sum(f["count"] for f in findings)
        high_sev = sum(f["count"] for f in findings if f["severity"] == "high")
        
        precision = 0.0
        if retrains:
            improved = sum(1 for r in retrains if r["probe_intent_acc"] > 0.8)
            precision = improved / len(retrains)
        
        recall = 0.0
        if prod:
            avg_acc = statistics.mean(p["avg_acc"] for p in prod) if prod else 0
            recall = avg_acc
        
        categories_covered = len(set(f["category"] for f in findings))
        coverage = categories_covered / len(FindingCategory)
        
        p50_trend = 0.0
        if len(prod) >= 2:
            before = prod[-1]["avg_p50"]
            after = prod[0]["avg_p50"]
            p50_trend = (before - after) / before
        
        reward = (
            0.3 * precision +
            0.3 * recall +
            0.2 * coverage +
            0.1 * max(0, p50_trend) +
            0.1 * (high_sev / max(1, total_findings))
        )
        
        return {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "coverage": round(coverage, 3),
            "p50_trend": round(p50_trend, 3),
            "high_severity_ratio": round(high_sev / max(1, total_findings), 3),
            "total_findings": total_findings,
            "composite_reward": round(reward, 3)
        }
    
    def log_meta_reward(self, cycle_start: str, cycle_end: str, actions: List[str]):
        """Record the RL reward for this meta-cycle."""
        eff = self.compute_effectiveness()
        scores = eff["composite_scores"]
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO meta_rewards
                (cycle_start, cycle_end, findings_caught, false_positives, 
                 perf_delta_p50, perf_delta_p99, coverage_score, reward_score, actions_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                cycle_start, cycle_end,
                scores["total_findings"],
                0,
                scores["p50_trend"],
                0,
                scores["coverage"],
                scores["composite_reward"],
                json.dumps(actions)
            ))
            conn.commit()
        
        return scores["composite_reward"]


# Standalone test
if __name__ == "__main__":
    scorer = MetaEffectivenessScorer()
    eff = scorer.compute_effectiveness()
    print(json.dumps(eff, indent=2))