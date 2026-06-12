# Meta-Monitoring Architecture Code Review

## Existing Components Analysis

### 1. meta_effectiveness_scorer.py ✅ GOOD STANDING

**Strengths:**
- Clean SQLite schema with proper indexes
- Well-structured dataclasses for MonitorFinding, RetrainOutcome, ProductionMetrics
- Computes composite effectiveness scores (precision, recall, coverage, p50_trend)
- Logs meta-rewards for RL training loop

**Issues Found:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| Missing `import statistics` used but not imported in all contexts | Medium | Line 14, 238 | Already imported at line 14 |
| `validated` column in `monitor_findings` never set to 1 (no validation workflow) | High | Line 71, 188 | Need validation mechanism |
| `false_positives` hardcoded to 0 in `log_meta_reward` | Medium | Line 282 | Need FP detection logic |
| `perf_delta_p99` always 0 (no p99 delta computation) | Medium | Line 284 | Add p99 trend calc |
| `analysis_id` foreign key but no `analysis` table | Low | Line 70 | Consider adding analysis table |
| No connection pooling for high-frequency access | Low | Throughout | Consider `sqlite3.connect` with `check_same_thread=False` |

**Integration Gaps:**
- No way to mark findings as `validated` with `validation_outcome`
- `ProductionMetrics` logging needs producer (telemetry API or MLX server)
- `RetrainOutcome` expects `adapter_version` but training scripts use timestamp-based names
- Missing `--discover-gaps` CLI flag referenced in fallback cron

---

### 2. meta_intent_classifier.py ✅ GOOD STANDING

**Strengths:**
- Comprehensive intent categories with priorities and schedules
- Hermes/MLX integration with structured prompts
- Robust fallback classification (rule-based)
- Cron job generation with fallback templates
- Actual crontab installation via `subprocess`

**Issues Found:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| `requests` imported inside functions (lines 177, 235, 339) | Medium | Multiple | Move to top-level |
| Hardcoded project path `/Users/cnazarko/stria systems/TraceV2` | High | Line 349 | Use `Path.cwd()` or env var |
| Hardcoded Python path to `.venv-mlx/bin/python` | High | Line 350 | Use `sys.executable` or detect venv |
| `MLX_SERVER_URL` default is `localhost:9001` but server runs on 9001 ✓ | - | Line 19 | Correct |
| Cron command uses `evaluate_trace.py --focus` flags that don't exist | High | Lines 389, 398, 407, 416 | Add flags to `evaluate_trace.py` |
| Cron command references `meta_effectiveness_scorer.py --discover-gaps` flag missing | High | Line 425 | Add flag to scorer |
| No deduplication logic for spawned cron jobs (only checks job_id) | Medium | Line 462 | Check schedule+command too |
| `ROLLBACK_COMMAND` uses `scripts.hot_swap` but import path differs | Medium | Line 438 | Fix import path |
| No cleanup for old/expired cron jobs | Medium | - | Add TTL/reaper |

