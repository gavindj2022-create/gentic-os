"""Project scanner — scans registered projects for TODOs, issues, and recommendations."""

import os
import re
import logging
from pathlib import Path
from .database import create_recommendation, get_recommendations

log = logging.getLogger("workforce.scanner")

# Patterns to search for
TODO_PATTERN = re.compile(r'(?:#|//|/\*|\{-)\s*(TODO|FIXME|HACK|XXX|BUG)\b[:\s]*(.*)', re.IGNORECASE)
SECRET_PATTERNS = [
    re.compile(r'(?:api[_-]?key|secret|password|token)\s*[=:]\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
    re.compile(r'sk-[a-zA-Z0-9]{20,}'),
    re.compile(r'sk-ant-[a-zA-Z0-9_-]{20,}'),
]

# File extensions to scan
SCAN_EXTENSIONS = {'.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.yaml', '.yml', '.toml'}
SKIP_DIRS = {'node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv', '.tox'}


def scan_project(project: dict) -> list[dict]:
    """Scan a single project and return recommendations."""
    name = project["name"]
    path = Path(project["path"])
    proj_type = project.get("type", "unknown")
    recs = []

    if not path.exists():
        log.warning(f"Project path not found: {path}")
        return recs

    # 1. Scan for TODO/FIXME/HACK comments
    todos = _scan_todos(path)
    for todo in todos[:10]:  # Cap at 10 per project
        cat = "improvement"
        if "security" in todo["text"].lower() or "vulnerability" in todo["text"].lower():
            cat = "security"
        elif "feature" in todo["text"].lower() or "add" in todo["text"].lower():
            cat = "expansion"
        recs.append({
            "project": name,
            "title": f"{todo['tag']}: {todo['text'][:80]}",
            "description": f"Found in {todo['file']} — {todo['tag']} comment that needs attention.",
            "category": cat,
            "priority": 3 if todo["tag"] in ("FIXME", "BUG") else 5,
            "suggested_agent": "claude" if cat == "security" else None,
        })

    # 2. Check for missing essentials
    if not (path / "README.md").exists() and proj_type != "vault":
        recs.append({
            "project": name,
            "title": "Missing README.md",
            "description": f"Project {name} has no README. A good README improves discoverability.",
            "category": "improvement",
            "priority": 7,
            "suggested_agent": "gemini",
        })

    if not (path / ".gitignore").exists() and (path / ".git").exists():
        recs.append({
            "project": name,
            "title": "Missing .gitignore",
            "description": f"Git repo {name} has no .gitignore — risk of committing sensitive files.",
            "category": "security",
            "priority": 2,
            "suggested_agent": "ollama",
        })

    # 3. Check for hardcoded secrets
    secrets = _scan_secrets(path)
    for s in secrets[:5]:
        recs.append({
            "project": name,
            "title": f"Possible hardcoded secret in {s['file']}",
            "description": f"Line {s['line']}: pattern matches a potential API key or secret.",
            "category": "security",
            "priority": 1,
            "suggested_agent": "claude",
        })

    # 4. Check for .env in git
    if (path / ".git").exists() and (path / ".env").exists():
        gitignore = (path / ".gitignore").read_text(errors="ignore") if (path / ".gitignore").exists() else ""
        if ".env" not in gitignore:
            recs.append({
                "project": name,
                "title": ".env file may be tracked by git",
                "description": "The .env file exists but isn't in .gitignore. Secrets could leak.",
                "category": "security",
                "priority": 1,
                "suggested_agent": "ollama",
            })

    # 5. Check test coverage
    has_tests = any(
        f.name.startswith("test_") or f.name.endswith("_test.py") or f.name.endswith(".test.ts") or f.name.endswith(".test.tsx")
        for f in path.rglob("*") if f.is_file() and f.suffix in SCAN_EXTENSIONS
        and not any(skip in f.parts for skip in SKIP_DIRS)
    )
    if not has_tests and proj_type in ("fullstack", "python", "react", "nextjs"):
        recs.append({
            "project": name,
            "title": "No test files found",
            "description": f"Project {name} has no test files. Adding tests improves reliability.",
            "category": "improvement",
            "priority": 4,
            "suggested_agent": "openai",
        })

    return recs


def scan_all_projects(project_registry: list[dict]) -> list[dict]:
    """Scan all registered projects and create recommendations. Clears old pending recs first."""
    from .database import get_conn
    # Clear old pending recommendations to avoid duplicates
    with get_conn() as conn:
        conn.execute("DELETE FROM agent_recommendations WHERE status = 'pending'")

    all_recs = []
    for project in project_registry:
        # Skip vault-type projects (too large for file scanning)
        if project.get("type") == "vault":
            continue
        try:
            project_recs = scan_project(project)
            for rec_data in project_recs:
                rec = create_recommendation(**rec_data)
                all_recs.append(rec)
        except Exception as e:
            log.error(f"Error scanning {project['name']}: {e}")
    return all_recs


def _scan_todos(path: Path, max_files: int = 100) -> list[dict]:
    """Search source files for TODO/FIXME/HACK/XXX comments."""
    results = []
    count = 0
    for f in path.rglob("*"):
        if count >= max_files:
            break
        if not f.is_file() or f.suffix not in SCAN_EXTENSIONS:
            continue
        if any(skip in f.parts for skip in SKIP_DIRS):
            continue
        count += 1
        try:
            text = f.read_text(errors="ignore")
            for match in TODO_PATTERN.finditer(text):
                tag = match.group(1).upper()
                comment = match.group(2).strip()
                if comment:
                    rel = str(f.relative_to(path))
                    results.append({"file": rel, "tag": tag, "text": comment})
        except Exception:
            continue
    return results


def _scan_secrets(path: Path, max_files: int = 100) -> list[dict]:
    """Search for potential hardcoded secrets."""
    results = []
    count = 0
    for f in path.rglob("*"):
        if count >= max_files:
            break
        if not f.is_file() or f.suffix not in SCAN_EXTENSIONS:
            continue
        if any(skip in f.parts for skip in SKIP_DIRS):
            continue
        # Skip .env files (those are expected to have secrets)
        if f.name == ".env" or f.name.startswith(".env."):
            continue
        count += 1
        try:
            lines = f.read_text(errors="ignore").splitlines()
            for i, line in enumerate(lines, 1):
                for pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        rel = str(f.relative_to(path))
                        results.append({"file": rel, "line": i})
                        break
        except Exception:
            continue
    return results
