"""
Claude Code Session Monitor — Watches active Claude Code sessions
and provides real-time status to the GenTIC dashboard.

Reads from:
- ~/.claude/ directory for session data
- Running claude processes
- JSONL session transcripts
"""
import os
import json
import glob
import time
import subprocess
from pathlib import Path
from datetime import datetime


CLAUDE_DIR = Path(os.path.expanduser("~/.claude"))
PROJECTS_DIR = CLAUDE_DIR / "projects"

# Tools that mean "actively building" (vs reading/searching/thinking)
BUILD_TOOLS = {"Edit", "Write", "NotebookEdit", "Bash"}

# Map tool name -> (verb, prefer this input key for the target)
_TOOL_VERBS = {
    "Edit": ("Editing", "file_path"),
    "Write": ("Writing", "file_path"),
    "NotebookEdit": ("Editing", "notebook_path"),
    "Read": ("Reading", "file_path"),
    "Bash": ("Running", "command"),
    "PowerShell": ("Running", "command"),
    "Grep": ("Searching", "pattern"),
    "Glob": ("Searching", "pattern"),
    "Task": ("Delegating", "description"),
    "WebFetch": ("Fetching", "url"),
    "WebSearch": ("Searching", "query"),
}


def _describe_action(tool_name: str, tool_input: dict) -> dict | None:
    """Turn a tool_use block into a human-readable action {tool, verb, target}."""
    if not tool_name:
        return None
    verb, key = _TOOL_VERBS.get(tool_name, (tool_name, "file_path"))
    raw = str(tool_input.get(key, "") or "")
    # For file-path style targets show just the filename; for commands/queries trim.
    if key in ("file_path", "notebook_path", "path"):
        target = Path(raw).name if raw else ""
    else:
        target = raw.strip().replace("\n", " ")
        if len(target) > 60:
            target = target[:57] + "..."
    return {"tool": tool_name, "verb": verb, "target": target}


def get_active_sessions() -> list:
    """
    Detect running Claude Code sessions by checking running processes
    and recent session files.
    """
    sessions = []

    # Check for running claude processes
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq claude.exe", "/FO", "CSV", "/NH"],
            capture_output=True, text=True, timeout=5
        )
        claude_processes = [
            line for line in result.stdout.strip().split("\n")
            if "claude" in line.lower() and "INFO:" not in line
        ]
    except Exception:
        claude_processes = []

    # Scan for recent session files (modified in last 30 minutes)
    cutoff = time.time() - 1800  # 30 minutes
    try:
        for project_dir in PROJECTS_DIR.iterdir():
            if not project_dir.is_dir():
                continue
            # Look for .jsonl session transcripts
            for jsonl in project_dir.glob("*.jsonl"):
                if jsonl.stat().st_mtime > cutoff:
                    session = _parse_session_file(jsonl, project_dir.name)
                    if session:
                        sessions.append(session)
    except Exception:
        pass

    # If we have running processes but no session files, create a generic entry
    if claude_processes and not sessions:
        sessions.append({
            "id": "unknown",
            "name": "Claude Code",
            "mode": "builder",
            "status": "active",
            "progress": 0,
            "files": [],
            "duration": "unknown",
            "project": "unknown",
            "started_at": None,
            "current_action": "",
            "recent_actions": [],
            "last_message": "",
            "is_building": False,
        })

    return sessions


def _parse_session_file(jsonl_path: Path, project_name: str) -> dict | None:
    """Parse a JSONL session transcript to extract session info."""
    try:
        lines = []
        file_size = jsonl_path.stat().st_size

        # Read last 50KB to get recent activity
        with open(jsonl_path, "r", encoding="utf-8", errors="ignore") as f:
            if file_size > 50000:
                f.seek(file_size - 50000)
                f.readline()  # Skip partial line
            lines = f.readlines()

        if not lines:
            return None

        # Parse recent entries
        recent_files = set()
        recent_actions = []  # chronological {tool, verb, target, ts}
        last_message = ""    # latest assistant text snippet
        last_action = None   # most recent action dict
        last_activity = None
        session_id = jsonl_path.stem
        mode = "builder"
        status = "idle"
        message_count = 0

        for line in lines[-100:]:  # Last 100 entries
            try:
                entry = json.loads(line.strip())
            except (json.JSONDecodeError, ValueError):
                continue

            message_count += 1
            ts = entry.get("timestamp")

            # Detect mode from content
            msg_type = entry.get("type", "")
            if msg_type == "assistant":
                status = "active"
                message = entry.get("message", {})
                # Check for planning indicators
                content = str(message.get("content", ""))
                if any(kw in content.lower() for kw in ["plan", "architecture", "design", "approach", "strategy"]):
                    mode = "planner"

                blocks = message.get("content", []) if isinstance(message.get("content"), list) else []
                for block in blocks:
                    if not isinstance(block, dict):
                        continue
                    btype = block.get("type")
                    if btype == "text":
                        text = block.get("text", "").strip()
                        if text:
                            last_message = text[:140]
                    elif btype == "tool_use":
                        tool_name = block.get("name", "")
                        tool_input = block.get("input", {}) if isinstance(block.get("input"), dict) else {}
                        # Track files
                        file_path = tool_input.get("file_path", "") or tool_input.get("path", "")
                        if file_path:
                            fname = Path(file_path).name
                            if fname and len(fname) < 50:
                                recent_files.add(fname)
                        # Track action
                        action = _describe_action(tool_name, tool_input)
                        if action:
                            action["ts"] = ts
                            recent_actions.append(action)
                            last_action = action

            # Track timestamp
            if ts:
                last_activity = ts

        # Calculate duration
        duration = "unknown"
        if last_activity:
            try:
                # Handle ISO format timestamps
                if isinstance(last_activity, str):
                    last_dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                    elapsed = (datetime.now(last_dt.tzinfo) - last_dt).total_seconds()
                    if elapsed < 60:
                        duration = f"{int(elapsed)}s"
                    elif elapsed < 3600:
                        duration = f"{int(elapsed / 60)}m"
                    else:
                        duration = f"{int(elapsed / 3600)}h"
            except Exception:
                pass

        # Check if session is recent enough to be "active"
        mtime_age = time.time() - jsonl_path.stat().st_mtime
        if mtime_age > 300:  # More than 5 minutes since last write
            status = "idle"
        elif mtime_age > 60:
            status = "thinking"

        # Clean up project name
        project_display = project_name.replace("C--Users-ninja-", "").replace("-", "/")

        # Build a human-readable "current action" string + building flag
        current_action = ""
        is_building = False
        if last_action and status in ("active", "thinking"):
            target = last_action.get("target", "")
            current_action = f"{last_action['verb']} {target}".strip() if target else last_action["verb"]
            is_building = last_action["tool"] in BUILD_TOOLS

        return {
            "id": session_id[:12],
            "name": f"Claude Code — {project_display}",
            "mode": mode,
            "status": status,
            "progress": min(95, message_count),  # Rough progress estimate
            "files": list(recent_files)[:8],  # Last 8 files
            "duration": duration,
            "project": project_display,
            "started_at": last_activity,
            "message_count": message_count,
            "current_action": current_action,
            "recent_actions": recent_actions[-8:],
            "last_message": last_message,
            "is_building": is_building,
        }
    except Exception:
        return None


def get_session_summary() -> dict:
    """Get a summary of all Claude Code activity."""
    sessions = get_active_sessions()
    active = [s for s in sessions if s["status"] in ("active", "thinking")]
    return {
        "total_sessions": len(sessions),
        "active_sessions": len(active),
        "sessions": sessions,
    }
