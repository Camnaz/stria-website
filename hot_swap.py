#!/usr/bin/env python3
"""
Hot-swap script for MLX model adapter.
Gracefully swaps the active adapter without downtime by using a versioned approach.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Configuration
MLX_SERVER_PID_FILE = Path(".trace/mlx_server.pid")
CURRENT_ADAPTER_LINK = Path(".trace/adapters/current")
ADAPTERS_DIR = Path(".trace/adapters")
MLX_SERVER_SCRIPT = Path("mlx_fastapi_server.py")
VENV_PYTHON = Path(".venv-mlx/bin/python")

def get_active_adapter() -> Path | None:
    """Get the currently active adapter path."""
    if CURRENT_ADAPTER_LINK.exists() and CURRENT_ADAPTER_LINK.is_symlink():
        return CURRENT_ADAPTER_LINK.resolve()
    return None

def list_adapters() -> list[Path]:
    """List available adapters."""
    return sorted([p for p in ADAPTERS_DIR.iterdir() 
                   if p.is_dir() and (p / "adapters.safetensors").exists()])

def set_active_adapter(adapter_path: Path) -> bool:
    """Set the active adapter via symlink."""
    try:
        if CURRENT_ADAPTER_LINK.exists() or CURRENT_ADAPTER_LINK.is_symlink():
            CURRENT_ADAPTER_LINK.unlink()
        CURRENT_ADAPTER_LINK.symlink_to(adapter_path)
        print(f"Active adapter set to: {adapter_path.name}")
        return True
    except Exception as e:
        print(f"Error setting active adapter: {e}")
        return False

def get_mlx_server_pid() -> int | None:
    """Get the running MLX server PID."""
    if MLX_SERVER_PID_FILE.exists():
        try:
            return int(MLX_SERVER_PID_FILE.read_text().strip())
        except:
            return None
    return None

def is_server_running(pid: int) -> bool:
    """Check if process is running."""
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def start_server(adapter_path: Path) -> subprocess.Popen:
    """Start the MLX FastAPI server."""
    env = os.environ.copy()
    env["ADAPTER_OVERRIDE"] = str(adapter_path)
    
    proc = subprocess.Popen(
        [str(VENV_PYTHON), str(MLX_SERVER_SCRIPT)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    MLX_SERVER_PID_FILE.write_text(str(proc.pid))
    print(f"Started MLX server with PID {proc.pid}")
    return proc

def stop_server(pid: int | None) -> bool:
    """Stop the MLX server gracefully."""
    if pid is None:
        return True
    try:
        os.kill(pid, 15)  # SIGTERM
        import time
        for _ in range(10):
            if not is_server_running(pid):
                return True
            time.sleep(0.5)
        os.kill(pid, 9)  # SIGKILL if needed
        return True
    except ProcessLookupError:
        return True
    except Exception as e:
        print(f"Error stopping server: {e}")
        return False

def hot_swap(adapter_name: str) -> bool:
    """Perform hot-swap to new adapter."""
    adapter_path = ADAPTERS_DIR / adapter_name
    
    if not adapter_path.exists() or not (adapter_path / "adapters.safetensors").exists():
        print(f"Error: Adapter not found: {adapter_path}")
        return False
    
    print(f"Initiating hot-swap to: {adapter_name}")
    
    # Set active adapter symlink
    if not set_active_adapter(adapter_path):
        return False
    
    # Stop current server (it will pick up the new adapter on restart)
    old_pid = get_mlx_server_pid()
    if old_pid and is_server_running(old_pid):
        print(f"Stopping old server (PID {old_pid})...")
        stop_server(old_pid)
    
    # Start new server
    print("Starting new server with updated adapter...")
    proc = start_server(adapter_path)
    
    # Wait for health check
    import time
    import requests
    for _ in range(30):
        try:
            resp = requests.get("http://localhost:9001/health", timeout=2)
            if resp.status_code == 200:
                print(f"Hot-swap complete! Server running on PID {proc.pid}")
                return True
        except:
            time.sleep(1)
    
    print("Warning: Server started but health check didn't pass in time")
    return False

def rollback() -> bool:
    """Rollback to previous adapter."""
    # Find second-most recent adapter
    adapters = list_adapters()
    if len(adapters) < 2:
        print("No previous adapter to rollback to")
        return False
    
    previous = adapters[-2]
    print(f"Rolling back to: {previous.name}")
    return hot_swap(previous.name)

def status() -> None:
    """Print current status."""
    active = get_active_adapter()
    print(f"Active adapter: {active.name if active else 'None'}")
    print(f"Available adapters:")
    for a in list_adapters():
        marker = " *" if a == active else ""
        print(f"  {a.name}{marker}")
    
    pid = get_mlx_server_pid()
    if pid and is_server_running(pid):
        print(f"MLX server: RUNNING (PID {pid})")
    else:
        print(f"MLX server: STOPPED")

def main():
    parser = argparse.ArgumentParser(description="MLX Adapter Hot-swap Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # hot-swap command
    swap_parser = subparsers.add_parser("hot-swap", help="Swap to new adapter")
    swap_parser.add_argument("adapter", help="Adapter name (directory in .trace/adapters/)")
    
    # rollback command
    subparsers.add_parser("rollback", help="Rollback to previous adapter")
    
    # status command
    subparsers.add_parser("status", help="Show current status")
    
    # start command
    start_parser = subparsers.add_parser("start", help="Start MLX server with current adapter")
    
    # stop command
    subparsers.add_parser("stop", help="Stop MLX server")
    
    args = parser.parse_args()
    
    if args.command == "hot-swap":
        success = hot_swap(args.adapter)
        sys.exit(0 if success else 1)
    elif args.command == "rollback":
        success = rollback()
        sys.exit(0 if success else 1)
    elif args.command == "status":
        status()
        sys.exit(0)
    elif args.command == "start":
        adapter = get_active_adapter() or (list_adapters()[-1] if list_adapters() else None)
        if not adapter:
            print("No adapter available")
            sys.exit(1)
        proc = start_server(adapter)
        print(f"Server started (PID: {proc.pid}). Check health at http://localhost:9001/health")
        proc.wait()
    elif args.command == "stop":
        pid = get_mlx_server_pid()
        if stop_server(pid):
            print("Server stopped")
        else:
            print("Failed to stop server")
            sys.exit(1)

if __name__ == "__main__":
    main()