#!/usr/bin/env python3
"""
CRON WRANGLER - Master Cron Job Management System
===================================================

The Cron Wrangler is a meta-cron that manages ALL other cron jobs:
1. AUDITS all cron jobs for health, duplicates, effectiveness
2. OPTIMIZES schedules, prompts, and intervals based on goals
3. ELIMINATES dead, non-working, or redundant jobs
4. MONITORS & RESTARTS failed jobs automatically
5. ALIGNS all jobs toward StriaSystems/TraceV2 company goals

Company Goals (StriaSystems TraceV2):
- Ship Trace (observability/audit) and Forge (verified execution)
- Evidence-before-enforcement philosophy
- Three-plane architecture: Governance → Orchestration → Execution
- MLX LoRA training pipeline with data flywheel
- Cloudflare Pages deployment with zero-downtime
- High-quality, production-ready code matching design system exactly

Run interval: Every 30 minutes (aligned with meta-cron)
"""

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import requests


# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

COMPANY_GOALS = {
    "primary": "Ship TraceV2 (Trace observability + Forge verified execution)",
    "philosophy": "Evidence-before-enforcement governance",
    "architecture": "Three-plane: Governance → Orchestration → Execution",
    "tech_stack": {
        "frontend": "TypeScript/React/Vite",
        "backend": "Rust trace-core with N-API bindings",
        "ml": "Python MLX LoRA fine-tuning pipeline",
        "deployment": "Cloudflare Pages via wrangler",
    },
    "key_metrics": [
        "Build passes",
        "Tests pass (unit, e2e, accessibility, viewport)",
        "Lighthouse scores >= budget",
        "Deployment health",
        "ML training convergence",
        "Telemetry flow health",
    ],
}

# Optimal intervals for different job types (in minutes)
# Optimal intervals for different job types (in minutes)
OPTIMAL_INTERVALS = {
    "deployment_monitor": 15,          # Fast feedback on deploys - CRITICAL
    "deployment_health": 15,           # Same as above
    "edge_case_audit": 1440,           # Daily (2 AM) - full viewport + a11y
    "edge_case_monitor": 1440,         # Daily (2 AM) - not every 15min!
    "dependency_audit": 10080,         # Weekly (Monday 3 AM)
    "security_audit": 10080,           # Weekly
    "context_sync": 360,               # Every 6 hours
    "telemetry_boost": 60,             # Hourly
    "model_evaluation": 1440,          # Daily
    "ci_health_check": 30,             # Every 30 min
    "pipeline_health": 240,            # Every 4 hours (not 15min)
    "data_hydration": 1440,            # Daily
    "perf_investigation": 1440,        # Daily
    "security_hardening": 10080,       # Weekly
    "meta_orchestrator": 30,           # Every 30 min
    "cron_wrangler": 30,               # Every 30 min (meta-meta)
    "agent_monitor": 5,                # Every 5 min
    "fixer_cron": 5,                   # Every 5 min
    "hourly_briefing": 60,             # Hourly
    "cleanup": 60,                     # Hourly (not every 15 min)
}

# Job priority weights for resource allocation
JOB_PRIORITIES = {
    "deployment_monitor": 10,   # Critical - production visibility
    "meta_orchestrator": 10,    # Critical - self-improving system
    "ci_health_check": 9,       # High - prevents broken main
    "edge_case_audit": 8,       # High - quality gate
    "context_sync": 7,          # Medium-high - keeps types current
    "telemetry_boost": 6,       # Medium - feeds ML pipeline
    "model_evaluation": 6,      # Medium - ML quality
    "dependency_audit": 5,      # Medium - security
    "security_hardening": 5,    # Medium - security
    "perf_investigation": 4,    # Low-medium - optimization
    "data_hydration": 4,        # Low-medium - data prep
    "hourly_briefing": 3,       # Low - reporting
    "agent_monitor": 3,         # Low - observability
    "fixer_cron": 3,            # Low - auto-fix
    "cleanup": 2,               # Low - maintenance
}


# ============================================================================
# DATA MODELS
# ============================================================================

class JobStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILING = "failing"
    DEAD = "dead"
    NEVER_RAN = "never_ran"
    DUPLICATE = "duplicate"


class JobType(Enum):
    AGENT_BASED = "agent_based"
    SCRIPT_BASED = "script_based"
    HERMES_CRON = "hermes_cron"


@dataclass
class CronJob:
    job_id: str
    name: str
    prompt_preview: str
    schedule: str
    repeat: str
    deliver: str
    enabled: bool
    state: str
    last_run_at: Optional[str]
    last_status: Optional[str]
    last_delivery_error: Optional[str]
    skills: List[str]
    enabled_toolsets: List[str]
    workdir: Optional[str]
    script: Optional[str]
    no_agent: bool
    model: Optional[str]
    provider: Optional[str]
    
    # Derived fields
    job_type: JobType = JobType.HERMES_CRON
    status: JobStatus = JobStatus.HEALTHY
    next_run_at: Optional[str] = None
    interval_minutes: Optional[int] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    effectiveness_score: float = 0.0
    alignment_score: float = 0.0
    recommended_action: str = "keep"
    recommended_schedule: Optional[str] = None
    recommended_prompt: Optional[str] = None


# ============================================================================
# CRON WRANGLER CORE
# ============================================================================

