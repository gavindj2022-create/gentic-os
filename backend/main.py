import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .database import init_db
from .ws_manager import ws_manager
from .integrations import olivia, obsidian, skills
from .integrations.claude_monitor import get_active_sessions, get_session_summary
from .orchestrator import process_queue
from .scheduler import start_scheduler, stop_scheduler, get_scheduler_status, load_schedules, add_schedule_job, remove_schedule_job
from .config import WORKFORCE_CONFIG, BUDGET_CAPS, PROJECT_REGISTRY
from .workforce.database import init_workforce_db, init_budgets, seed_default_agents
from .workforce.executors import init_executors
from .workforce.manager import workforce_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Any call left 'live'/'dialing' from a previous run can't be finalized by a
    # (now-dead) poll loop — close them so the cockpit never shows a stuck call.
    from .database import mark_orphaned_calls_ended
    mark_orphaned_calls_ended()
    # Phase 4: Workforce init
    init_workforce_db()
    init_budgets(BUDGET_CAPS)
    seed_default_agents()
    init_executors(WORKFORCE_CONFIG)
    # Background tasks
    poll_task = asyncio.create_task(_poll_status())
    queue_task = asyncio.create_task(process_queue())
    claude_task = asyncio.create_task(_poll_claude_sessions())
    outbound_task = asyncio.create_task(_poll_outbound())
    start_scheduler()
    await workforce_manager.start()
    yield
    await workforce_manager.stop()
    stop_scheduler()
    poll_task.cancel()
    queue_task.cancel()
    claude_task.cancel()
    outbound_task.cancel()


