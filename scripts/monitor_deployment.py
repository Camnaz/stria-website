#!/usr/bin/env python3
"""
Stria Systems Cloudflare Pages Deployment Health Monitor

Checks every 15 minutes:
1. HTTP 200 on all 7 pages (home, trace, forge, platform, architecture, docs, demo)
2. Response time < 2s (p95)
3. Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms
4. SSL certificate validity > 30 days
5. Cloudflare Pages deployment status
6. No 5xx errors in last hour

Alerting:
- Slack notification on any failure
- Auto-create GitHub issue for persistent failures (> 3 consecutive)
- PagerDuty for critical (production down)

Metrics stored in: deployment-health-$(date +%Y-%m).json
"""

import json
import subprocess
import sys
import time
import ssl
import socket
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Dict, List, Any, Optional

# Alert configuration from environment
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Camnaz/StriaSystems")
PAGERDUTY_INTEGRATION_KEY = os.environ.get("PAGERDUTY_INTEGRATION_KEY")
CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
CLOUDFLARE_ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID")


PAGES = ["", "trace", "forge", "platform", "architecture", "docs", "demo"]
PAGE_NAMES = ["home", "trace", "forge", "platform", "architecture", "docs", "demo"]
BASE_URL = "https://striasystems.com"
THRESHOLDS = {
    "response_time_p95": 2.0,  # seconds
    "ssl_days_min": 30,
    "lcp_max": 2.5,  # seconds
    "cls_max": 0.1,
    "fid_max": 100,  # milliseconds
}


