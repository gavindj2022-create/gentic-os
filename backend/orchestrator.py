import asyncio
import time
from datetime import datetime
from .database import get_jobs, update_job, get_conn
from .ws_manager import ws_manager
from .executors.olivia_executor import OliviaExecutor
from .executors.direct_executor import DirectExecutor


olivia_exec = OliviaExecutor()
direct_exec = DirectExecutor()


def route_executor(skill: str):
    if skill.startswith("olivia") or skill in ("morning brief", "daily plan", "wind down", "wellbeing check", "weekly synthesis", "build knowledge"):
        return olivia_exec
    if skill in DirectExecutor.ACTIONS:
        return direct_exec
    return olivia_exec


async def process_queue():
    while True:
        try:
            jobs = get_jobs(status="queued", limit=5)
            for job in jobs:
                await _run_job(job)
        except Exception:
            pass
        await asyncio.sleep(2)


async def _run_job(job: dict):
    job_id = job["id"]
    skill = job["skill"]
    payload = job.get("payload", {})

    update_job(job_id, status="running", started_at=datetime.utcnow().isoformat())
    await ws_manager.broadcast("job_update", {"id": job_id, "status": "running", "skill": skill})

    start = time.monotonic()
    executor = route_executor(skill)

    try:
        result = await executor.execute(skill, payload)
        duration_ms = int((time.monotonic() - start) * 1000)

        if "error" in result and result["error"]:
            retries = job.get("retries", 0)
            max_retries = job.get("max_retries", 3)
            if retries < max_retries:
                update_job(job_id, status="queued", retries=retries + 1, error=result["error"])
                await ws_manager.broadcast("job_update", {"id": job_id, "status": "retrying", "retries": retries + 1})
            else:
                update_job(job_id, status="failed", error=result["error"], completed_at=datetime.utcnow().isoformat())
                await ws_manager.broadcast("job_update", {"id": job_id, "status": "failed", "error": result["error"]})
                _log_history(job_id, skill, "failed", duration_ms, result["error"])
        else:
            output = result.get("output", "Done")
            update_job(job_id, status="completed", result=output, completed_at=datetime.utcnow().isoformat())
            await ws_manager.broadcast("job_update", {"id": job_id, "status": "completed", "result": output, "skill": skill})
            _log_history(job_id, skill, "completed", duration_ms)

    except Exception as e:
        update_job(job_id, status="failed", error=str(e), completed_at=datetime.utcnow().isoformat())
        await ws_manager.broadcast("job_update", {"id": job_id, "status": "failed", "error": str(e)})


def _log_history(job_id: str, skill: str, status: str, duration_ms: int, error: str = None):
    try:
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO job_history (job_id, skill, status, duration_ms, error, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
                (job_id, skill, status, duration_ms, error, datetime.utcnow().isoformat()),
            )
    except Exception:
        pass
