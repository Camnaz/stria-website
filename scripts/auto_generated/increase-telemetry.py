#!/usr/bin/env python3
"""
AUTO-GENERATED: Telemetry Volume Booster
Increases mock telemetry generation rate to feed the monitor.
"""
import asyncio
import random
import json
from datetime import datetime
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from trace_telemetry_mock import TEMPLATES, generate_event

BOOST_MULTIPLIER = 10  # Generate Nx more events
DURATION_MINUTES = 60

async def main():
    print(f"🚀 Boosting telemetry {{BOOST_MULTIPLIER}}x for {{DURATION_MINUTES}} minutes")

    templates = list(TEMPLATES.values())
    end_time = datetime.utcnow().timestamp() + (DURATION_MINUTES * 60)

    while datetime.utcnow().timestamp() < end_time:
        template = random.choice(templates)
        event = generate_event(template)

        # Send to mock API (or directly to Trace)
        # This would POST to http://localhost:8084/api/v1/telemetry/ingest

        await asyncio.sleep(60 / BOOST_MULTIPLIER)  # Spread over minute

    print("✅ Telemetry boost complete")

if __name__ == "__main__":
    asyncio.run(main())
