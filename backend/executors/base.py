from abc import ABC, abstractmethod


class BaseExecutor(ABC):
    @abstractmethod
    async def execute(self, skill: str, payload: dict) -> dict:
        """Execute a skill and return result dict with 'output' and optional 'error'."""
        ...
