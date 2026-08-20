import sqlite3
import uuid
from datetime import datetime
from contextlib import contextmanager
from .config import DB_PATH


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                skill TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                priority INTEGER NOT NULL DEFAULT 5,
                payload TEXT NOT NULL DEFAULT '{}',
                result TEXT,
                error TEXT,
                triggered_by TEXT NOT NULL DEFAULT 'dashboard',
                retries INTEGER NOT NULL DEFAULT 0,
                max_retries INTEGER NOT NULL DEFAULT 3,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                cron TEXT NOT NULL,
                skill TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                enabled INTEGER NOT NULL DEFAULT 1,
                last_run TEXT,
                next_run TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS job_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                skill TEXT NOT NULL,
                status TEXT NOT NULL,
                duration_ms INTEGER,
                error TEXT,
                completed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS todos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'todo',
                category TEXT NOT NULL DEFAULT 'other',
                priority INTEGER NOT NULL DEFAULT 3,
                progress INTEGER NOT NULL DEFAULT 0,
                vault_path TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS voice_calls (
                call_id TEXT PRIMARY KEY,
                retell_call_id TEXT,
                campaign TEXT NOT NULL DEFAULT 'ascendance',
                lead_name TEXT NOT NULL DEFAULT '',
                business TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'queued',
                transcript TEXT NOT NULL DEFAULT '',
                disposition TEXT,
                demo_booked_at TEXT,
                recording_url TEXT,
                notes TEXT NOT NULL DEFAULT '',
                simulated INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                ended_at TEXT
            );
        """)
        # Migrate older DBs that predate the notes column.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(voice_calls)").fetchall()}
        if "notes" not in cols:
            conn.execute("ALTER TABLE voice_calls ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
    seed_todos()


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def create_job(skill: str, payload: dict, priority: int = 5, triggered_by: str = "dashboard") -> dict:
    import json
    job_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO jobs (id, skill, status, priority, payload, triggered_by, created_at) VALUES (?, ?, 'queued', ?, ?, ?, ?)",
            (job_id, skill, priority, json.dumps(payload), triggered_by, now),
        )
    return {"id": job_id, "skill": skill, "status": "queued", "priority": priority, "created_at": now}


def get_jobs(status: str = None, limit: int = 50) -> list:
    import json
    with get_conn() as conn:
        if status:
            rows = conn.execute("SELECT * FROM jobs WHERE status = ? ORDER BY priority ASC, created_at DESC LIMIT ?", (status, limit)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_job(job_id: str, **fields):
    import json
    sets = []
    vals = []
    for k, v in fields.items():
        sets.append(f"{k} = ?")
        vals.append(json.dumps(v) if isinstance(v, dict) else v)
    vals.append(job_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?", vals)


def get_job(job_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    return _row_to_dict(row) if row else None


def _row_to_dict(row) -> dict:
    import json
    d = dict(row)
    if "payload" in d and isinstance(d["payload"], str):
        try:
            d["payload"] = json.loads(d["payload"])
        except (json.JSONDecodeError, TypeError):
            pass
    return d


# Schedule CRUD
def create_schedule(name: str, cron: str, skill: str, payload: dict = None) -> dict:
    import json
    sched_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO schedules (id, name, cron, skill, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (sched_id, name, cron, skill, json.dumps(payload or {}), now),
        )
    return {"id": sched_id, "name": name, "cron": cron, "skill": skill}


def get_schedules() -> list:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM schedules ORDER BY created_at DESC").fetchall()
    return [_row_to_dict(r) for r in rows]


def update_schedule(sched_id: str, **fields):
    import json
    sets = []
    vals = []
    for k, v in fields.items():
        sets.append(f"{k} = ?")
        vals.append(json.dumps(v) if isinstance(v, dict) else v)
    vals.append(sched_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE schedules SET {', '.join(sets)} WHERE id = ?", vals)


def delete_schedule(sched_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM schedules WHERE id = ?", (sched_id,))


# ─────────────────── To-Dos / Project Tracker ───────────────────
# Personal project to-do list (NOT the agent job queue). These represent
# Gav's ongoing projects that aren't finished / fully sellable yet.

def create_todo(title: str, description: str = "", status: str = "todo",
                category: str = "other", priority: int = 3,
                progress: int = 0, vault_path: str = "") -> dict:
    todo_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO todos (id, title, description, status, category,
               priority, progress, vault_path, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (todo_id, title, description, status, category, priority,
             progress, vault_path, now, now),
        )
    return {"id": todo_id, "title": title, "status": status, "category": category,
            "priority": priority, "progress": progress}


def get_todos(status: str = None) -> list:
    with get_conn() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM todos WHERE status = ? ORDER BY priority ASC, created_at ASC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM todos ORDER BY priority ASC, created_at ASC"
            ).fetchall()
    return [dict(r) for r in rows]


def update_todo(todo_id: str, **fields):
    fields = {k: v for k, v in fields.items()
              if k in ("title", "description", "status", "category",
                       "priority", "progress", "vault_path")}
    if not fields:
        return
    fields["updated_at"] = datetime.utcnow().isoformat()
    sets = [f"{k} = ?" for k in fields]
    vals = list(fields.values()) + [todo_id]
    with get_conn() as conn:
        conn.execute(f"UPDATE todos SET {', '.join(sets)} WHERE id = ?", vals)


def delete_todo(todo_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))


# ─────────────────── Voice Caller (outbound AI calls) ───────────────────

def create_voice_call(call_id: str, lead_name: str, business: str, phone: str,
                      campaign: str = "ascendance", simulated: bool = False,
                      retell_call_id: str | None = None) -> dict:
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO voice_calls (call_id, retell_call_id, campaign, lead_name,
               business, phone, status, simulated, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'dialing', ?, ?)""",
            (call_id, retell_call_id, campaign, lead_name, business, phone,
             1 if simulated else 0, now),
        )
    return {"call_id": call_id, "lead_name": lead_name, "business": business,
            "phone": phone, "status": "dialing", "simulated": simulated,
            "created_at": now}


