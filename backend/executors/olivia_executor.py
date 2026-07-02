import httpx
from .base import BaseExecutor
from ..config import OLIVIA_URL


class OliviaExecutor(BaseExecutor):
    async def execute(self, skill: str, payload: dict) -> dict:
        command = payload.get("command", skill.replace("olivia-", "").replace("-", " "))
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(f"{OLIVIA_URL}/api/command", json={"command": command})
                data = r.json()
                return {"output": f"Command '{command}' queued to OLIVIA", "olivia_response": data}
        except Exception as e:
            return {"error": str(e)}
