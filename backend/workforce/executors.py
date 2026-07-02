"""AI provider executors — Claude, OpenAI, Gemini, Ollama."""

import logging
from abc import ABC, abstractmethod

log = logging.getLogger("workforce.executors")


class AIExecutor(ABC):
    """Base class for AI provider executors."""

    @abstractmethod
    async def run(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        """Call the AI and return {output, tokens_used, cost_usd, model}."""
        ...


class ClaudeExecutor(AIExecutor):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def run(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        if not self.api_key:
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "claude-sonnet-4-20250514", "error": "No API key configured"}
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            model = model or "claude-sonnet-4-20250514"
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            output = response.content[0].text if response.content else ""
            input_tok = response.usage.input_tokens
            output_tok = response.usage.output_tokens
            total_tok = input_tok + output_tok
            # Claude pricing: sonnet ~$3/$15 per 1M tokens
            cost = (input_tok * 3.0 + output_tok * 15.0) / 1_000_000
            return {"output": output, "tokens_used": total_tok, "cost_usd": round(cost, 6), "model": model}
        except Exception as e:
            log.error(f"Claude executor error: {e}")
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "claude-sonnet-4-20250514", "error": str(e)}


class OpenAIExecutor(AIExecutor):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def run(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        if not self.api_key:
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "gpt-4o", "error": "No API key configured"}
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)
            model = model or "gpt-4o"
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
            )
            output = response.choices[0].message.content or ""
            input_tok = response.usage.prompt_tokens if response.usage else 0
            output_tok = response.usage.completion_tokens if response.usage else 0
            total_tok = input_tok + output_tok
            # GPT-4o pricing: ~$2.5/$10 per 1M tokens
            cost = (input_tok * 2.5 + output_tok * 10.0) / 1_000_000
            return {"output": output, "tokens_used": total_tok, "cost_usd": round(cost, 6), "model": model}
        except Exception as e:
            log.error(f"OpenAI executor error: {e}")
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "gpt-4o", "error": str(e)}


class GeminiExecutor(AIExecutor):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def run(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        if not self.api_key:
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "gemini-2.0-flash", "error": "No API key configured"}
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model_name = model or "gemini-2.0-flash"
            gmodel = genai.GenerativeModel(model_name, system_instruction=system_prompt)
            response = gmodel.generate_content(user_prompt)
            output = response.text or ""
            # Gemini usage metadata
            input_tok = getattr(response.usage_metadata, "prompt_token_count", 0) if response.usage_metadata else 0
            output_tok = getattr(response.usage_metadata, "candidates_token_count", 0) if response.usage_metadata else 0
            total_tok = input_tok + output_tok
            # Gemini Flash is essentially free tier / very cheap
            cost = (input_tok * 0.075 + output_tok * 0.3) / 1_000_000
            return {"output": output, "tokens_used": total_tok, "cost_usd": round(cost, 6), "model": model_name}
        except Exception as e:
            log.error(f"Gemini executor error: {e}")
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "gemini-2.0-flash", "error": str(e)}


class OllamaExecutor(AIExecutor):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    async def run(self, system_prompt: str, user_prompt: str, model: str = None) -> dict:
        try:
            import httpx
            model = model or "llama3"
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "stream": False,
                    },
                )
                data = resp.json()
            output = data.get("message", {}).get("content", "")
            input_tok = data.get("prompt_eval_count", 0)
            output_tok = data.get("eval_count", 0)
            total_tok = input_tok + output_tok
            return {"output": output, "tokens_used": total_tok, "cost_usd": 0.0, "model": model}
        except Exception as e:
            log.error(f"Ollama executor error: {e}")
            return {"output": "", "tokens_used": 0, "cost_usd": 0, "model": model or "llama3", "error": str(e)}


# Executor registry — instantiated with config at startup
_executors: dict[str, AIExecutor] = {}


def init_executors(config: dict):
    """Initialize all executors from config. Called at startup."""
    global _executors
    _executors = {
        "claude": ClaudeExecutor(config.get("ANTHROPIC_API_KEY", "")),
        "openai": OpenAIExecutor(config.get("OPENAI_API_KEY", "")),
        "gemini": GeminiExecutor(config.get("GEMINI_API_KEY", "")),
        "ollama": OllamaExecutor(config.get("OLLAMA_BASE_URL", "http://localhost:11434")),
    }


def get_executor(provider: str) -> AIExecutor | None:
    return _executors.get(provider)