def run_cmd(cmd: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def check_http_pages() -> Dict[str, Any]:
    """Check HTTP 200 on all pages and measure response times."""
    results = {}
    all_ok = True
    
    for page, name in zip(PAGES, PAGE_NAMES):
        url = f"{BASE_URL}/{page}" if page else BASE_URL
        times = []
        errors = 0
        http_codes = []
        
        # Run 10 samples per page
        for _ in range(10):
            try:
                result = run_cmd(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{time_total}", url], timeout=10)
                output = result.stdout.strip()
                if output:
                    parts = output.split()
                    http_code = int(parts[0])
                    total_time = float(parts[1])
                    http_codes.append(http_code)
                    if 200 <= http_code < 300:
                        times.append(total_time)
                    else:
                        errors += 1
                else:
                    errors += 1
            except Exception:
                errors += 1
            time.sleep(0.1)
        
        if times:
            times.sort()
            n = len(times)
            # p95 = 95th percentile
            p95_idx = int(0.95 * (n - 1))
            p50_idx = int(0.50 * (n - 1))
            p95 = times[min(p95_idx, n - 1)]
            p50 = times[min(p50_idx, n - 1)]
            
            page_ok = (errors == 0) and (p95 < THRESHOLDS["response_time_p95"])
            all_ok = all_ok and page_ok
            
            results[name] = {
                "url": url,
                "status": "healthy" if page_ok else "degraded",
                "http_codes": http_codes,
                "samples": len(times),
                "errors": errors,
                "p50_ms": round(p50 * 1000),
                "p95_ms": round(p95 * 1000),
                "min_ms": round(min(times) * 1000),
                "max_ms": round(max(times) * 1000),
                "avg_ms": round(sum(times) / len(times) * 1000),
            }
        else:
            all_ok = False
            results[name] = {
                "url": url,
                "status": "failed",
                "http_codes": http_codes,
                "samples": 0,
                "errors": 10,
            }
    
    return {"pages": results, "overall": "healthy" if all_ok else "degraded"}


def check_ssl_certificate() -> Dict[str, Any]:
    """Check SSL certificate validity."""
    try:
        # Use openssl with pipe to get certificate dates
        # First get the cert, then parse it
        p1 = subprocess.Popen(
            ["openssl", "s_client", "-servername", "striasystems.com", "-connect", "striasystems.com:443"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        p2 = subprocess.Popen(
            ["openssl", "x509", "-noout", "-dates"],
            stdin=p1.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        p1.stdout.close()
        stdout, _ = p2.communicate(timeout=10)
        output = stdout.decode().strip()
        
        # Parse dates from output
        not_before = ""
        not_after = ""
        for line in output.split("\n"):
            if line.startswith("notBefore="):
                not_before = line.replace("notBefore=", "").strip()
            elif line.startswith("notAfter="):
                not_after = line.replace("notAfter=", "").strip()
        
        if not_after:
            exp_date = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            days_remaining = (exp_date - datetime.now(timezone.utc)).days
            ok = days_remaining > THRESHOLDS["ssl_days_min"]
            
            return {
                "status": "healthy" if ok else "degraded",
                "not_before": not_before,
                "not_after": not_after,
                "days_remaining": days_remaining,
                "threshold_days": THRESHOLDS["ssl_days_min"],
            }
        else:
            return {"status": "unknown", "error": "Could not parse certificate dates", "raw_output": output}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def check_cloudflare_deployment() -> Dict[str, Any]:
    """Check Cloudflare Pages deployment status."""
    try:
        result = run_cmd([
            "npx", "wrangler", "pages", "deployment", "list",
            "--project-name", "stria-systems"
        ], timeout=30)
        
        # Parse the table output
        lines = result.stdout.strip().split("\n")
        deployments = []
        for line in lines:
            if "│" in line and "Production" in line:
                parts = [p.strip() for p in line.split("│")[1:-1]]
                if len(parts) >= 6:
                    deployments.append({
                        "id": parts[0],
                        "environment": parts[1],
                        "branch": parts[2],
                        "source": parts[3],
                        "url": parts[4],
                        "age": parts[5],
                    })
        
        if deployments:
            latest = deployments[0]
            # Check if latest deployment is recent (within last 24h)
            age_str = latest["age"]
            is_recent = "hour" in age_str.lower() or "minute" in age_str.lower()
            
            return {
                "status": "healthy" if is_recent else "stale",
                "latest_deployment": latest,
                "total_deployments": len(deployments),
                "deployments": deployments[:5],  # Last 5
            }
        else:
            return {"status": "unknown", "error": "No deployments found"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def check_core_web_vitals() -> Dict[str, Any]:
    """Check Core Web Vitals using Lighthouse CI (if available) or CrUX API."""
    # Try Lighthouse first with output to file to avoid stdout pollution
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        result = run_cmd([
            "npx", "lighthouse", BASE_URL,
            f"--output=json", f"--output-path={tmp_path}",
            "--quiet",
            "--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-web-security --disable-features=IsolateOrigins,site-per-process --user-agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'",
            "--only-categories=performance"
        ], timeout=180)
        
        # Read the JSON output file
        try:
            with open(tmp_path, 'r') as f:
                lighthouse_data = json.load(f)
        except Exception as e:
            lighthouse_data = {}
        
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        
        # Check if Lighthouse ran successfully (no runtimeError)
        if lighthouse_data.get("runtimeError"):
            return {
                "status": "unknown",
                "error": f"Lighthouse runtime error: {lighthouse_data['runtimeError'].get('message', 'Unknown')}",
                "note": "Core Web Vitals require Lighthouse (site may block headless Chrome) or CrUX API key"
            }
        
        audits = lighthouse_data.get("audits", {})
        categories = lighthouse_data.get("categories", {})
        
        lcp = audits.get("largest-contentful-paint", {})
        cls = audits.get("cumulative-layout-shift", {})
        fid = audits.get("max-potential-fid", {})
        
        lcp_score = lcp.get("score")
        cls_score = cls.get("score")
        fid_score = fid.get("score")
        
        # Get numeric values
        lcp_val = lcp.get("numericValue", 0) / 1000 if lcp.get("numericValue") else 0  # Convert to seconds
        cls_val = cls.get("numericValue", 0)
        fid_val = fid.get("numericValue", 0)
        
        lcp_ok = lcp_val <= THRESHOLDS["lcp_max"]
        cls_ok = cls_val <= THRESHOLDS["cls_max"]
        fid_ok = fid_val <= THRESHOLDS["fid_max"]
        
        return {
            "status": "healthy" if (lcp_ok and cls_ok and fid_ok) else "degraded",
            "lcp": {"value": round(lcp_val, 2), "threshold": THRESHOLDS["lcp_max"], "ok": lcp_ok, "score": lcp_score},
            "cls": {"value": round(cls_val, 4), "threshold": THRESHOLDS["cls_max"], "ok": cls_ok, "score": cls_score},
            "fid": {"value": round(fid_val), "threshold": THRESHOLDS["fid_max"], "ok": fid_ok, "score": fid_score},
            "performance_score": categories.get("performance", {}).get("score"),
            "source": "lighthouse",
        }
    except Exception as e:
        # Clean up temp file on error
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        
        # Try CrUX API as fallback (requires API key)
        return {
            "status": "unknown",
            "error": f"Lighthouse failed: {str(e)[:200]}",
            "note": "Core Web Vitals require Lighthouse or CrUX API key"
        }


def check_5xx_errors() -> Dict[str, Any]:
    """Check for 5xx errors in the last hour using Cloudflare GraphQL Analytics API."""
    if not CLOUDFLARE_API_TOKEN or not CLOUDFLARE_ZONE_ID:
        return {
            "status": "unknown",
            "note": "5xx error checking requires Cloudflare API token with Analytics/Logs access",
            "recommendation": "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID environment variables"
        }
    
    try:
        # GraphQL query for 5xx errors in the last hour
        query = """
        query {
            viewer {
                zones(filter: {zoneTag: "%s"}) {
                    httpRequests1hGroups(limit: 1000, filter: {edgeResponseStatus_gte: 500, edgeResponseStatus_lt: 600}, orderBy: [sum_bytes_DESC]) {
                        sum {
                            requests
                        }
                        dimensions {
                            edgeResponseStatus
                            clientRequestHTTPHost
                            clientRequestPath
                        }
                    }
                }
            }
        }
        """ % CLOUDFLARE_ZONE_ID
        
        import urllib.request
        import urllib.parse
        
        url = "https://api.cloudflare.com/client/v4/graphql"
        data = json.dumps({"query": query}).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode())
        
        # Parse results
        total_5xx = 0
        errors_by_status = {}
        errors_by_path = {}
        
        zones = result.get("data", {}).get("viewer", {}).get("zones", [])
        for zone in zones:
            for group in zone.get("httpRequests1hGroups", []):
                count = group.get("sum", {}).get("requests", 0)
                total_5xx += count
                dims = group.get("dimensions", {})
                status = dims.get("edgeResponseStatus", "unknown")
                path = dims.get("clientRequestPath", "unknown")
                errors_by_status[status] = errors_by_status.get(status, 0) + count
                errors_by_path[path] = errors_by_path.get(path, 0) + count
        
        if total_5xx == 0:
            return {
                "status": "healthy",
                "total_5xx": 0,
                "errors_by_status": {},
                "errors_by_path": {},
            }
        else:
            return {
                "status": "degraded",
                "total_5xx": total_5xx,
                "errors_by_status": errors_by_status,
                "errors_by_path": dict(sorted(errors_by_path.items(), key=lambda x: x[1], reverse=True)[:10]),
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "note": "Cloudflare API query failed"
        }


def save_metrics(metrics: Dict[str, Any], output_dir: Path) -> Path:
    """Save metrics to monthly JSON file."""
    month_str = datetime.now().strftime("%Y-%m")
    filepath = output_dir / f"deployment-health-{month_str}.json"
    
    # Load existing data if any
    existing_data = []
    if filepath.exists():
        try:
            with open(filepath, "r") as f:
                existing_data = json.load(f)
            if not isinstance(existing_data, list):
                existing_data = []
        except Exception:
            existing_data = []
    
    # Append new metric
    existing_data.append(metrics)
    
    # Keep only last 1000 entries to prevent unbounded growth
    if len(existing_data) > 1000:
        existing_data = existing_data[-1000:]
    
    # Write back
    with open(filepath, "w") as f:
        json.dump(existing_data, f, indent=2)
    
    return filepath


def check_alert_conditions(metrics: Dict[str, Any], output_dir: Path) -> List[str]:
    """Check if any alert conditions are met and return list of alerts."""
    alerts = []
    
    # Check consecutive failures
    month_str = datetime.now().strftime("%Y-%m")
    filepath = output_dir / f"deployment-health-{month_str}.json"
    
    if filepath.exists():
        try:
            with open(filepath, "r") as f:
                history = json.load(f)
            if isinstance(history, list):
                # Count consecutive failures at the end
                consecutive_failures = 0
                for entry in reversed(history):
                    overall = entry.get("overall", "unknown")
                    if overall in ["degraded", "critical", "failed"]:
                        consecutive_failures += 1
                    else:
                        break
                
                if consecutive_failures >= 3:
                    alerts.append(f"PERSISTENT_FAILURE: {consecutive_failures} consecutive degraded checks")
                elif consecutive_failures >= 1:
                    alerts.append(f"DEGRADATION: {consecutive_failures} consecutive degraded check(s)")
                
                # Check for critical (production down)
                latest = history[-1] if history else {}
                http_check = latest.get("http_check", {})
                if http_check.get("overall") == "failed":
                    alerts.append("CRITICAL: Production appears down (all pages failing)")
        except Exception:
            pass
    
    return alerts


def send_slack_alert(message: str, status: str = "degraded") -> bool:
    """Send alert to Slack via webhook."""
    if not SLACK_WEBHOOK_URL:
        return False
    
    color = {"healthy": "#36a64f", "degraded": "#ff9900", "critical": "#ff0000"}.get(status, "#ff9900")
    
    payload = {
        "attachments": [{
            "color": color,
            "title": f"Stria Systems Deployment Alert [{status.upper()}]",
            "text": message,
            "footer": "Deployment Monitor",
            "ts": int(time.time()),
        }]
    }
    
    try:
        result = run_cmd([
            "curl", "-s", "-X", "POST", SLACK_WEBHOOK_URL,
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload)
        ], timeout=10)
        return result.returncode == 0
    except Exception:
        return False


def create_github_issue(title: str, body: str) -> bool:
    """Create a GitHub issue for persistent failures."""
    try:
        result = run_cmd([
            "gh", "issue", "create",
            "--repo", GITHUB_REPO,
            "--title", title,
            "--body", body,
            "--label", "deployment-monitor,auto-generated"
        ], timeout=30)
        return result.returncode == 0
    except Exception:
        return False


def send_pagerduty_alert(routing_key: str, summary: str, severity: str = "error", details: Dict = None) -> bool:
    """Send alert to PagerDuty via Events API v2."""
    if not routing_key:
        return False
    
    payload = {
        "routing_key": routing_key,
        "event_action": "trigger",
        "payload": {
            "summary": summary,
            "severity": severity,
            "source": "stria-systems-deployment-monitor",
            "custom_details": details or {},
        }
    }
    
    try:
        result = run_cmd([
            "curl", "-s", "-X", "POST", "https://events.pagerduty.com/v2/enqueue",
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload)
        ], timeout=10)
        return result.returncode == 0
    except Exception:
        return False


def send_alerts(metrics: Dict[str, Any], alerts: List[str]) -> None:
    """Send alerts via configured channels."""
    if not alerts:
        return
    
    status = metrics.get("overall", "unknown")
    alert_message = "\n".join(alerts)
    
    # Add context
    full_message = f"{alert_message}\n\nTimestamp: {metrics['timestamp']}\nStatus: {status}\nURL: https://striasystems.com"
    
    # Slack
    if SLACK_WEBHOOK_URL:
        if send_slack_alert(full_message, status):
            print("📢 Slack alert sent")
        else:
            print("⚠️  Failed to send Slack alert")
    
    # GitHub issue for persistent failures (>3 consecutive)
    if any("PERSISTENT_FAILURE" in a for a in alerts):
        title = f"[Deployment Monitor] Persistent degradation detected - {status}"
        body = f"""## Persistent Deployment Degradation

**Status:** {status.upper()}
**Time:** {metrics['timestamp']}
**URL:** https://striasystems.com

### Alerts
{chr(10).join(f'- {a}' for a in alerts)}

### Details
```json
{json.dumps(metrics, indent=2)}
```

*This issue was auto-generated by the deployment health monitor.*
"""
        if create_github_issue(title, body):
            print("📝 GitHub issue created")
        else:
            print("⚠️  Failed to create GitHub issue")
    
    # PagerDuty for critical (production down)
    if status == "critical" and PAGERDUTY_INTEGRATION_KEY:
        summary = f"Stria Systems Production Down - {len(alerts)} alert(s)"
        if send_pagerduty_alert(PAGERDUTY_INTEGRATION_KEY, summary, "critical", metrics):
            print("🚨 PagerDuty alert triggered")
        else:
            print("⚠️  Failed to trigger PagerDuty alert")


def main():
    print("🔍 Stria Systems Deployment Health Check")
    print(f"⏰ {datetime.now(timezone.utc).isoformat()}")
    print()
    
    output_dir = Path("/Users/cnazarko/stria systems/TraceV2/logs")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Run all checks
    http_check = check_http_pages()
    print(f"📄 HTTP Pages Check: {http_check['overall'].upper()}")
    for name, data in http_check["pages"].items():
        status_icon = "✅" if data.get("status") == "healthy" else "⚠️" if data.get("status") == "degraded" else "❌"
        p95 = data.get("p95_ms", "N/A")
        print(f"  {status_icon} {name}: p95={p95}ms, errors={data.get('errors', 0)}")
    print()
    
    ssl_check = check_ssl_certificate()
    print(f"🔒 SSL Certificate: {ssl_check['status'].upper()}")
    if "days_remaining" in ssl_check:
        print(f"  Expires: {ssl_check['not_after']} ({ssl_check['days_remaining']} days)")
    print()
    
    cf_check = check_cloudflare_deployment()
    print(f"☁️  Cloudflare Pages: {cf_check['status'].upper()}")
    if "latest_deployment" in cf_check:
        latest = cf_check["latest_deployment"]
        print(f"  Latest: {latest['id'][:8]}... ({latest['age']})")
    print()
    
    cwv_check = check_core_web_vitals()
    print(f"⚡ Core Web Vitals: {cwv_check['status'].upper()}")
    if "lcp" in cwv_check:
        print(f"  LCP: {cwv_check['lcp']['value']}s (threshold: {cwv_check['lcp']['threshold']}s)")
        print(f"  CLS: {cwv_check['cls']['value']} (threshold: {cwv_check['cls']['threshold']})")
        print(f"  FID: {cwv_check['fid']['value']}ms (threshold: {cwv_check['fid']['threshold']}ms)")
    else:
        print(f"  Note: {cwv_check.get('note', 'Unknown')}")
    print()
    
    error_check = check_5xx_errors()
    print(f"📊 5xx Error Check: {error_check['status'].upper()}")
    print(f"  Note: {error_check.get('note', 'Unknown')}")
    print()
    
    # Compile metrics
    metrics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall": "healthy",
        "http_check": http_check,
        "ssl_check": ssl_check,
        "cloudflare_check": cf_check,
        "core_web_vitals": cwv_check,
        "error_check": error_check,
    }
    
    # Determine overall status
    statuses = [
        http_check["overall"],
        ssl_check.get("status", "unknown"),
        cf_check.get("status", "unknown"),
        cwv_check.get("status", "unknown"),
    ]
    
    if "failed" in statuses or http_check["overall"] == "failed":
        metrics["overall"] = "critical"
    elif "degraded" in statuses:
        metrics["overall"] = "degraded"
    
    # Save metrics
    filepath = save_metrics(metrics, output_dir)
    print(f"💾 Metrics saved to: {filepath}")
    
    # Check alerts
    alerts = check_alert_conditions(metrics, output_dir)
    if alerts:
        print("\n🚨 ALERTS:")
        for alert in alerts:
            print(f"  - {alert}")
    
    # Send alerts via configured channels
    send_alerts(metrics, alerts)
    
    print(f"\n{'='*50}")
    print(f"OVERALL STATUS: {metrics['overall'].upper()}")
    print(f"{'='*50}")
    
    # Exit code for cron monitoring
    if metrics["overall"] == "critical":
        sys.exit(2)
    elif metrics["overall"] == "degraded":
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()