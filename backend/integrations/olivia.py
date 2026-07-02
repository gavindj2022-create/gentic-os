import json
import httpx
from ..config import OLIVIA_URL, STATUS_FILE, FEAR_FILE, DIGEST_FILE, CAR_FILE, TOKEN_LOG


async def get_status() -> dict:
    """Read OLIVIA status — prefer local file (always fresh), fallback to API."""
    try:
        if STATUS_FILE.exists():
            return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{OLIVIA_URL}/api/status")
            return r.json()
    except Exception:
        return {"system": "offline", "error": "OLIVIA unreachable"}


async def get_fear() -> dict:
    try:
        if FEAR_FILE.exists():
            return json.loads(FEAR_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{OLIVIA_URL}/api/fear")
            return r.json()
    except Exception:
        return {"fear_score": 0, "fraud_score": 0, "fear_level": "Unknown", "error": "unavailable"}


async def get_tokens() -> dict:
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{OLIVIA_URL}/api/tokens")
            return r.json()
    except Exception:
        return {"error": "unavailable", "total": {}, "today": {}, "week": {}}


async def get_digest() -> dict:
    try:
        if DIGEST_FILE.exists():
            return json.loads(DIGEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {"ai_tech": [], "finance": [], "crypto": [], "status": "not_generated"}


async def get_carbiz() -> dict:
    try:
        if CAR_FILE.exists():
            return json.loads(CAR_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {"error": "not_available"}


async def send_command(command: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(f"{OLIVIA_URL}/api/command", json={"command": command})
            return r.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def get_knowledge() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{OLIVIA_URL}/api/knowledge")
            return r.json()
    except Exception:
        return {"topics": [], "count": 0}


def is_online() -> bool:
    try:
        if STATUS_FILE.exists():
            data = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
            return data.get("system") == "online"
    except Exception:
        pass
    return False