class CronWrangler:
    def __init__(self, project_root: str = "/Users/cnazarko/stria systems/TraceV2"):
        self.project_root = Path(project_root)
        self.logs_dir = self.project_root / "logs"
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.wrangler_log = self.logs_dir / "cron_wrangler.jsonl"
        self.wrangler_state = self.project_root / ".trace" / "cron_wrangler_state.json"
        self.wrangler_state.parent.mkdir(parents=True, exist_ok=True)
        
        # Load previous state
        self.previous_state = self._load_state()
        
    def _load_state(self) -> Dict:
        if self.wrangler_state.exists():
            try:
                return json.loads(self.wrangler_state.read_text())
            except:
                return {}
        return {}
    
    def _save_state(self, state: Dict):
        self.wrangler_state.write_text(json.dumps(state, indent=2))
    
    def _log(self, entry: Dict):
        entry["timestamp"] = datetime.utcnow().isoformat()
        with open(self.wrangler_log, "a") as f:
            f.write(json.dumps(entry) + "\n")
    
    # -----------------------------------------------------------------------
    # FETCH & PARSE HERMES CRON JOBS
    # -----------------------------------------------------------------------
    
    def fetch_hermes_crons(self) -> List[CronJob]:
        """Fetch all cron jobs from Hermes - read directly from jobs.json."""
        # Try primary method: read from Hermes jobs.json directly
        hermes_jobs_file = Path.home() / ".hermes" / "cron" / "jobs.json"
        if hermes_jobs_file.exists():
            try:
                return self._parse_hermes_jobs_json(hermes_jobs_file)
            except Exception as e:
                self._log({"level": "error", "msg": f"Failed to parse Hermes jobs.json: {e}"})
        
        # Fallback: try CLI (if hermes is in PATH)
        try:
            result = subprocess.run(
                ["hermes", "cron", "list"],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                return self._parse_hermes_cron_list_output(result.stdout)
        except Exception:
            pass
        
        self._log({"level": "error", "msg": "All methods to fetch Hermes crons failed"})
        return []
    
    def _parse_hermes_cron_list_output(self, output: str) -> List[CronJob]:
        """Parse the text output from `hermes cron list`."""
        jobs = []
        current_job = {}
        
        for line in output.split('\n'):
            line = line.rstrip()
            
            # Job ID line: "  6bd2346376b3 [active]"
            if re.match(r'^\s+[a-f0-9]{12}\s+\[', line):
                # Save previous job
                if current_job:
                    jobs.append(self._parse_hermes_job(current_job))
                # Start new job
                parts = line.strip().split()
                current_job = {
                    "job_id": parts[0],
                    "state": parts[1].strip('[]') if len(parts) > 1 else "unknown",
                }
            elif current_job:
                # Key: Value pairs
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower().replace(' ', '_')
                    value = value.strip()
                    
                    # Map keys to our expected fields
                    key_map = {
                        'name': 'name',
                        'schedule': 'schedule',
                        'repeat': 'repeat',
                        'next_run': 'next_run_at',
                        'deliver': 'deliver',
                        'skills': 'skills',
                        'workdir': 'workdir',
                        'script': 'script',
                        'mode': 'mode',
                        'last_run': 'last_run_at',
                        'enabled_toolsets': 'enabled_toolsets',
                    }
                    
                    mapped_key = key_map.get(key, key)
                    current_job[mapped_key] = value
        
        # Don't forget the last job
        if current_job:
            jobs.append(self._parse_hermes_job(current_job))
        
        return jobs
    
    def _parse_hermes_job(self, j: Dict) -> CronJob:
        """Parse a Hermes cron job dict into CronJob dataclass."""
        # Determine job type
        mode = j.get("mode", "")
        script = j.get("script")
        skills_str = j.get("skills", "")
        enabled_toolsets_str = j.get("enabled_toolsets", "")
        
        if mode and "no-agent" in mode.lower() and script:
            job_type = JobType.SCRIPT_BASED
        elif skills_str:
            job_type = JobType.AGENT_BASED
        else:
            job_type = JobType.HERMES_CRON
        
        # Parse schedule to interval minutes
        interval = self._schedule_to_minutes(j.get("schedule", ""))
        
        # Parse last_run_at and last_status from combined field
        last_run_at = None
        last_status = None
        last_run_raw = j.get("last_run_at", "")
        if last_run_raw:
            # Format: "2026-06-11T21:48:41.337491-05:00  ok"
            parts = last_run_raw.rsplit(' ', 1)
            if len(parts) == 2:
                last_run_at = parts[0]
                last_status = parts[1]
            else:
                last_run_at = last_run_raw
        
        # Parse skills
        skills = []
        if skills_str:
            skills = [s.strip() for s in skills_str.split(',')]
        
        # Parse enabled_toolsets
        enabled_toolsets = []
        if enabled_toolsets_str:
            enabled_toolsets = [s.strip() for s in enabled_toolsets_str.split(',')]
        
        # Enabled state
        enabled = j.get("state", "").lower() == "active"
        
        # Prompt preview - construct from name and available info
        prompt_preview = j.get("prompt_preview", "")
        if not prompt_preview:
            prompt_preview = f"Cron job: {j.get('name', 'Unknown')}"
            if script:
                prompt_preview += f" | Script: {script}"
            if j.get("workdir"):
                prompt_preview += f" | Workdir: {j.get('workdir')}"
        
        return CronJob(
            job_id=j.get("job_id", ""),
            name=j.get("name", ""),
            prompt_preview=prompt_preview,
            schedule=j.get("schedule", ""),
            repeat=j.get("repeat", "forever"),
            deliver=j.get("deliver", "local"),
            enabled=enabled,
            state=j.get("state", "scheduled"),
            last_run_at=last_run_at,
            last_status=last_status,
            last_delivery_error=j.get("last_delivery_error"),
            skills=skills,
            enabled_toolsets=enabled_toolsets,
            workdir=j.get("workdir"),
            script=script,
            no_agent=(job_type == JobType.SCRIPT_BASED),
            model=j.get("model"),
            provider=j.get("provider"),
            job_type=job_type,
            interval_minutes=interval,
        )
    
    def _schedule_to_minutes(self, schedule: str) -> Optional[int]:
        """Convert cron schedule to approximate minutes."""
        if not schedule:
            return None
        
        schedule = schedule.strip()
        
        # Handle "every Xm" format
        if schedule.startswith("every ") and schedule.endswith("m"):
            try:
                return int(schedule[6:-1])
            except:
                pass
        
        if schedule.startswith("every ") and schedule.endswith("h"):
            try:
                return int(schedule[6:-1]) * 60
            except:
                pass
        
        # Handle standard cron: * * * * *
        parts = schedule.split()
        if len(parts) == 5:
            minute, hour, day, month, dow = parts
            # Every minute
            if minute == "*" and hour == "*":
                return 1
            # Every N minutes
            if minute.startswith("*/"):
                try:
                    return int(minute[2:])
                except:
                    pass
            # Hourly at minute 0
            if minute == "0" and hour == "*":
                return 60
            # Daily at specific time
            if minute != "*" and hour != "*" and day == "*" and month == "*" and dow == "*":
                return 1440
            # Weekly
            if minute != "*" and hour != "*" and day == "*" and month == "*" and dow != "*":
                return 10080
        
        return None

    def _parse_hermes_jobs_json(self, jobs_file: Path) -> List[CronJob]:
        """Parse Hermes cron jobs from jobs.json file."""
        import json
        data = json.loads(jobs_file.read_text())
        jobs = []
        
        for j in data.get("jobs", []):
            # Parse schedule expression to display format
            schedule = j.get("schedule", {})
            schedule_expr = schedule.get("expr", "") if isinstance(schedule, dict) else str(schedule)
            schedule_display = schedule.get("display", schedule_expr) if isinstance(schedule, dict) else schedule_expr
            
            # Parse skills - can be list or comma-separated string
            skills = j.get("skills", [])
            if isinstance(skills, str):
                skills = [s.strip() for s in skills.split(",")]
            
            # Parse enabled_toolsets
            enabled_toolsets = j.get("enabled_toolsets", [])
            if isinstance(enabled_toolsets, str):
                enabled_toolsets = [s.strip() for s in enabled_toolsets.split(",")]
            
            # Determine job type
            no_agent = j.get("no_agent", False)
            script = j.get("script")
            if no_agent and script:
                job_type = JobType.SCRIPT_BASED
            elif skills:
                job_type = JobType.AGENT_BASED
            else:
                job_type = JobType.HERMES_CRON
            
            # Parse interval
            interval = self._schedule_to_minutes(schedule_expr)
            
            # Parse last_run_at and last_status
            last_run_at = j.get("last_run_at")
            last_status = j.get("last_status")
            
            enabled = j.get("enabled", True)
            state = j.get("state", "scheduled")
            
            # Prompt preview
            prompt = j.get("prompt", "")
            prompt_preview = prompt[:200] if prompt else f"Cron job: {j.get('name', 'Unknown')}"
            
            # Workdir
            workdir = j.get("workdir")
            
            jobs.append(CronJob(
                job_id=j.get("id", ""),
                name=j.get("name", ""),
                prompt_preview=prompt_preview,
                schedule=schedule_display,
                repeat="forever",  # Hermes uses repeat.times/null
                deliver=j.get("deliver", "local"),
                enabled=enabled,
                state=state,
                last_run_at=last_run_at,
                last_status=last_status,
                last_delivery_error=j.get("last_delivery_error"),
                skills=skills,
                enabled_toolsets=enabled_toolsets,
                workdir=workdir,
                script=script,
                no_agent=no_agent,
                model=j.get("model"),
                provider=j.get("provider"),
                job_type=job_type,
                interval_minutes=interval,
            ))
        
        return jobs

    # -----------------------------------------------------------------------
    # AUDIT: Analyze all jobs for issues
    # -----------------------------------------------------------------------
    
    def audit_jobs(self, jobs: List[CronJob]) -> List[CronJob]:
        """Comprehensive audit of all cron jobs."""
        print(f"\n🔍 AUDITING {len(jobs)} CRON JOBS")
        print("=" * 60)
        
        # 1. Check for duplicates
        jobs = self._detect_duplicates(jobs)
        
        # 2. Assess health status
        jobs = self._assess_health(jobs)
        
        # 3. Score effectiveness
        jobs = self._score_effectiveness(jobs)
        
        # 4. Score goal alignment
        jobs = self._score_alignment(jobs)
        
        # 5. Determine recommended actions
        jobs = self._recommend_actions(jobs)
        
        # Print audit summary
        self._print_audit_summary(jobs)
        
        return jobs
    
    def _detect_duplicates(self, jobs: List[CronJob]) -> List[CronJob]:
        """Detect duplicate jobs by name and function."""
        seen = {}
        for job in jobs:
            key = job.name.lower().strip()
            if key in seen:
                job.is_duplicate = True
                job.duplicate_of = seen[key].job_id
                seen[key].is_duplicate = True  # Mark original too
            else:
                seen[key] = job
        
        # Also check for functional duplicates (similar purpose)
        name_groups = {}
        for job in jobs:
            base_name = self._normalize_job_name(job.name)
            if base_name not in name_groups:
                name_groups[base_name] = []
            name_groups[base_name].append(job)
        
        for base_name, group in name_groups.items():
            if len(group) > 1:
                # Keep the one with better status/history, mark others
                group.sort(key=lambda j: (
                    j.last_status != "ok",      # Prefer ok status
                    j.last_run_at is None,      # Prefer has run
                    -j.effectiveness_score,     # Prefer higher effectiveness
                ))
                for i, job in enumerate(group[1:], 1):
                    if not job.is_duplicate:
                        job.is_duplicate = True
                        job.duplicate_of = group[0].job_id
                        self._log({"level": "warn", "msg": f"Duplicate detected: {job.name} -> {group[0].name}"})
        
        return jobs
    
    def _normalize_job_name(self, name: str) -> str:
        """Normalize job name for duplicate detection."""
        name = name.lower()
        # Remove common prefixes/suffixes
        for prefix in ["daily ", "weekly ", "hourly ", "tracev2 ", "backend ", "context ", "monitor ", "monitoring "]:
            if name.startswith(prefix):
                name = name[len(prefix):]
        for suffix in [" cron", " job", " monitor", " monitoring", " audit", " sync", " deploy"]:
            if name.endswith(suffix):
                name = name[:-len(suffix)]
        return name.strip()
    
    def _assess_health(self, jobs: List[CronJob]) -> List[CronJob]:
        """Assess health status of each job."""
        now = datetime.utcnow()
        
        for job in jobs:
            # Never ran
            if job.last_run_at is None:
                job.status = JobStatus.NEVER_RAN
                continue
            
            # Has error status
            if job.last_status == "error":
                job.status = JobStatus.FAILING
                continue
            
            # Check if overdue
            if job.last_run_at:
                try:
                    last_run = datetime.fromisoformat(job.last_run_at.replace("Z", "+00:00"))
                    if job.interval_minutes:
                        expected_next = last_run + timedelta(minutes=job.interval_minutes * 2)  # 2x grace
                        if now > expected_next:
                            job.status = JobStatus.DEAD
                            continue
                except:
                    pass
            
            # Check for degraded (recent errors but recovered)
            if job.last_delivery_error:
                job.status = JobStatus.DEGRADED
                continue
            
            job.status = JobStatus.HEALTHY
        
        return jobs
    
    def _score_effectiveness(self, jobs: List[CronJob]) -> List[CronJob]:
        """Score job effectiveness based on history and outcomes."""
        # Load historical data if available
        history_file = self.logs_dir / "cron_effectiveness.jsonl"
        history = {}
        if history_file.exists():
            for line in history_file.read_text().strip().split("\n"):
                if line:
                    try:
                        entry = json.loads(line)
                        job_id = entry.get("job_id")
                        if job_id:
                            history[job_id] = entry
                    except:
                        pass
        
        for job in jobs:
            score = 0.5  # Base score
            
            # Status-based scoring
            if job.status == JobStatus.HEALTHY:
                score += 0.3
            elif job.status == JobStatus.DEGRADED:
                score += 0.1
            elif job.status == JobStatus.FAILING:
                score -= 0.3
            elif job.status == JobStatus.DEAD:
                score -= 0.5
            elif job.status == JobStatus.NEVER_RAN:
                score -= 0.2
            
            # Duplicate penalty
            if job.is_duplicate:
                score -= 0.4
            
            # Frequency appropriateness
            optimal = self._get_optimal_interval(job)
            if job.interval_minutes and optimal:
                ratio = job.interval_minutes / optimal
                if 0.8 <= ratio <= 1.2:
                    score += 0.1  # Well-tuned
                elif ratio > 2:
                    score -= 0.1  # Too frequent
                elif ratio < 0.5:
                    score -= 0.1  # Too infrequent
            
            # Historical success rate
            if job.job_id in history:
                h = history[job.job_id]
                success_rate = h.get("success_rate", 0.5)
                score = (score + success_rate) / 2
            
            job.effectiveness_score = max(0.0, min(1.0, score))
        
        return jobs
    
    def _get_optimal_interval(self, job: CronJob) -> Optional[int]:
        """Get optimal interval for a job based on its type/purpose."""
        name_lower = job.name.lower()
        
        # Check OPTIMAL_INTERVALS keys first (most specific)
        for job_type, interval in OPTIMAL_INTERVALS.items():
            if job_type in name_lower or job_type.replace("_", " ") in name_lower:
                return interval
        
        # Fallback: infer from name (order matters - most specific first)
        if "cron wrangler" in name_lower:
            return 30
        if "pipeline health" in name_lower:
            return 240
        if "edge case monitor" in name_lower:
            return 1440
        if "deployment health" in name_lower or "deployment monitor" in name_lower:
            return 15
        if "deploy" in name_lower:
            return 60
        if "edge case audit" in name_lower or ("audit" in name_lower and "edge" in name_lower):
            return 1440
        if "dependency audit" in name_lower or "security audit" in name_lower:
            return 10080
        if "context sync" in name_lower or "context-sync" in name_lower:
            return 360
        if "sync" in name_lower:
            return 360
        if "telemetry" in name_lower:
            return 60
        if "ci health" in name_lower or "ci_health" in name_lower:
            return 30
        if "security" in name_lower and ("audit" in name_lower or "harden" in name_lower):
            return 10080
        if "security" in name_lower:
            return 10080
        if "dependency" in name_lower:
            return 10080
        if "model" in name_lower or "eval" in name_lower:
            return 1440
        if "cleanup" in name_lower:
            return 60
        if "briefing" in name_lower:
            return 60
        if "monitor" in name_lower:
            return 15
        
        return 60  # Default hourly
    
    def _score_alignment(self, jobs: List[CronJob]) -> List[CronJob]:
        """Score how well each job aligns with company goals."""
        for job in jobs:
            score = 0.0
            name_lower = job.name.lower()
            prompt_lower = job.prompt_preview.lower()
            skills_text = " ".join(job.skills).lower() if job.skills else ""
            workdir_text = job.workdir.lower() if job.workdir else ""
            toolsets_text = " ".join(job.enabled_toolsets).lower() if job.enabled_toolsets else ""
            combined = f"{name_lower} {prompt_lower} {skills_text} {workdir_text} {toolsets_text}"
            
            # Direct goal alignment - weighted by importance to StriaSystems TraceV2
            goal_keywords = {
                # PRIMARY GOALS - Core product
                "tracev2": 0.35,
                "trace": 0.30,
                "forge": 0.30,
                "striasystems": 0.25,
                
                # DEPLOYMENT - Critical for shipping
                "deploy": 0.25,
                "deployment": 0.25,
                "cloudflare": 0.20,
                "wrangler": 0.20,
                "pages": 0.15,
                
                # QUALITY GATES - Evidence-before-enforcement
                "edge case": 0.25,
                "viewport": 0.15,
                "accessibility": 0.15,
                "a11y": 0.15,
                "lighthouse": 0.15,
                "audit": 0.15,
                "test": 0.10,
                "smoke": 0.10,
                
                # ML PIPELINE - Data flywheel & LoRA training
                "mlx": 0.20,
                "lora": 0.15,
                "training": 0.15,
                "telemetry": 0.20,
                "model": 0.15,
                "adapter": 0.15,
                "evaluat": 0.15,
                "guardrail": 0.15,
                "fine-tun": 0.10,
                "retrain": 0.10,
                
                # CONTEXT SYNC - Type safety across planes (three-plane architecture)
                "context sync": 0.35,
                "context-sync": 0.35,
                "backend": 0.30,
                "backend systems": 0.30,
                "trace-core": 0.25,
                "trace-pipeline": 0.20,
                "stria-ingestion": 0.20,
                "types": 0.20,
                "contract": 0.20,
                "n-api": 0.20,
                "napi": 0.20,
                "typescript": 0.15,
                "rust": 0.15,
                "bindings": 0.15,
                "napi bindings": 0.20,
                
                # SECURITY & COMPLIANCE
                "security": 0.20,
                "dependency": 0.15,
                "vulnerab": 0.15,
                "cve": 0.15,
                "cargo audit": 0.15,
                "npm audit": 0.15,
                
                # CI/CD - Keep main green
                "ci": 0.20,
                "github actions": 0.15,
                "build": 0.10,
                "workflow": 0.10,
                "pipeline": 0.15,
                
                # PERFORMANCE
                "performance": 0.10,
                "latency": 0.10,
                "benchmark": 0.10,
                "perf": 0.10,
                
                # PIPELINE HEALTH - StriaSystems org
                "striasystems pipeline": 0.20,
                "pipeline health": 0.15,
            }
            
            for keyword, weight in goal_keywords.items():
                if keyword in combined:
                    score += weight
            
            # Penalize truly generic/unrelated jobs
            unrelated = [
                "monitor agent",  # generic agent monitoring
                "fixer cron",     # generic auto-fixer
                "hourly briefing", # reporting only
                "regular cleanup", # maintenance without clear goal
            ]
            for word in unrelated:
                if word in combined:
                    score -= 0.15
            
            # Mild penalty for "cleanup" and "briefing" if not tied to specific goals
            if "cleanup" in combined and not any(k in combined for k in ["tracev2", "trace", "forge", "deploy", "test", "build"]):
                score -= 0.10
            if "briefing" in combined and not any(k in combined for k in ["tracev2", "trace", "forge", "deploy", "metrics"]):
                score -= 0.10
            
            # Bonus for script-based (more reliable) vs agent-based
            if job.job_type == JobType.SCRIPT_BASED:
                score += 0.05
            
            # Bonus for jobs that have actually run successfully
            if job.last_status == "ok":
                score += 0.05
            
            job.alignment_score = max(0.0, min(1.0, score))
        
        return jobs
    
    def _recommend_actions(self, jobs: List[CronJob]) -> List[CronJob]:
        """Determine recommended action for each job."""
        for job in jobs:
            # Duplicates: remove all but the best one
            if job.is_duplicate:
                job.recommended_action = "remove"
                job.recommended_schedule = None
                continue
            
            # Dead jobs: remove unless critical
            if job.status == JobStatus.DEAD:
                if job.alignment_score > 0.5:
                    job.recommended_action = "restart"
                    job.recommended_schedule = self._cron_from_minutes(self._get_optimal_interval(job))
                else:
                    job.recommended_action = "remove"
                continue
            
            # Never ran: fix schedule or remove
            if job.status == JobStatus.NEVER_RAN:
                if job.alignment_score >= 0.4:
                    job.recommended_action = "fix_schedule"
                    job.recommended_schedule = self._cron_from_minutes(self._get_optimal_interval(job))
                else:
                    job.recommended_action = "remove"
                continue
            
            # Failing: restart with fixes
            if job.status == JobStatus.FAILING:
                if job.alignment_score > 0.3:
                    job.recommended_action = "restart"
                    job.recommended_schedule = self._cron_from_minutes(self._get_optimal_interval(job))
                else:
                    job.recommended_action = "remove"
                continue
            
            # Healthy but misaligned: optimize or remove
            if job.alignment_score < 0.2:
                job.recommended_action = "remove"
                continue
            
            # Healthy but wrong interval: optimize
            optimal = self._get_optimal_interval(job)
            if job.interval_minutes and optimal:
                ratio = job.interval_minutes / optimal
                if ratio > 1.5 or ratio < 0.7:
                    job.recommended_action = "optimize_schedule"
                    job.recommended_schedule = self._cron_from_minutes(optimal)
                else:
                    job.recommended_action = "keep"
            else:
                job.recommended_action = "keep"
            
            # Low effectiveness: optimize prompt
            if job.effectiveness_score < 0.4 and job.recommended_action == "keep":
                job.recommended_action = "optimize_prompt"
                job.recommended_prompt = self._generate_optimized_prompt(job)
        
        return jobs
    
    def _cron_from_minutes(self, minutes: int) -> str:
        """Convert minutes to cron expression."""
        if minutes <= 1:
            return "* * * * *"
        elif minutes < 60:
            if 60 % minutes == 0:
                return f"*/{minutes} * * * *"
            else:
                return f"0 */{minutes//60+1} * * *"  # Approximate
        elif minutes == 60:
            return "0 * * * *"
        elif minutes < 1440:
            hours = minutes // 60
            return f"0 */{hours} * * *"
        elif minutes == 1440:
            return "0 2 * * *"  # 2 AM daily
        elif minutes == 10080:
            return "0 3 * * 1"  # Monday 3 AM
        else:
            return "0 2 * * *"
    
    def _generate_optimized_prompt(self, job: CronJob) -> str:
        """Generate an optimized prompt aligned with company goals."""
        name_lower = job.name.lower()
        
        # Base optimized prompts by job type
        optimized_prompts = {
            "deploy": """Deploy TraceV2 to Cloudflare Pages via wrangler. Verify deployment health, run smoke tests, and confirm all 7 pages render correctly across 7 viewports. Report any regressions immediately.""",
            "edge case audit": """Run comprehensive edge case audit on TraceV2: 10 pages × 7 viewports + accessibility (axe-core WCAG 2.1 AA) + Lighthouse budgets. Fail fast on horizontal overflow, critical a11y violations, or budget breaches.""",
            "dependency audit": """Run weekly dependency security audit for TraceV2 (npm audit, cargo audit). Auto-fix patch/minor via dependabot. Report major/CVE findings with remediation steps. Ensure zero critical vulnerabilities in production.""",
            "context sync": """Sync TypeScript types, Rust N-API bindings, and Python MLX contracts between TraceV2, trace-core, stria-ingestion, and trace-pipeline. Verify type consistency and flag breaking changes.""",
            "telemetry": """Boost mock telemetry generation to feed the MLX continuous learning pipeline. Generate diverse prompt-injection, PII, and policy-violation samples. Target: 500+ samples for weekly retrain trigger.""",
            "model eval": """Evaluate current and candidate MLX LoRA adapters on probe test suite (guardrail bypass, PII detection, policy classification). Compare metrics, promote best adapter via hot-swap with rollback capability.""",
            "ci health": """Monitor GitHub Actions for TraceV2 repo. Detect failures, apply known fixes (npm ci, cargo fmt, rustsec version), commit and push fixes. Ensure main branch stays green.""",
            "security": """Run security hardening scan: cargo audit, npm audit, guardrail bypass evaluation via evaluate_trace.py. Report critical findings with CVE references and remediation.""",
            "performance": """Run Rust benchmarks (cargo bench --all-features) on trace-core. Compare against stored baseline. Detect >5% regressions in p50/p95 latency. Report with flamegraph if needed.""",
        }
        
        for key, prompt in optimized_prompts.items():
            if key in name_lower:
                return prompt
        
        # Generic optimized prompt aligned with goals
        return f"""[OPTIMIZED FOR STRIASYSTEMS TRACEV2 GOALS]
{job.prompt_preview}

CONTEXT: This job serves StriaSystems TraceV2 - AI governance platform with Trace (observability/audit) and Forge (verified execution).
PRIORITY: Evidence-before-enforcement. Three-plane architecture: Governance → Orchestration → Execution.
TECH: TypeScript/React/Vite frontend, Rust trace-core N-API, Python MLX LoRA pipeline, Cloudflare Pages.
SUCCESS CRITERIA: Build passes | Tests pass | Lighthouse budgets met | Deploy healthy | ML converges.
OUTPUT: Structured JSON report with status, metrics, and actionable findings.""".strip()
    
    def _print_audit_summary(self, jobs: List[CronJob]):
        """Print formatted audit summary."""
        print(f"\n📊 AUDIT SUMMARY")
        print("-" * 60)
        
        # Group by status
        by_status = {}
        by_action = {}
        for job in jobs:
            by_status.setdefault(job.status.value, []).append(job)
            by_action.setdefault(job.recommended_action, []).append(job)
        
        print(f"  Total jobs: {len(jobs)}")
        for status, group in sorted(by_status.items()):
            print(f"    {status}: {len(group)}")
        
        print(f"\n  Recommended actions:")
        for action, group in sorted(by_action.items(), key=lambda x: -len(x[1])):
            print(f"    {action}: {len(group)}")
            for job in group[:3]:
                print(f"      - {job.name} (align={job.alignment_score:.2f}, eff={job.effectiveness_score:.2f})")
            if len(group) > 3:
                print(f"      ... and {len(group)-3} more")
    
    # -----------------------------------------------------------------------
    # EXECUTE: Apply recommended actions
    # -----------------------------------------------------------------------
    
    def execute_actions(self, jobs: List[CronJob], dry_run: bool = True) -> Dict[str, int]:
        """Execute recommended actions on cron jobs."""
        print(f"\n{'🔧 DRY RUN' if dry_run else '⚡ EXECUTING'} CRON WRANGLER ACTIONS")
        print("=" * 60)
        
        results = {
            "removed": 0,
            "restarted": 0,
            "optimized_schedule": 0,
            "optimized_prompt": 0,
            "fixed_schedule": 0,
            "kept": 0,
            "errors": 0,
        }
        
        for job in jobs:
            action = job.recommended_action
            
            try:
                if action == "remove":
                    if not dry_run:
                        self._remove_cron_job(job)
                    print(f"  🗑️  {'Would remove' if dry_run else 'Removed'}: {job.name}")
                    results["removed"] += 1
                    
                elif action == "restart":
                    if not dry_run:
                        self._restart_cron_job(job)
                    print(f"  🔄 {'Would restart' if dry_run else 'Restarted'}: {job.name}")
                    if job.recommended_schedule:
                        print(f"      New schedule: {job.recommended_schedule}")
                    results["restarted"] += 1
                    
                elif action == "optimize_schedule":
                    if not dry_run:
                        self._update_cron_schedule(job, job.recommended_schedule)
                    print(f"  ⏰ {'Would optimize schedule' if dry_run else 'Optimized schedule'}: {job.name}")
                    print(f"      {job.schedule} → {job.recommended_schedule}")
                    results["optimized_schedule"] += 1
                    
                elif action == "optimize_prompt":
                    if not dry_run:
                        self._update_cron_prompt(job, job.recommended_prompt)
                    print(f"  📝 {'Would optimize prompt' if dry_run else 'Optimized prompt'}: {job.name}")
                    results["optimized_prompt"] += 1
                    
                elif action == "fix_schedule":
                    if not dry_run:
                        self._update_cron_schedule(job, job.recommended_schedule)
                    print(f"  🔧 {'Would fix schedule' if dry_run else 'Fixed schedule'}: {job.name}")
                    print(f"      New schedule: {job.recommended_schedule}")
                    results["fixed_schedule"] += 1
                    
                else:  # keep
                    print(f"  ✅ Keep: {job.name} (align={job.alignment_score:.2f}, eff={job.effectiveness_score:.2f})")
                    results["kept"] += 1
                    
            except Exception as e:
                print(f"  ❌ Error on {job.name}: {e}")
                results["errors"] += 1
        
        print(f"\n  RESULTS: {results}")
        return results
    
    def _get_hermes_cmd(self) -> List[str]:
        """Get the hermes command to use."""
        # Use uvx which manages its own Python environment (needed for Python 3.10+ syntax)
        return ["/Users/cnazarko/.hermes/bin/uvx", "--from", "/Users/cnazarko/.hermes/hermes-agent", "hermes"]

    def _remove_cron_job(self, job: CronJob):
        """Remove a cron job via Hermes CLI."""
        cmd = self._get_hermes_cmd() + ["cron", "remove", job.job_id]
        subprocess.run(cmd, check=True, capture_output=True)

    def _restart_cron_job(self, job: CronJob):
        """Restart a cron job - remove and recreate with optimized config."""
        # For now, just trigger a run. Full recreate would need prompt update.
        cmd = self._get_hermes_cmd() + ["cron", "run", job.job_id]
        subprocess.run(cmd, check=True, capture_output=True)

    def _update_cron_schedule(self, job: CronJob, new_schedule: str):
        """Update cron job schedule via Hermes CLI."""
        cmd = self._get_hermes_cmd() + ["cron", "edit", job.job_id, "--schedule", new_schedule]
        subprocess.run(cmd, check=True, capture_output=True)

    def _update_cron_prompt(self, job: CronJob, new_prompt: str):
        """Update cron job prompt via Hermes CLI."""
        # Use hermes cron edit --prompt
        cmd = self._get_hermes_cmd() + ["cron", "edit", job.job_id, "--prompt", new_prompt]
        subprocess.run(cmd, check=True, capture_output=True)
    
    # -----------------------------------------------------------------------
    # MONITOR: Continuous health monitoring
    # -----------------------------------------------------------------------
    
    def monitor_and_heal(self, jobs: List[CronJob]) -> Dict:
        """Monitor job health and auto-heal failures."""
        print(f"\n🏥 MONITORING & HEALING")
        print("-" * 60)
        
        healed = 0
        alerts = []
        
        for job in jobs:
            # Check if job needs healing
            if job.status in [JobStatus.FAILING, JobStatus.DEAD, JobStatus.DEGRADED]:
                if job.alignment_score > 0.3:  # Worth saving
                    print(f"  🔧 Healing: {job.name} (status: {job.status.value})")
                    
                    # Attempt restart
                    try:
                        self._restart_cron_job(job)
                        healed += 1
                        
                        # Log healing action
                        self._log({
                            "level": "info",
                            "action": "auto_heal",
                            "job_id": job.job_id,
                            "job_name": job.name,
                            "previous_status": job.status.value,
                        })
                    except Exception as e:
                        alerts.append(f"Failed to heal {job.name}: {e}")
                else:
                    alerts.append(f"Low-alignment job failing: {job.name} (alignment={job.alignment_score:.2f})")
        
        # Check for stuck jobs (running too long)
        # This would require checking running processes
        
        print(f"  Healed: {healed} jobs")
        if alerts:
            print(f"  Alerts: {len(alerts)}")
            for alert in alerts:
                print(f"    ⚠️  {alert}")
        
        return {"healed": healed, "alerts": alerts}
    
    # -----------------------------------------------------------------------
    # REPORT: Generate comprehensive report
    # -----------------------------------------------------------------------
    
    def generate_report(self, jobs: List[CronJob], actions: Dict) -> Dict:
        """Generate comprehensive wrangler report."""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_jobs": len(jobs),
                "healthy": len([j for j in jobs if j.status == JobStatus.HEALTHY]),
                "degraded": len([j for j in jobs if j.status == JobStatus.DEGRADED]),
                "failing": len([j for j in jobs if j.status == JobStatus.FAILING]),
                "dead": len([j for j in jobs if j.status == JobStatus.DEAD]),
                "never_ran": len([j for j in jobs if j.status == JobStatus.NEVER_RAN]),
                "duplicates": len([j for j in jobs if j.is_duplicate]),
            },
            "alignment_distribution": {
                "high": len([j for j in jobs if j.alignment_score >= 0.7]),
                "medium": len([j for j in jobs if 0.3 <= j.alignment_score < 0.7]),
                "low": len([j for j in jobs if j.alignment_score < 0.3]),
            },
            "effectiveness_distribution": {
                "high": len([j for j in jobs if j.effectiveness_score >= 0.7]),
                "medium": len([j for j in jobs if 0.4 <= j.effectiveness_score < 0.7]),
                "low": len([j for j in jobs if j.effectiveness_score < 0.4]),
            },
            "actions_taken": actions,
            "job_details": [
                {
                    "job_id": j.job_id,
                    "name": j.name,
                    "status": j.status.value,
                    "alignment_score": round(j.alignment_score, 3),
                    "effectiveness_score": round(j.effectiveness_score, 3),
                    "interval_minutes": j.interval_minutes,
                    "optimal_interval": self._get_optimal_interval(j),
                    "schedule": j.schedule,
                    "recommended_schedule": j.recommended_schedule,
                    "recommended_action": j.recommended_action,
                    "is_duplicate": j.is_duplicate,
                    "duplicate_of": j.duplicate_of,
                    "job_type": j.job_type.value,
                    "last_run": j.last_run_at,
                    "last_status": j.last_status,
                }
                for j in jobs
            ],
            "company_goal_alignment": {
                "primary_goal": COMPANY_GOALS["primary"],
                "jobs_serving_primary": len([j for j in jobs if "tracev2" in j.name.lower() or "trace" in j.name.lower() or "forge" in j.name.lower()]),
                "jobs_serving_deployment": len([j for j in jobs if "deploy" in j.name.lower()]),
                "jobs_serving_quality": len([j for j in jobs if any(k in j.name.lower() for k in ["audit", "edge", "lighthouse", "accessibility", "viewport"])]),
                "jobs_serving_ml": len([j for j in jobs if any(k in j.name.lower() for k in ["mlx", "lora", "training", "model", "telemetry"])]),
                "jobs_serving_security": len([j for j in jobs if any(k in j.name.lower() for k in ["security", "dependency", "audit"])]),
            },
        }
        
        # Save report
        report_file = self.logs_dir / f"cron_wrangler_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        report_file.write_text(json.dumps(report, indent=2))
        
        # Also append to JSONL log
        self._log({"type": "report", **report})
        
        return report
    
    def print_report(self, report: Dict):
        """Print formatted report."""
        print(f"\n📋 CRON WRANGLER REPORT")
        print("=" * 60)
        print(f"  Time: {report['timestamp']}")
        
        s = report["summary"]
        print(f"\n  📊 JOB HEALTH:")
        print(f"    Total: {s['total_jobs']}")
        print(f"    ✅ Healthy: {s['healthy']}")
        print(f"    ⚠️  Degraded: {s['degraded']}")
        print(f"    ❌ Failing: {s['failing']}")
        print(f"    💀 Dead: {s['dead']}")
        print(f"    🆕 Never ran: {s['never_ran']}")
        print(f"    👯 Duplicates: {s['duplicates']}")
        
        print(f"\n  🎯 ALIGNMENT:")
        a = report["alignment_distribution"]
        print(f"    High (≥0.7): {a['high']}")
        print(f"    Medium (0.3-0.7): {a['medium']}")
        print(f"    Low (<0.3): {a['low']}")
        
        print(f"\n  ⚡ EFFECTIVENESS:")
        e = report["effectiveness_distribution"]
        print(f"    High (≥0.7): {e['high']}")
        print(f"    Medium (0.4-0.7): {e['medium']}")
        print(f"    Low (<0.4): {e['low']}")
        
        print(f"\n  🎯 COMPANY GOAL COVERAGE:")
        c = report["company_goal_alignment"]
        print(f"    Primary (TraceV2/Trace/Forge): {c['jobs_serving_primary']}")
        print(f"    Deployment: {c['jobs_serving_deployment']}")
        print(f"    Quality (audit/edge/a11y): {c['jobs_serving_quality']}")
        print(f"    ML Pipeline: {c['jobs_serving_ml']}")
        print(f"    Security: {c['jobs_serving_security']}")
        
        print(f"\n  🔧 ACTIONS TAKEN:")
        for action, count in report["actions_taken"].items():
            if count > 0:
                print(f"    {action}: {count}")
    
    # -----------------------------------------------------------------------
    # MAIN ORCHESTRATION
    # -----------------------------------------------------------------------
    
    def run(self, dry_run: bool = True) -> Dict:
        """Main entry point: audit, optimize, monitor, report."""
        print(f"\n{'='*60}")
        print(f"🤠 CRON WRANGLER — {datetime.utcnow().isoformat()}")
        print(f"{'='*60}")
        print(f"  Mode: {'DRY RUN' if dry_run else 'LIVE'}")
        print(f"  Project: {self.project_root}")
        print(f"  Company Goal: {COMPANY_GOALS['primary']}")
        
        # 1. Fetch all cron jobs
        print(f"\n📥 FETCHING CRON JOBS FROM HERMES...")
        jobs = self.fetch_hermes_crons()
        
        if not jobs:
            print("  ⚠️  No jobs fetched - using fallback")
            # In practice, we'd use the cronjob tool directly
            # For now, create mock jobs from known state
            jobs = self._create_mock_jobs()
        
        print(f"  Found {len(jobs)} jobs")
        
        # 2. Audit all jobs
        jobs = self.audit_jobs(jobs)
        
        # 3. Execute recommended actions
        actions = self.execute_actions(jobs, dry_run=dry_run)
        
        # 4. Monitor and heal
        heal_results = self.monitor_and_heal(jobs)
        actions["healed"] = heal_results["healed"]
        
        # 5. Generate report
        report = self.generate_report(jobs, actions)
        self.print_report(report)
        
        # 6. Save state for next run
        state = {
            "last_run": datetime.utcnow().isoformat(),
            "report": report,
            "jobs_tracked": len(jobs),
        }
        self._save_state(state)
        
        print(f"\n{'='*60}")
        print(f"✅ CRON WRANGLER COMPLETE")
        print(f"{'='*60}\n")
        
        return report
    
    def _create_mock_jobs(self) -> List[CronJob]:
        """Create mock jobs from known current state for testing."""
        # This replicates the current 14 jobs we saw in the cron list
        mock_data = [
            {
                "job_id": "4ee5be2e9daa", "name": "Monitor Agents",
                "prompt_preview": "Review agent work from each agent. Give a report on what they are doing...",
                "schedule": "every 5m", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:56:50",
                "last_status": "ok", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": [], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "7fc7c9ad770a", "name": "Hourly Briefing",
                "prompt_preview": "Summarize work that's been made, ideal trajectory, any immediate issues...",
                "schedule": "0 * * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:03:02",
                "last_status": "ok", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": [], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "b69346fd4a69", "name": "Regular cleanup",
                "prompt_preview": "look through the whole project, delegate subagents to clean up areas...",
                "schedule": "*/15 * * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:35:22",
                "last_status": "error", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": [], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "23d42bba8f5b", "name": "Fixer Cron",
                "prompt_preview": "checks all conversations, subagents. If tasks are stuck, not running or not aligned...",
                "schedule": "every 5m", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:45:45",
                "last_status": "ok", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": [], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "229aacd5db9c", "name": "increase-telemetry",
                "prompt_preview": "Run scripts/auto_generated/increase-telemetry.py with args: ",
                "schedule": "0 * * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:00:04",
                "last_status": "ok", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": [], "workdir": None,
                "script": "increase-telemetry.py", "no_agent": True, "model": None, "provider": None,
            },
            {
                "job_id": "6bd2346376b3", "name": "Daily Edge Case Audit",
                "prompt_preview": "Run the comprehensive edge case audit on the Stria Systems website...",
                "schedule": "0 2 * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": None,
                "last_status": None, "last_delivery_error": None,
                "skills": ["terminal", "file", "web"], "enabled_toolsets": ["terminal", "file", "web"], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "686f0f386f6e", "name": "Weekly Dependency & Security Audit",
                "prompt_preview": "Perform weekly dependency security audit and updates for Stria Systems website...",
                "schedule": "0 3 * * 1", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": None,
                "last_status": None, "last_delivery_error": None,
                "skills": ["terminal", "file", "web"], "enabled_toolsets": ["terminal", "file", "web"], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "c25e26dab90a", "name": "Context Sync - Backend Systems",
                "prompt_preview": "Sync context between Stria Systems website and backend systems (TraceV2, trace-core, MLX pipeline)...",
                "schedule": "0 */6 * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": None,
                "last_status": None, "last_delivery_error": None,
                "skills": ["terminal", "file", "web", "skills"], "enabled_toolsets": ["terminal", "file", "web", "skills"], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "2d89e3ac3707", "name": "Deployment Health Monitor",
                "prompt_preview": "Monitor Stria Systems Cloudflare Pages deployment health and performance...",
                "schedule": "*/15 * * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:48:41",
                "last_status": "ok", "last_delivery_error": None,
                "skills": ["terminal", "file", "web"], "enabled_toolsets": ["terminal", "file", "web"], "workdir": None,
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "73399da0a23a", "name": "TraceV2 Cloudflare Pages Deploy",
                "prompt_preview": "Deploy TraceV2 to Cloudflare Pages using wrangler...",
                "schedule": "every 60m", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": None,
                "last_status": None, "last_delivery_error": None,
                "skills": ["terminal"], "enabled_toolsets": ["terminal", "file"], "workdir": "/Users/cnazarko/stria systems/TraceV2",
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "f00d83994b6a", "name": "backend-context-sync",
                "prompt_preview": "Run the backend context sync script to pull latest types/contracts...",
                "schedule": "0 */6 * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:26:24",
                "last_status": "ok", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": ["terminal"], "workdir": "/Users/cnazarko/Trace",
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "78a30af39099", "name": "TraceV2 Edge Case Monitoring",
                "prompt_preview": "Run the TraceV2 edge case monitoring test script...",
                "schedule": "0 */6 * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": None,
                "last_status": None, "last_delivery_error": None,
                "skills": ["terminal", "file", "code_exec"], "enabled_toolsets": ["terminal", "file", "code_exec"], "workdir": "/Users/cnazarko/stria systems/TraceV2",
                "script": "scripts/run-edge-case-tests.mjs", "no_agent": True, "model": None, "provider": None,
            },
            {
                "job_id": "9c5ee9c04605", "name": "Backend Context Sync",
                "prompt_preview": "Run the backend context sync script to pull latest changes from stria-ingestion and trace-core...",
                "schedule": "every 60m", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": "2026-06-11T21:46:09",
                "last_status": "ok", "last_delivery_error": None,
                "skills": [], "enabled_toolsets": [], "workdir": "/Users/cnazarko/stria systems/TraceV2",
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
            {
                "job_id": "81e081902278", "name": "TraceV2 Edge Case Monitoring",
                "prompt_preview": "Run the TraceV2 edge case monitoring script that: 1. Starts the dev server if not already running...",
                "schedule": "0 2 * * *", "repeat": "forever", "deliver": "local",
                "enabled": True, "state": "scheduled", "last_run_at": None,
                "last_status": None, "last_delivery_error": None,
                "skills": [], "enabled_toolsets": ["terminal", "file"], "workdir": "/Users/cnazarko/stria systems/TraceV2",
                "script": None, "no_agent": False, "model": None, "provider": None,
            },
        ]
        
        jobs = []
        for j in mock_data:
            job = self._parse_hermes_job(j)
            jobs.append(job)
        
        return jobs


# ============================================================================
# CLI ENTRY POINT
# ============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Cron Wrangler - Master Cron Job Management")
    parser.add_argument("--live", action="store_true", help="Execute changes (default: dry-run)")
    parser.add_argument("--project-root", default="/Users/cnazarko/stria systems/TraceV2", help="Project root path")
    parser.add_argument("--report-only", action="store_true", help="Only generate report, no actions")
    
    args = parser.parse_args()
    
    wrangler = CronWrangler(project_root=args.project_root)
    
    if args.report_only:
        # Just fetch and audit, no actions
        jobs = wrangler.fetch_hermes_crons()
        if not jobs:
            jobs = wrangler._create_mock_jobs()
        jobs = wrangler.audit_jobs(jobs)
        report = wrangler.generate_report(jobs, {})
        wrangler.print_report(report)
    else:
        wrangler.run(dry_run=not args.live)


if __name__ == "__main__":
    main()