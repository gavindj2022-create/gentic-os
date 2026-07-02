"""Budget tracker — enforces daily token limits + monthly USD caps per provider."""

import logging
from .database import get_budget, log_token_usage, get_all_budgets

log = logging.getLogger("workforce.budget")


class BudgetTracker:
    """Singleton budget enforcement engine."""

    def can_execute(self, provider: str) -> bool:
        """Check if provider is within daily token limit AND monthly USD cap."""
        if provider == "ollama":
            return True  # Always free (local)

        daily = get_budget(provider, "daily")
        monthly = get_budget(provider, "monthly")

        if daily and daily["limit_tokens"] > 0:
            if daily["used_tokens"] >= daily["limit_tokens"]:
                log.info(f"Budget exceeded (daily tokens): {provider} — {daily['used_tokens']}/{daily['limit_tokens']}")
                return False

        if monthly and monthly["limit_usd"] > 0:
            if monthly["used_usd"] >= monthly["limit_usd"]:
                log.info(f"Budget exceeded (monthly USD): {provider} — ${monthly['used_usd']:.4f}/${monthly['limit_usd']:.2f}")
                return False

        return True

    def record_usage(self, provider: str, tokens: int, cost_usd: float):
        """Log token + cost usage for a provider."""
        if provider == "ollama":
            return  # No tracking needed for local
        log_token_usage(provider, tokens, cost_usd)
        log.info(f"Usage logged: {provider} +{tokens} tokens, +${cost_usd:.6f}")

    def get_status_all(self) -> list[dict]:
        """Return budget status for all providers in a dashboard-friendly format."""
        all_budgets = get_all_budgets()
        providers = {}
        for b in all_budgets:
            prov = b["provider"]
            if prov not in providers:
                providers[prov] = {
                    "provider": prov,
                    "daily_tokens_used": 0,
                    "daily_tokens_limit": 0,
                    "monthly_cost_used": 0.0,
                    "monthly_cost_limit": 0.0,
                    "is_free_tier": True,
                    "can_spend": True,
                }
            if b["period"] == "daily":
                providers[prov]["daily_tokens_used"] = b["used_tokens"]
                providers[prov]["daily_tokens_limit"] = b["limit_tokens"]
            elif b["period"] == "monthly":
                providers[prov]["monthly_cost_used"] = round(b["used_usd"], 6)
                providers[prov]["monthly_cost_limit"] = b["limit_usd"]
                providers[prov]["is_free_tier"] = (b["limit_usd"] <= 0)

            providers[prov]["can_spend"] = self.can_execute(prov)

        # Add ollama if missing
        if "ollama" not in providers:
            providers["ollama"] = {
                "provider": "ollama",
                "daily_tokens_used": 0,
                "daily_tokens_limit": 999999999,
                "monthly_cost_used": 0.0,
                "monthly_cost_limit": 0.0,
                "is_free_tier": True,
                "can_spend": True,
            }

        return list(providers.values())

    def smart_route(self, complexity: str) -> str:
        """Given task complexity, return best provider considering budget.
        complexity: 'simple' | 'medium' | 'complex'
        """
        if complexity == "simple":
            # Prefer free: ollama first, then gemini
            if self.can_execute("ollama"):
                return "ollama"
            if self.can_execute("gemini"):
                return "gemini"
            return "ollama"  # Ollama is always free

        elif complexity == "medium":
            # Prefer cheap paid models
            for prov in ["gemini", "openai", "claude"]:
                if self.can_execute(prov):
                    return prov
            return "ollama"  # Fallback to free

        else:  # complex
            for prov in ["claude", "openai", "gemini"]:
                if self.can_execute(prov):
                    return prov
            return "ollama"  # Fallback

    def update_caps(self, provider: str, monthly_cap: float = None, daily_token_limit: int = None):
        """Update budget caps for a provider."""
        from .database import update_budget
        if monthly_cap is not None:
            update_budget(provider, "monthly", limit_usd=monthly_cap)
        if daily_token_limit is not None:
            update_budget(provider, "daily", limit_tokens=daily_token_limit)


budget_tracker = BudgetTracker()