app = FastAPI(title="GenTIC OS", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- WebSocket ---

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


# --- System Status ---

@app.get("/api/system")
async def api_system():
    status = await olivia.get_status()
    return {
        "olivia": {
            "online": status.get("system") == "online",
            "ai_routing": status.get("ai_routing", "unknown"),
            "available_ais": status.get("available_ais", {}),
            "conversation_count": status.get("conversation_count", 0),
            "active_subagents": status.get("active_subagents", []),
            "active_projects": status.get("active_projects", []),
            "hot_topics": status.get("hot_topics", []),
            "last_sentiment": status.get("last_sentiment", "neutral"),
            "last_query": status.get("last_query", ""),
            "recent_exchanges": status.get("recent_exchanges", []),
            "muted": status.get("muted", False),
            "sleeping": status.get("sleeping", False),
        },
        "gentic": {"version": "0.1.0", "status": "online"},
    }


# --- OLIVIA proxies ---

@app.get("/api/status")
async def api_status():
    return await olivia.get_status()


@app.get("/api/fear")
async def api_fear():
    return await olivia.get_fear()


@app.get("/api/tokens")
async def api_tokens():
    return await olivia.get_tokens()


@app.get("/api/digest")
async def api_digest():
    return await olivia.get_digest()


@app.get("/api/carbiz")
async def api_carbiz():
    return await olivia.get_carbiz()


@app.get("/api/knowledge")
async def api_knowledge():
    return await olivia.get_knowledge()


@app.post("/api/command")
async def api_command(body: dict):
    cmd = body.get("command", "").strip()
    if not cmd:
        return {"status": "error", "message": "no command"}
    result = await olivia.send_command(cmd)
    await ws_manager.broadcast("command_sent", {"command": cmd, "result": result})
    return result


# --- Skills ---

@app.get("/api/skills")
async def api_skills():
    return {"skills": skills.get_available_skills()}


# --- Vault / Obsidian ---

@app.get("/api/vault/search")
async def api_vault_search(q: str, limit: int = 20):
    return {"results": obsidian.search_vault(q, limit)}


@app.get("/api/vault/stats")
async def api_vault_stats():
    return obsidian.get_vault_stats()


@app.get("/api/vault/daily")
async def api_vault_daily(date: str = None):
    content = obsidian.get_daily_note(date)
    return {"date": date, "content": content}


# --- Jobs (Phase 2 prep - basic endpoints now) ---

from .database import create_job, get_jobs, get_job, update_job

@app.get("/api/jobs")
async def api_jobs(status: str = None, limit: int = 50):
    return {"jobs": get_jobs(status, limit)}


@app.get("/api/jobs/{job_id}")
async def api_job_detail(job_id: str):
    job = get_job(job_id)
    if not job:
        return {"error": "not found"}
    return job


@app.post("/api/jobs")
async def api_create_job(body: dict):
    skill = body.get("skill", "")
    payload = body.get("payload", {})
    priority = body.get("priority", 5)
    if not skill:
        return {"error": "skill required"}
    job = create_job(skill, payload, priority, triggered_by="dashboard")
    await ws_manager.broadcast("job_created", job)
    return job


# --- To-Dos / Project Tracker ---

from .database import create_todo, get_todos, update_todo, delete_todo

@app.get("/api/todos")
async def api_todos(status: str = None):
    return {"todos": get_todos(status)}


@app.post("/api/todos")
async def api_create_todo(body: dict):
    title = body.get("title", "").strip()
    if not title:
        return {"error": "title required"}
    todo = create_todo(
        title=title,
        description=body.get("description", ""),
        status=body.get("status", "todo"),
        category=body.get("category", "other"),
        priority=body.get("priority", 3),
        progress=body.get("progress", 0),
        vault_path=body.get("vault_path", ""),
    )
    await ws_manager.broadcast("todo_created", todo)
    return todo


@app.put("/api/todos/{todo_id}")
async def api_update_todo(todo_id: str, body: dict):
    update_todo(todo_id, **body)
    await ws_manager.broadcast("todo_updated", {"id": todo_id, **body})
    return {"status": "updated"}


@app.delete("/api/todos/{todo_id}")
async def api_delete_todo(todo_id: str):
    delete_todo(todo_id)
    return {"status": "deleted"}


# --- Limitless Outbound (cold email campaign dashboard) ---

from .integrations import outbound

@app.get("/api/outbound/stats")
async def api_outbound_stats(track: str | None = None):
    return outbound.get_stats(track)


@app.get("/api/outbound/pipeline")
async def api_outbound_pipeline(track: str | None = None):
    return outbound.get_pipeline(track)


@app.get("/api/outbound/agents")
async def api_outbound_agents():
    return outbound.get_agents()


@app.post("/api/outbound/killswitch")
async def api_outbound_killswitch(body: dict):
    try:
        result = await outbound.set_killswitch(bool(body.get("active")))
    except Exception as e:
        return {"error": str(e)}
    await ws_manager.broadcast("outbound_update", outbound.get_stats())
    return result


@app.get("/api/outbound/config")
async def api_outbound_config():
    cfg = outbound.load_config()
    return {"sheet_id": cfg.get("sheet_id", ""), "n8n_url": cfg.get("n8n_url", ""),
            "n8n_key_set": bool(cfg.get("n8n_api_key"))}


@app.post("/api/outbound/config")
async def api_outbound_set_config(body: dict):
    outbound.save_config({k: body.get(k) for k in ("sheet_id", "n8n_url", "n8n_api_key", "wf1_id")})
    await outbound.poll_tracker()
    return {"status": "saved"}


async def _poll_outbound():
    """Refresh outbound tracker + sender state every 60s, broadcast on change."""
    last_hash = None
    while True:
        try:
            ok = await outbound.poll_tracker()
            await outbound.refresh_sender_state()
            if ok:
                import hashlib, json
                stats = outbound.get_stats()
                h = hashlib.md5(json.dumps(stats, sort_keys=True, default=str).encode()).hexdigest()
                if h != last_hash:
                    await ws_manager.broadcast("outbound_update", stats)
                    last_hash = h
        except Exception:
            pass
        await asyncio.sleep(60)


# --- Schedules (Phase 3 — fully wired) ---

from .database import get_schedules, create_schedule, update_schedule, delete_schedule

@app.get("/api/schedules")
async def api_schedules():
    return {"schedules": get_schedules()}


@app.post("/api/schedules")
async def api_create_schedule(body: dict):
    name = body.get("name", "")
    cron = body.get("cron", "")
    skill = body.get("skill", "")
    if not all([name, cron, skill]):
        return {"error": "name, cron, and skill required"}
    sched = create_schedule(name, cron, skill, body.get("payload", {}))
    # Register with APScheduler
    add_schedule_job(sched["id"], cron, skill, name, body.get("payload", {}))
    await ws_manager.broadcast("schedule_created", sched)
    return sched


@app.put("/api/schedules/{sched_id}")
async def api_update_schedule(sched_id: str, body: dict):
    enabled = body.get("enabled")
    if enabled is not None:
        update_schedule(sched_id, enabled=int(enabled))
        if enabled:
            # Re-add to scheduler
            schedules = get_schedules()
            sched = next((s for s in schedules if s["id"] == sched_id), None)
            if sched:
                add_schedule_job(sched_id, sched["cron"], sched["skill"], sched.get("name", ""), sched.get("payload", {}))
        else:
            remove_schedule_job(sched_id)
    return {"status": "updated"}


@app.post("/api/schedules/{sched_id}/run")
async def api_run_schedule_now(sched_id: str):
    """Run a schedule immediately (one-shot)."""
    schedules = get_schedules()
    sched = next((s for s in schedules if s["id"] == sched_id), None)
    if not sched:
        return {"error": "not found"}
    job = create_job(sched["skill"], sched.get("payload", {}), priority=2, triggered_by=f"manual:{sched_id}")
    await ws_manager.broadcast("job_created", job)
    return {"status": "fired", "job": job}


@app.delete("/api/schedules/{sched_id}")
async def api_delete_schedule(sched_id: str):
    remove_schedule_job(sched_id)
    delete_schedule(sched_id)
    return {"status": "deleted"}


@app.get("/api/scheduler/status")
async def api_scheduler_status():
    return get_scheduler_status()


# --- Workforce (Phase 4) ---

from .workforce import database as wf_db
from .workforce.budget import budget_tracker
from .workforce.scanner import scan_all_projects

@app.get("/api/workforce/status")
async def api_workforce_status():
    return workforce_manager.get_status()

@app.get("/api/workforce/agents")
async def api_workforce_agents():
    return {"agents": wf_db.get_agent_workers()}

@app.post("/api/workforce/agents")
async def api_create_workforce_agent(body: dict):
    name = body.get("name", "")
    provider = body.get("provider", "")
    model_name = body.get("model_name", "")
    if not all([name, provider, model_name]):
        return {"error": "name, provider, and model_name required"}
    agent = wf_db.create_agent_worker(name, provider, model_name, body.get("config", {}))
    return agent

@app.put("/api/workforce/agents/{agent_id}")
async def api_update_workforce_agent(agent_id: str, body: dict):
    action = body.get("action", "")
    if action == "pause":
        workforce_manager.pause_agent(agent_id)
    elif action == "resume":
        workforce_manager.resume_agent(agent_id)
    else:
        fields = {k: v for k, v in body.items() if k in ("name", "model_name", "status", "config")}
        if fields:
            wf_db.update_agent_worker(agent_id, **fields)
    return {"status": "updated"}

@app.delete("/api/workforce/agents/{agent_id}")
async def api_delete_workforce_agent(agent_id: str):
    workforce_manager.pause_agent(agent_id)
    wf_db.delete_agent_worker(agent_id)
    return {"status": "deleted"}

# --- Workforce Tasks ---

@app.get("/api/workforce/tasks")
async def api_workforce_tasks(status: str = None, agent: str = None, limit: int = 50):
    return {"tasks": wf_db.get_agent_tasks(status=status, agent_id=agent, limit=limit)}

@app.post("/api/workforce/tasks")
async def api_create_workforce_task(body: dict):
    title = body.get("title", "")
    if not title:
        return {"error": "title required"}
    task = wf_db.create_agent_task(
        title=title,
        description=body.get("description", ""),
        project_path=body.get("project_path", ""),
        category=body.get("category", "general"),
        priority=body.get("priority", 5),
        source=body.get("source", "manual"),
        assigned_agent=body.get("assigned_agent"),
    )
    await ws_manager.broadcast("workforce_task_created", task)
    return task

@app.put("/api/workforce/tasks/{task_id}")
async def api_update_workforce_task(task_id: str, body: dict):
    fields = {k: v for k, v in body.items() if k in ("title", "description", "category", "priority", "assigned_agent", "status")}
    if fields:
        wf_db.update_agent_task(task_id, **fields)
    return {"status": "updated"}

@app.post("/api/workforce/tasks/{task_id}/assign")
async def api_assign_workforce_task(task_id: str, body: dict):
    agent_id = body.get("agent_id", "")
    if not agent_id:
        return {"error": "agent_id required"}
    wf_db.update_agent_task(task_id, assigned_agent=agent_id, status="pending")
    await ws_manager.broadcast("task_assigned", {"task_id": task_id, "agent_id": agent_id})
    return {"status": "assigned"}

# --- Workforce Budget ---

@app.get("/api/workforce/budgets")
async def api_workforce_budgets():
    return {"budgets": budget_tracker.get_status_all()}

@app.put("/api/workforce/budgets/{provider}")
async def api_update_workforce_budget(provider: str, body: dict):
    budget_tracker.update_caps(
        provider,
        monthly_cap=body.get("monthly_cap"),
        daily_token_limit=body.get("daily_token_limit"),
    )
    return {"status": "updated"}

# --- Workforce Scanner ---

@app.get("/api/workforce/scan")
async def api_workforce_scan():
    import asyncio
    recs = await asyncio.to_thread(scan_all_projects, PROJECT_REGISTRY)
    return {"recommendations": recs, "count": len(recs)}

@app.get("/api/workforce/recommendations")
async def api_workforce_recommendations(status: str = None):
    return {"recommendations": wf_db.get_recommendations(status=status)}

@app.post("/api/workforce/recommendations/{rec_id}/assign")
async def api_assign_recommendation(rec_id: str, body: dict):
    agent_id = body.get("agent_id", "")
    if not agent_id:
        return {"error": "agent_id required"}
    # Get the recommendation
    recs = wf_db.get_recommendations()
    rec = next((r for r in recs if r["id"] == rec_id), None)
    if not rec:
        return {"error": "recommendation not found"}
    # Create a task from this recommendation
    task = wf_db.create_agent_task(
        title=rec["title"],
        description=rec["description"],
        project_path="",
        category=rec["category"],
        priority=rec["priority"],
        source="recommendation",
        assigned_agent=agent_id,
    )
    wf_db.update_recommendation(rec_id, status="assigned")
    await ws_manager.broadcast("recommendation_assigned", {"rec_id": rec_id, "task": task})
    return {"status": "assigned", "task": task}

@app.post("/api/workforce/recommendations/{rec_id}/dismiss")
async def api_dismiss_recommendation(rec_id: str):
    wf_db.update_recommendation(rec_id, status="dismissed")
    return {"status": "dismissed"}

# --- Workforce Insights ---

@app.get("/api/workforce/insights")
async def api_workforce_insights(category: str = None, limit: int = 50):
    return {"insights": wf_db.get_insights(category=category, limit=limit)}

@app.get("/api/workforce/insights/{insight_id}")
async def api_workforce_insight_detail(insight_id: str):
    ins = wf_db.get_insight(insight_id)
    if not ins:
        return {"error": "not found"}
    return ins


# --- Claude Code Monitor ---

@app.get("/api/claude/sessions")
async def api_claude_sessions():
    return get_session_summary()


# --- ReceiptVault Usage ---

RECEIPTVAULT_DIR = Path(r"C:\Users\ninja\receiptvault-lite")
RECEIPTVAULT_USAGE_PATH = RECEIPTVAULT_DIR / "Config" / "api_usage.json"
RECEIPTVAULT_PID_PATH = RECEIPTVAULT_DIR / "Config" / "watcher.pid"
RECEIPTVAULT_LOG_PATH = RECEIPTVAULT_DIR / "Config" / "watcher.log"

@app.get("/api/receiptvault/usage")
async def api_receiptvault_usage():
    import json
    if not RECEIPTVAULT_USAGE_PATH.exists():
        return {"users": {}, "totals": {"call_count": 0, "total_cost": 0, "input_tokens": 0, "output_tokens": 0}}
    with open(RECEIPTVAULT_USAGE_PATH) as f:
        data = json.load(f)
    totals = {"call_count": 0, "total_cost": 0, "input_tokens": 0, "output_tokens": 0}
    users = {}
    for uid, u in data.items():
        users[uid] = {
            "call_count": u.get("call_count", 0),
            "total_cost": u.get("total_cost", 0),
            "input_tokens": u.get("total_input_tokens", 0),
            "output_tokens": u.get("total_output_tokens", 0),
            "last_call": u["calls"][-1]["timestamp"] if u.get("calls") else None,
        }
        totals["call_count"] += users[uid]["call_count"]
        totals["total_cost"] += users[uid]["total_cost"]
        totals["input_tokens"] += users[uid]["input_tokens"]
        totals["output_tokens"] += users[uid]["output_tokens"]
    totals["total_cost"] = round(totals["total_cost"], 6)
    return {"users": users, "totals": totals}


# --- Life Dashboard ---

@app.get("/api/life")
async def api_life():
    """Serve Gav's daily schedule state, health log, pool status for the Life page."""
    import json
    from datetime import datetime, timedelta

    olivia_dir = Path("C:/Users/ninja/Gavs Brain/Gavs Brain/OLIVIA")
    vault_dir = Path("C:/Users/ninja/Gavs Brain/Gavs Brain")
    today = datetime.now().strftime("%Y-%m-%d")

    # Health log
    health_log = {}
    health_file = olivia_dir / "health_log.json"
    if health_file.exists():
        try:
            health_log = json.loads(health_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    # Today's health + last 7 days
    today_health = health_log.get(today, {})
    week_health = {}
    for i in range(7):
        d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        if d in health_log:
            week_health[d] = health_log[d]

    # London session log
    london_alerts = []
    london_file = olivia_dir / "london_session_log.json"
    if london_file.exists():
        try:
            all_alerts = json.loads(london_file.read_text(encoding="utf-8"))
            london_alerts = [a for a in all_alerts if a.get("date") == today]
        except Exception:
            pass

    # Schedule state (read from olivia_schedule module if available)
    schedule_state = {
        "date": today,
        "blocks": [
            {"key": "morning_brief",   "time": "08:00", "label": "Morning Brief",      "icon": "sun"},
            {"key": "ny_open_reminder","time": "09:25", "label": "NY Open",             "icon": "trending-up"},
            {"key": "trading_wrapup",  "time": "11:00", "label": "Trading Wrap-up",     "icon": "bar-chart"},
            {"key": "gym_reminder",    "time": "11:30", "label": "Gym",                 "icon": "dumbbell"},
            {"key": "nutrition_checkin","time": "13:00", "label": "Nutrition",           "icon": "utensils"},
            {"key": "pool_rounds",     "time": "13:30", "label": "Pool Rounds",         "icon": "droplets"},
            {"key": "learning_digest", "time": "14:30", "label": "Daily Learning",      "icon": "book-open"},
            {"key": "ai_checkin",      "time": "17:00", "label": "AI Deep Work",        "icon": "cpu"},
            {"key": "eod_recap",       "time": "19:00", "label": "EOD Recap + Health",  "icon": "moon"},
        ],
        "completed": [],
        "is_rest_day": datetime.now().weekday() in [2, 6],
    }

    # Try to read live state from olivia_schedule
    try:
        import sys
        sys.path.insert(0, str(olivia_dir))
        from olivia_schedule import _daily_state, _ensure_today
        _ensure_today()
        schedule_state["completed"] = _daily_state.get("blocks_completed", [])
        schedule_state["trading_journal"] = _daily_state.get("trading_journal", "")
        schedule_state["ai_shipped"] = _daily_state.get("ai_shipped", "")
        schedule_state["awaiting_reply"] = _daily_state.get("awaiting_reply")
    except Exception:
        pass

    # Pool houses
    pools = [
        {"name": "Westgate", "type": "airbnb"},
        {"name": "Hickory", "type": "airbnb"},
        {"name": "Dove", "type": "home"},
    ]

    # Today's daily note excerpt
    daily_note = ""
    for dn_dir in [vault_dir / "Daily", vault_dir / "Daily Notes"]:
        dn_path = dn_dir / f"{today}.md"
        if dn_path.exists():
            try:
                daily_note = dn_path.read_text(encoding="utf-8")[:2000]
            except Exception:
                pass
            break

    # Health trends (last 7 days)
    trends = {"alcohol_days": 0, "weed_days": 0, "nic_days": 0, "avg_allergy": 0, "days_tracked": 0}
    allergy_scores = []
    for d, data in week_health.items():
        trends["days_tracked"] += 1
        if data.get("alcohol") and data["alcohol"] != 0:
            trends["alcohol_days"] += 1
        if data.get("weed"):
            trends["weed_days"] += 1
        if data.get("nicotine"):
            trends["nic_days"] += 1
        if isinstance(data.get("allergies"), (int, float)):
            allergy_scores.append(data["allergies"])
    if allergy_scores:
        trends["avg_allergy"] = round(sum(allergy_scores) / len(allergy_scores), 1)

    return {
        "today": today,
        "schedule": schedule_state,
        "pools": pools,
        "health_today": today_health,
        "health_week": week_health,
        "health_trends": trends,
        "london_alerts": london_alerts,
        "daily_note_excerpt": daily_note[:500],
    }


# --- System Health ---

@app.get("/api/health")
async def api_health():
    import psutil
    import time
    try:
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")
        uptime = time.time() - psutil.boot_time()
        return {
            "cpu_percent": cpu,
            "memory_percent": mem.percent,
            "memory_used_gb": round(mem.used / (1024**3), 1),
            "memory_total_gb": round(mem.total / (1024**3), 1),
            "disk_percent": disk.percent,
            "disk_free_gb": round(disk.free / (1024**3), 1),
            "uptime_hours": round(uptime / 3600, 1),
            "status": "healthy" if cpu < 90 and mem.percent < 90 else "degraded",
        }
    except ImportError:
        return {"status": "unknown", "error": "psutil not installed"}


# --- Background status polling (pushes via WS) ---

async def _poll_status():
    last_hash = None
    while True:
        try:
            status = await olivia.get_status()
            import hashlib, json
            current_hash = hashlib.md5(json.dumps(status, sort_keys=True, default=str).encode()).hexdigest()
            if current_hash != last_hash:
                await ws_manager.broadcast("status_update", status)
                last_hash = current_hash
        except Exception:
            pass
        await asyncio.sleep(5)


async def _poll_claude_sessions():
    """Push Claude Code session updates via WebSocket every few seconds."""
    last_hash = None
    while True:
        try:
            import hashlib, json
            summary = get_session_summary()
            current_hash = hashlib.md5(json.dumps(summary, sort_keys=True, default=str).encode()).hexdigest()
            if current_hash != last_hash:
                await ws_manager.broadcast("claude_sessions", summary)
                last_hash = current_hash
        except Exception:
            pass
        await asyncio.sleep(3)


# --- Voice Caller (autonomous outbound AI sales calls) ---

from .voice import caller, sheets_sync
from .database import get_voice_calls, get_voice_call, update_voice_call

@app.get("/api/caller/status")
async def api_caller_status():
    return caller.get_status()


@app.get("/api/caller/leads")
async def api_caller_leads():
    return caller.load_leads()


@app.get("/api/caller/agents")
async def api_caller_agents():
    return {"agents": caller.list_agents()}


@app.post("/api/caller/active-agent")
async def api_caller_active_agent(body: dict):
    result = caller.set_active_agent(str(body.get("key", "")))
    await ws_manager.broadcast("caller_status", caller.get_status())
    return result


@app.post("/api/caller/agent-voice")
async def api_caller_agent_voice(body: dict):
    result = caller.set_agent_voice(str(body.get("key", "")), str(body.get("voice_id", "")))
    await ws_manager.broadcast("caller_status", caller.get_status())
    return result


@app.get("/api/caller/spend")
async def api_caller_spend():
    return caller.spend_summary()


@app.get("/api/caller/dnc")
async def api_caller_dnc():
    return {"dnc": caller.load_config().get("dnc", [])}


@app.post("/api/caller/dnc")
async def api_caller_dnc_add(body: dict):
    return caller.add_dnc(str(body.get("phone", "")))


@app.post("/api/caller/dnc/remove")
async def api_caller_dnc_remove(body: dict):
    return caller.remove_dnc(str(body.get("phone", "")))


@app.post("/api/caller/call")
async def api_caller_call(body: dict):
    lead = body.get("lead") or body
    if not (lead.get("phone") or lead.get("phone_raw")):
        return {"error": "lead phone required"}
    result = await caller.place_call(
        lead,
        override_hours=bool(body.get("override_hours")),
        agent_key=body.get("agent_key") or body.get("agent"),
    )
    return result


@app.get("/api/caller/calls")
async def api_caller_calls(limit: int = 50):
    return {"calls": get_voice_calls(limit)}


@app.get("/api/caller/calls/{call_id}")
async def api_caller_call_detail(call_id: str):
    call = get_voice_call(call_id)
    if not call:
        return {"error": "not found"}
    return call


@app.post("/api/caller/calls/{call_id}/disposition")
async def api_caller_disposition(call_id: str, body: dict):
    disposition = body.get("disposition", "")
    fields = {"disposition": disposition}
    if disposition == "Demo booked":
        from datetime import datetime as _dt
        fields["demo_booked_at"] = _dt.utcnow().isoformat()
    update_voice_call(call_id, **fields)
    await caller.sync_call_record(call_id)
    await ws_manager.broadcast("voice_call_update", {"call_id": call_id, **fields})
    return {"status": "updated", **fields}


@app.post("/api/caller/calls/{call_id}/end")
async def api_caller_end(call_id: str):
    return await caller.end_call(call_id)


@app.post("/api/caller/calls/{call_id}/notes")
async def api_caller_notes(call_id: str, body: dict):
    return await caller.save_notes(call_id, str(body.get("notes", "")))


@app.post("/api/caller/webhook")
async def api_caller_webhook(body: dict):
    return await caller.handle_webhook(body)


@app.post("/api/caller/killswitch")
async def api_caller_killswitch(body: dict):
    cfg = caller.set_kill_switch(bool(body.get("active")))
    await ws_manager.broadcast("caller_status", caller.get_status())
    return {"kill_switch": cfg.get("kill_switch")}


@app.get("/api/caller/config")
async def api_caller_config():
    cfg = caller.load_config()
    data = {k: cfg.get(k) for k in (
        "caller_name", "demo_owner", "callback_number", "from_number", "price",
        "simulate", "google_sheet_id", "google_sheet_url"
    )}
    data["sheet_webhook_configured"] = bool(sheets_sync.status().get("webhook_configured"))
    data["sheet_sync"] = sheets_sync.status()
    return data


@app.post("/api/caller/config")
async def api_caller_set_config(body: dict):
    cfg = caller.save_config({k: body.get(k) for k in (
        "caller_name", "demo_owner", "callback_number", "from_number",
        "price", "simulate", "google_sheet_id", "google_sheet_url",
        "sheet_webhook_url") if k in body})
    await ws_manager.broadcast("caller_status", caller.get_status())
    return {"status": "saved", "demo_owner": cfg.get("demo_owner"),
            "sheet_sync": sheets_sync.status()}


@app.get("/api/caller/sheet")
async def api_caller_sheet():
    return sheets_sync.status()


@app.post("/api/caller/sync-sheet")
async def api_caller_sync_sheet(limit: int = 200):
    return await caller.sync_all_calls(limit)


# --- Serve frontend in production ---

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