**Integration Gaps:**
- `fetch_meta_state()` reads `.trace/meta/meta_state.json` but nothing writes it
- `fetch_recent_telemetry_summary()` calls `/summary` endpoint that doesn't exist in telemetry API
- `INTENT_LOG` and `SPAWNED_JOBS_LOG` written but never read/analyzed
- No coordination with `meta_cron_orchestrator` (doesn't exist yet)

---

### 3. evaluate_trace.py (Existing Flywheel) ✅ GOOD STANDING

**Issues Found:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| `--focus`, `--deep`, `--audit`, `--harvest`, `--harden`, `--force-retrain` flags referenced but not implemented | High | Referenced in meta_intent_classifier fallback | Add argparse flags |
| `train-trace-mlx.sh` called but path handling could break | Medium | Line 147 | Use absolute paths |
| `hot_swap_model()` only prints instruction, doesn't actually restart server | High | Line 165-171 | Integrate with `hot_swap.py` |
| Telemetry API endpoint `/summary` doesn't exist | Medium | N/A | Add to trace_telemetry_api.py |

---

### 4. hot_swap.py (Existing) ✅ GOOD STANDING

**Issues Found:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| Health check uses `/health` but MLX server on 9001 may not have it | Medium | Line 125 | Verify endpoint exists |
| `mlx_fastapi_server.py` referenced but may not exist | High | Line 19 | Check actual server script |
| No rollback verification | Low | Line 145 | Add post-rollback health check |

---

### 5. train_trigger.py (Existing) ⚠️ NEEDS WORK

**Issues Found:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| References `build_enterprise_corpus.py` which may not exist | High | Line 101 | Verify path |
| `hot_swap_model` just prints, doesn't call actual hot-swap | High | Line 110-117 | Call `hot_swap.py` |
| Uses `scripts/train-trace-mlx.sh` but path may vary | Medium | Line 66 | Use absolute path |

---

### 6. trace_telemetry_api.py (Mock Server) ✅ GOOD FOR DEV

**Issues Found:**
| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| No `/summary` endpoint (called by meta_intent_classifier) | High | - | Add endpoint |
| Mock data only - not connected to real Trace backend | Medium | - | Document as dev-only |

---

## Missing Components (Need Creation)

### 3. meta_cron_orchestrator.py — MISSING
**Purpose:** Runs every 30 min, orchestrates the full meta-monitoring loop
**Required Functions:**
- Call `meta_effectiveness_scorer.compute_effectiveness()`
- Call `meta_intent_classifier.main()` 
- Log meta-state to `.trace/meta/meta_state.json`
- Manage cron job lifecycle (install, monitor, expire)
- Coordinate with RL trainer (weekly trigger)

### 4. cron_templates/generator.py — MISSING
**Purpose:** Template system for auto-generating cron scripts
**Required Functions:**
- Template rendering for each intent category
- Jinja2 or string.Template based
- Validation of generated scripts
- dry-run mode

### 5. meta_rl_trainer.py — MISSING
**Purpose:** Weekly policy training on meta-rewards
**Required Functions:**
- Read `meta_rewards` table from meta DB
- Train a policy (could be simple bandit or small NN)
- Output policy to `.trace/meta/policy.json`
- Used by orchestrator for action selection

---

## Critical Integration Gaps Summary

| Gap | Components Affected | Resolution |
|-----|---------------------|------------|
| No `meta_state.json` writer | meta_intent_classifier → meta_cron_orchestrator | Add writer in orchestrator |
| No `/summary` telemetry endpoint | meta_intent_classifier | Add to trace_telemetry_api.py |
| Missing CLI flags in evaluate_trace.py | meta_intent_classifier fallback crons | Add argparse to evaluate_trace.py |
| Missing `--discover-gaps` in scorer | meta_intent_classifier fallback | Add to meta_effectiveness_scorer.py |
| Hot-swap not actually integrated | evaluate_trace, train_trigger, meta_intent_classifier | Use hot_swap.py module |
| Cron job cleanup/reaper missing | meta_intent_classifier | Add to orchestrator |
| No validation workflow for findings | meta_effectiveness_scorer | Add validation CLI/API |
| RL trainer doesn't exist | Full loop closure | Create meta_rl_trainer.py |

---

## Priority Fix Order

1. **CRITICAL** - Create `meta_cron_orchestrator.py` (glue layer)
2. **CRITICAL** - Create `cron_templates/generator.py` (templating)
3. **CRITICAL** - Create `meta_rl_trainer.py` (RL closure)
4. **HIGH** - Fix hardcoded paths in meta_intent_classifier.py
5. **HIGH** - Add missing CLI flags to evaluate_trace.py
6. **HIGH** - Add `/summary` endpoint to trace_telemetry_api.py
6. **HIGH** - Integrate real hot-swap in evaluate_trace.py and train_trigger.py
7. **MEDIUM** - Add validation workflow to meta_effectiveness_scorer.py
8. **MEDIUM** - Add cron job TTL/reaper in orchestrator
9. **LOW** - Move inline imports to top-level
10. **LOW** - Add connection pooling for SQLite