def update_voice_call(call_id: str, **fields):
    allowed = ("retell_call_id", "status", "transcript", "disposition",
               "demo_booked_at", "recording_url", "notes", "ended_at")
    fields = {k: v for k, v in fields.items() if k in allowed}
    if not fields:
        return
    sets = [f"{k} = ?" for k in fields]
    vals = list(fields.values()) + [call_id]
    with get_conn() as conn:
        conn.execute(f"UPDATE voice_calls SET {', '.join(sets)} WHERE call_id = ?", vals)


def get_voice_calls(limit: int = 50) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM voice_calls ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_voice_call(call_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM voice_calls WHERE call_id = ?", (call_id,)
        ).fetchone()
    return dict(row) if row else None


def mark_orphaned_calls_ended() -> int:
    """End any call still flagged live/dialing — its poll loop died (e.g. a
    backend restart), so it would otherwise show 'ongoing' forever."""
    now = datetime.utcnow().isoformat()
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE voice_calls SET status='ended', ended_at=COALESCE(ended_at, ?) "
            "WHERE status IN ('live', 'dialing')", (now,)
        )
        return cur.rowcount


# Sample project inventory. Replace with your own, or leave empty to start clean.
# Seeded once on first boot, only when the table is empty.
_SEED_TODOS = [
    ("Client Website Launch", "Wire up the contact form IDs and end-to-end test every form before go-live.", "in_progress", "website", 1, 85, "Projects/Client Website/Deployment Guide.md"),
    ("Receipt Capture Pipeline", "Run the auth and setup steps, drop a test receipt, and verify the full pipeline end to end.", "in_progress", "automation", 2, 90, "Projects/Receipt Pipeline/Handoff.md"),
    ("Email Intelligence Agent", "Add the search API key to the environment file, install requirements, and run a dry-run on first boot.", "in_progress", "automation", 2, 70, "Projects/Email Agent/Setup.md"),
    ("Forms Backend", "Multi-tenant zero-retention Worker. Go-live blocked on domain verification and an email API key.", "blocked", "automation", 2, 80, "Projects/Forms Backend/Spec.md"),
    ("Voice Receptionist", "Provision a phone number, finish the workflow setup, build the calendar webhook, then test with real calls.", "in_progress", "ai_agent", 3, 40, "Projects/Voice Receptionist/Build.md"),
    ("Analytics Rollout", "Add the analytics property to every live property and confirm events are firing.", "todo", "website", 2, 10, "Projects/Analytics/Plan.md"),
]


def seed_todos():
    """Seed the project inventory once, only if the table is empty."""
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM todos").fetchone()["c"]
    if count:
        return
    for (title, desc, status, category, priority, progress, path) in _SEED_TODOS:
        create_todo(title, desc, status, category, priority, progress, path)
