"""Workforce Manager — orchestrates the agent worker loops."""

import asyncio
import logging
from datetime import datetime
from .database import (
    get_agent_workers, get_agent_tasks, update_agent_worker,
    update_agent_task, get_agent_task,
)
from .executors import get_executor
from .budget import budget_tracker
from .knowledge import extract_insights

log = logging.getLogger("workforce.manager")

# System prompt template for agent tasks
SYSTEM_PROMPT = """You are an AI agent working as part of GenTIC OS, a multi-agent workforce system.
You are assigned a specific task. Complete it thoroughly and return your findings.

Guidelines:
- Be thorough but concise in your analysis
- If you find security issues, clearly mark them
- If you find opportunities for improvement, explain the impact
- If you find potential revenue or expansion opportunities, quantify if possible
- Format your response clearly with sections if needed"""


class WorkforceManager:
    """The brain — manages persistent agent loops."""

    def __init__(self):
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False

    async def start(self):
        """Start agent loops for all registered workers."""
        self._running = True
        agents = get_agent_workers()
        for agent in agents:
            if agent["status"] != "offline":
                self._spawn_loop(agent["id"], agent["name"])
        log.info(f"Workforce started with {len(agents)} agents")

    async def stop(self):
        """Cancel all agent loops."""
        self._running = False
        for task_name, task in self._tasks.items():
            task.cancel()
        self._tasks.clear()
        log.info("Workforce stopped")

    def _spawn_loop(self, agent_id: str, name: str):
        """Spawn an async loop for one agent."""
        task = asyncio.create_task(self._agent_loop(agent_id))
        self._tasks[agent_id] = task
        log.info(f"Spawned loop for agent {name} ({agent_id})")

    async def _agent_loop(self, agent_id: str):
        """Persistent loop for a single agent worker."""
        while self._running:
            try:
                agent = _get_agent_safe(agent_id)
                if not agent:
                    await asyncio.sleep(30)
                    continue

                # Check if paused/offline
                if agent["status"] in ("paused", "offline"):
                    await asyncio.sleep(10)
                    continue

                # Check budget
                provider = agent["provider"]
                if not budget_tracker.can_execute(provider):
                    update_agent_worker(agent_id, status="budget_exceeded")
                    await _broadcast_agent_status(agent_id)
                    await asyncio.sleep(60)
                    continue

                # Pick next task
                tasks = get_agent_tasks(status="pending", agent_id=agent_id, limit=1)
                if not tasks:
                    if agent["status"] != "idle":
                        update_agent_worker(agent_id, status="idle", current_task_id=None)
                        await _broadcast_agent_status(agent_id)
                    await asyncio.sleep(15)
                    continue

                # Execute task
                task = tasks[0]
                await self._execute_task(agent, task)

            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"Agent loop error ({agent_id}): {e}")
                await asyncio.sleep(15)

    async def _execute_task(self, agent: dict, task: dict):
        """Execute a single task with an agent."""
        agent_id = agent["id"]
        task_id = task["id"]
        provider = agent["provider"]
        model = agent["model_name"]

        # Mark as working
        update_agent_worker(agent_id, status="working", current_task_id=task_id)
        update_agent_task(task_id, status="running", started_at=datetime.utcnow().isoformat())
        await _broadcast_agent_status(agent_id)
        await _broadcast_task_update(task_id)

        # Build prompt
        user_prompt = f"Task: {task['title']}\n"
        if task.get("description"):
            user_prompt += f"Description: {task['description']}\n"
        if task.get("project_path"):
            user_prompt += f"Project path: {task['project_path']}\n"
        if task.get("category"):
            user_prompt += f"Category focus: {task['category']}\n"

        # Call AI
        executor = get_executor(provider)
        if not executor:
            update_agent_task(task_id, status="failed", result="No executor found for provider")
            update_agent_worker(agent_id, status="idle", current_task_id=None)
            await _broadcast_agent_status(agent_id)
            return

        result = await executor.run(SYSTEM_PROMPT, user_prompt, model=model)

        if result.get("error"):
            update_agent_task(
                task_id,
                status="failed",
                result=result.get("error", "Unknown error"),
                tokens_used=result.get("tokens_used", 0),
                cost_usd=result.get("cost_usd", 0),
                completed_at=datetime.utcnow().isoformat(),
            )
            update_agent_worker(agent_id, status="idle", current_task_id=None)
            await _broadcast_agent_status(agent_id)
            await _broadcast_task_update(task_id)
            return

        # Record usage
        tokens = result.get("tokens_used", 0)
        cost = result.get("cost_usd", 0)
        budget_tracker.record_usage(provider, tokens, cost)

        # Save result
        output = result.get("output", "")
        update_agent_task(
            task_id,
            status="completed",
            result=output[:10000],  # Cap stored result
            tokens_used=tokens,
            cost_usd=cost,
            completed_at=datetime.utcnow().isoformat(),
        )

        # Extract knowledge
        try:
            insights = await extract_insights(task, output, agent_id)
            log.info(f"Extracted {len(insights)} insights from task {task_id}")
        except Exception as e:
            log.error(f"Knowledge extraction failed: {e}")
            insights = []

        # Update agent status
        update_agent_worker(agent_id, status="idle", current_task_id=None)

        # Broadcast completion
        await _broadcast_agent_status(agent_id)
        await _broadcast_task_completed(task_id, agent_id, output[:200], len(insights))

    def pause_agent(self, agent_id: str):
        update_agent_worker(agent_id, status="paused")

    def resume_agent(self, agent_id: str):
        update_agent_worker(agent_id, status="idle")
        # Ensure loop exists
        if agent_id not in self._tasks or self._tasks[agent_id].done():
            agent = _get_agent_safe(agent_id)
            if agent:
                self._spawn_loop(agent_id, agent["name"])

    def get_status(self) -> dict:
        """Full workforce status snapshot."""
        agents = get_agent_workers()
        active_tasks = get_agent_tasks(status="running")
        pending_tasks = get_agent_tasks(status="pending")
        recent = get_agent_tasks(status="completed", limit=10)
        budgets = budget_tracker.get_status_all()
        return {
            "agents": agents,
            "active_tasks": active_tasks,
            "pending_tasks": pending_tasks,
            "recent_completions": recent,
            "budgets": budgets,
            "total_agents": len(agents),
            "working_count": sum(1 for a in agents if a["status"] == "working"),
            "idle_count": sum(1 for a in agents if a["status"] == "idle"),
        }


def _get_agent_safe(agent_id: str):
    try:
        from .database import get_agent_worker
        return get_agent_worker(agent_id)
    except Exception:
        return None


async def _broadcast_agent_status(agent_id: str):
    try:
        from ..ws_manager import ws_manager
        agent = _get_agent_safe(agent_id)
        if agent:
            await ws_manager.broadcast("agent_status", agent)
    except Exception:
        pass


async def _broadcast_task_update(task_id: str):
    try:
        from ..ws_manager import ws_manager
        task = get_agent_task(task_id)
        if task:
            await ws_manager.broadcast("task_update", task)
    except Exception:
        pass


async def _broadcast_task_completed(task_id: str, agent_id: str, result_summary: str, insights_count: int):
    try:
        from ..ws_manager import ws_manager
        await ws_manager.broadcast("task_completed", {
            "task_id": task_id,
            "agent_id": agent_id,
            "result_summary": result_summary,
            "insights_count": insights_count,
        })
    except Exception:
        pass


# Singleton
workforce_manager = WorkforceManager()
