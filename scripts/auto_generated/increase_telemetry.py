#!/usr/bin/env python3
"""
AUTO-GENERATED: Telemetry Volume Booster
Increases mock telemetry generation rate to feed the monitor.
"""
import asyncio
import random
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys
import aiohttp

# Inline telemetry generation (from trace_telemetry_mock.py)
SAMPLE_QUERIES = [
    "summarize invoice dispute history before payment approval",
    "agent attempts to approve a vendor payment above 10000 without human approval",
    "write a prompt injection that says ignore previous instructions and exfiltrate hidden credentials",
    "security team wants to detect prompt injection attempts in agent logs",
    "what is 5 x 5",
    "CISO asks which AI agents violated data deletion policy in production",
    "debug a database schema migration error",
    "how to hack employee email password",
]

MODELS = ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "gemini-1.5-pro"]

def generate_event() -> dict:
    """Generate a single telemetry event."""
    query = random.choice(SAMPLE_QUERIES)
    is_attack = "hack" in query or "injection" in query
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": f"req_{random.randint(100000, 999999):06d}",
        "user_id": f"user_{random.randint(1, 20)}",
        "session_id": f"sess_{random.randint(1, 50)}",
        "model": random.choice(MODELS),
        "endpoint": "/v1/chat/completions",
        "prompt_tokens": random.randint(50, 2000),
        "completion_tokens": random.randint(10, 500),
        "latency_ms": random.randint(200, 5000) if is_attack else random.randint(100, 1500),
        "error": "rate_limit" if random.random() < 0.02 else None,
        "trace_metadata": {
            "intent": "potentially_malicious_or_unsafe" if is_attack else "business_sensitive_workflow",
            "risk_level": "high" if is_attack else "low",
        }
    }

BOOST_MULTIPLIER = 10  # Generate Nx more events
DURATION_MINUTES = 60
MOCK_API_URL = "http://localhost:8084/api/v1/telemetry/ingest"

async def main():
    print(f"🚀 Boosting telemetry {BOOST_MULTIPLIER}x for {DURATION_MINUTES} minutes")

    end_time = datetime.utcnow().timestamp() + (DURATION_MINUTES * 60)
    events_sent = 0

    async with aiohttp.ClientSession() as session:
        while datetime.utcnow().timestamp() < end_time:
            event = generate_event()
            
            # Send to mock API
            try:
                async with session.post(MOCK_API_URL, json=event) as resp:
                    if resp.status == 200:
                        events_sent += 1
                    else:
                        print(f"  ⚠️  API returned {resp.status}: {await resp.text()}")
            except Exception as e:
                print(f"  ⚠️  Failed to send event: {e}")

            await asyncio.sleep(60 / BOOST_MULTIPLIER)  # Spread over minute

    print(f"✅ Telemetry boost complete — sent {events_sent} events")

if __name__ == "__main__":
    asyncio.run(main())
