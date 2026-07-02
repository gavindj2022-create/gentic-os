"""
Phase 3 Scheduler — Cron-based task scheduling using APScheduler.
Replaces OLIVIA's hardcoded background loops with configurable schedules.
"""
import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from .database import get_schedules, update_schedule, create_job
from .ws_manager import ws_manager

logger = logging.getLogger("gentic.scheduler")

scheduler = AsyncIOScheduler(timezone="America/Chicago")

# Default schedules to migrate from OLIVIA's hardcoded loops
DEFAULT_SCHEDULES = [
    {"name": "Knowledge Builder", "cron": "0 */3 * * *", "skill": "build knowledge", "description": "Build and update knowledge base every 3 hours"},
    {"name": "Daily Digest", "cron": "0 7 * * *", "skill": "morning brief", "description": "Morning brief at 7 AM"},
    {"name": "Daily Plan", "cron": "30 7 * * *", "skill": "daily plan", "description": "Daily planning at 7:30 AM"},
    {"name": "Wellbeing Check", "cron": "0 12 * * *", "skill": "wellbeing check", "description": "Midday wellbeing check"},
    {"name": "Wind Down", "cron": "0 21 * * *", "skill": "wind down", "description": "Evening wind-down at 9 PM"},
    {"name": "Weekly Synthesis", "cron": "0 21 * * 0", "skill": "weekly synthesis", "description": "Weekly synthesis every Sunday at 9 PM"},
]


async def _run_scheduled_skill(schedule_id: str, skill: str, payload: dict = None):
    """Execute a scheduled skill by creating a job."""
    try:
        job = create_job(skill, payload or {}, priority=3, triggered_by=f"schedule:{schedule_id}")
        update_schedule(schedule_id, last_run=datetime.utcnow().isoformat())
        await ws_manager.broadcast("schedule_fired", {
            "schedule_id": schedule_id,
            "skill": skill,
            "job_id": job["id"],
            "fired_at": datetime.utcnow().isoformat(),
        })
        logger.info(f"Schedule {schedule_id} fired: {skill} -> job {job['id']}")
    except Exception as e:
        logger.error(f"Schedule {schedule_id} failed: {e}")


def _parse_cron(cron_str: str) -> CronTrigger | IntervalTrigger:
    """Parse a cron string or interval shorthand into an APScheduler trigger."""
    # Support interval shorthand like "every 5m", "every 30s", "every 2h"
    if cron_str.startswith("every "):
        val = cron_str[6:].strip()
        if val.endswith("s"):
            return IntervalTrigger(seconds=int(val[:-1]))
        elif val.endswith("m"):
            return IntervalTrigger(minutes=int(val[:-1]))
        elif val.endswith("h"):
            return IntervalTrigger(hours=int(val[:-1]))
    # Standard cron
    parts = cron_str.strip().split()
    if len(parts) == 5:
        return CronTrigger(
            minute=parts[0], hour=parts[1], day=parts[2],
            month=parts[3], day_of_week=parts[4]
        )
    raise ValueError(f"Invalid cron expression: {cron_str}")


def load_schedules():
    """Load all enabled schedules from DB into APScheduler."""
    # Remove all existing jobs first
    scheduler.remove_all_jobs()

    schedules = get_schedules()
    loaded = 0
    for sched in schedules:
        if not sched.get("enabled", True):
            continue
        try:
            trigger = _parse_cron(sched["cron"])
            scheduler.add_job(
                _run_scheduled_skill,
                trigger=trigger,
                id=f"sched_{sched['id']}",
                args=[sched["id"], sched["skill"]],
                kwargs={"payload": sched.get("payload", {})},
                replace_existing=True,
                name=sched.get("name", sched["skill"]),
            )
            # Calculate and store next run time
            job = scheduler.get_job(f"sched_{sched['id']}")
            if job and job.next_run_time:
                update_schedule(sched["id"], next_run=job.next_run_time.isoformat())
            loaded += 1
        except Exception as e:
            logger.error(f"Failed to load schedule {sched['id']}: {e}")

    logger.info(f"Loaded {loaded}/{len(schedules)} schedules")
    return loaded


def add_schedule_job(sched_id: str, cron: str, skill: str, name: str = "", payload: dict = None):
    """Add or update a single schedule in APScheduler."""
    try:
        trigger = _parse_cron(cron)
        scheduler.add_job(
            _run_scheduled_skill,
            trigger=trigger,
            id=f"sched_{sched_id}",
            args=[sched_id, skill],
            kwargs={"payload": payload or {}},
            replace_existing=True,
            name=name or skill,
        )
        # Update next run
        job = scheduler.get_job(f"sched_{sched_id}")
        if job and job.next_run_time:
            update_schedule(sched_id, next_run=job.next_run_time.isoformat())
        return True
    except Exception as e:
        logger.error(f"Failed to add schedule {sched_id}: {e}")
        return False


def remove_schedule_job(sched_id: str):
    """Remove a schedule from APScheduler."""
    try:
        scheduler.remove_job(f"sched_{sched_id}")
    except Exception:
        pass


def pause_schedule_job(sched_id: str):
    """Pause a schedule."""
    try:
        scheduler.pause_job(f"sched_{sched_id}")
    except Exception:
        pass


def resume_schedule_job(sched_id: str):
    """Resume a paused schedule."""
    try:
        scheduler.resume_job(f"sched_{sched_id}")
    except Exception:
        pass


def get_scheduler_status() -> dict:
    """Get the current state of the scheduler."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "pending": job.pending,
        })
    return {
        "running": scheduler.running,
        "job_count": len(jobs),
        "jobs": jobs,
    }


def start_scheduler():
    """Start the scheduler and load all schedules."""
    if not scheduler.running:
        scheduler.start()
        load_schedules()
        logger.info("Scheduler started")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
