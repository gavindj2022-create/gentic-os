import os
from ..config import CLAUDE_COMMANDS_DIR


def get_available_skills() -> list:
    skills = []
    if not CLAUDE_COMMANDS_DIR.exists():
        return skills
    for f in sorted(CLAUDE_COMMANDS_DIR.iterdir()):
        if f.suffix != ".md":
            continue
        name = f.stem
        try:
            content = f.read_text(encoding="utf-8")
            first_line = next((l.strip() for l in content.splitlines() if l.strip() and not l.startswith("#")), "")
            description = first_line[:120] if first_line else ""
        except Exception:
            description = ""
        skills.append({"name": name, "description": description, "file": str(f)})
    return skills
