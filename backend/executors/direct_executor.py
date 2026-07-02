from .base import BaseExecutor
from ..integrations import obsidian


class DirectExecutor(BaseExecutor):
    ACTIONS = {
        "vault-search": "_vault_search",
        "vault-stats": "_vault_stats",
        "daily-note": "_daily_note",
    }

    async def execute(self, skill: str, payload: dict) -> dict:
        action = self.ACTIONS.get(skill)
        if not action:
            return {"error": f"Unknown direct skill: {skill}"}
        try:
            fn = getattr(self, action)
            return await fn(payload)
        except Exception as e:
            return {"error": str(e)}

    async def _vault_search(self, payload: dict) -> dict:
        q = payload.get("query", "")
        results = obsidian.search_vault(q)
        return {"output": f"Found {len(results)} results for '{q}'", "results": results}

    async def _vault_stats(self, payload: dict) -> dict:
        stats = obsidian.get_vault_stats()
        return {"output": f"{stats['note_count']} notes, {stats['total_words']} words", "stats": stats}

    async def _daily_note(self, payload: dict) -> dict:
        date = payload.get("date")
        content = obsidian.get_daily_note(date)
        return {"output": content[:500] if content else "No daily note found", "full_content": content}
