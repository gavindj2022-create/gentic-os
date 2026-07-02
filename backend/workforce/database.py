"""Workforce database — tables and CRUD for agents, tasks, budgets, insights, recommendations."""

import json
import uuid
from datetime import datetime
from ..database import get_conn, _row_to_dict


def init_workforce_db():
    """Create workforce tables (safe to call multiple times)."""
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS agent_workers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider TEXT NOT NULL,
                model_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'idle',
                current_task_id TEXT,
                created_at TEXT NOT NULL,
                config TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS agent_tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                project_path TEXT DEFAULT '',
                category TEXT NOT NULL DEFAULT 'general',
                assigned_agent TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                priority INTEGER NOT NULL DEFAULT 5,
                source TEXT NOT NULL DEFAULT 'manual',
                result TEXT,
                tokens_used INTEGER NOT NULL DEFAULT 0,
                cost_usd REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_budgets (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                period TEXT NOT NULL,
                limit_tokens INTEGER NOT NULL DEFAULT 0,
                used_tokens INTEGER NOT NULL DEFAULT 0,
                limit_usd REAL NOT NULL DEFAULT 0.0,
                used_usd REAL NOT NULL DEFAULT 0.0,
                reset_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_insights (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                confidence REAL NOT NULL DEFAULT 0.8,
                obsidian_path TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_recommendations (
                id TEXT PRIMARY KEY,
                project TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'general',
                priority INTEGER NOT NULL DEFAULT 5,
                suggested_agent TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL
            );
        """)


def _uid():
    return str(uuid.uuid4())[:8]


def _now():
    return datetime.utcnow().isoformat()


# ──────────────────── Agent Workers ────────────────────

def create_agent_worker(name: str, provider: str, model_name: str, config: dict = None) -> dict:
    wid = _uid()
    now = _now()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO agent_workers (id, name, provider, model_name, status, created_at, config) VALUES (?,?,?,?,?,?,?)",
            (wid, name, provider, model_name, "idle", now, json.dumps(config or {})),
        )
    return {"id": wid, "name": name, "provider": provider, "model_name": model_name, "status": "idle", "created_at": now, "config": config or {}}


def get_agent_workers() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM agent_workers ORDER BY created_at").fetchall()
    results = []
    for r in rows:
        d = _row_to_dict(r)
        if "config" in d and isinstance(d["config"], str):
            try:
                d["config"] = json.loads(d["config"])
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(d)
    return results


def get_agent_worker(agent_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM agent_workers WHERE id = ?", (agent_id,)).fetchone()
    if not row:
        return None
    d = _row_to_dict(row)
    if "config" in d and isinstance(d["config"], str):
        try:
            d["config"] = json.loads(d["config"])
        except (json.JSONDecodeError, TypeError):
            pass
    return d


def update_agent_worker(agent_id: str, **fields):
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f"{k} = ?")
        vals.append(json.dumps(v) if isinstance(v, dict) else v)
    vals.append(agent_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE agent_workers SET {', '.join(sets)} WHERE id = ?", vals)


def delete_agent_worker(agent_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM agent_workers WHERE id = ?", (agent_id,))


# ──────────────────── Agent Tasks ────────────────────

def create_agent_task(title: str, description: str = "", project_path: str = "",
                      category: str = "general", priority: int = 5,
                      source: str = "manual", assigned_agent: str = None) -> dict:
    tid = _uid()
    now = _now()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO agent_tasks
               (id, title, description, project_path, category, assigned_agent, status, priority, source, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (tid, title, description, project_path, category, assigned_agent, "pending", priority, source, now),
        )
    return {
        "id": tid, "title": title, "description": description, "project_path": project_path,
        "category": category, "assigned_agent": assigned_agent, "status": "pending",
        "priority": priority, "source": source, "created_at": now,
    }


def get_agent_tasks(status: str = None, agent_id: str = None, limit: int = 50) -> list[dict]:
    clauses, params = [], []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if agent_id:
        clauses.append("assigned_agent = ?")
        params.append(agent_id)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM agent_tasks {where} ORDER BY priority ASC, created_at DESC LIMIT ?", params
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_agent_task(task_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM agent_tasks WHERE id = ?", (task_id,)).fetchone()
    return _row_to_dict(row) if row else None


def update_agent_task(task_id: str, **fields):
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f"{k} = ?")
        vals.append(json.dumps(v) if isinstance(v, dict) else v)
    vals.append(task_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE agent_tasks SET {', '.join(sets)} WHERE id = ?", vals)


# ──────────────────── Budget ────────────────────

def init_budgets(budget_caps: dict):
    """Seed budget rows if missing. Called at startup."""
    now = _now()
    with get_conn() as conn:
        for provider, caps in budget_caps.items():
            # Daily row
            existing = conn.execute(
                "SELECT id FROM agent_budgets WHERE provider = ? AND period = 'daily'", (provider,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO agent_budgets (id, provider, period, limit_tokens, used_tokens, limit_usd, used_usd, reset_at) VALUES (?,?,?,?,?,?,?,?)",
                    (_uid(), provider, "daily", caps.get("daily_tokens", 0), 0, 0, 0, now),
                )
            # Monthly row
            existing = conn.execute(
                "SELECT id FROM agent_budgets WHERE provider = ? AND period = 'monthly'", (provider,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO agent_budgets (id, provider, period, limit_tokens, used_tokens, limit_usd, used_usd, reset_at) VALUES (?,?,?,?,?,?,?,?)",
                    (_uid(), provider, "monthly", 0, 0, caps.get("monthly_usd", 0), 0, now),
                )


def get_budget(provider: str, period: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM agent_budgets WHERE provider = ? AND period = ?", (provider, period)
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_all_budgets() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM agent_budgets ORDER BY provider, period").fetchall()
    return [_row_to_dict(row) for row in rows]


def update_budget(provider: str, period: str, **fields):
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f"{k} = ?")
        vals.append(v)
    vals.extend([provider, period])
    with get_conn() as conn:
        conn.execute(f"UPDATE agent_budgets SET {', '.join(sets)} WHERE provider = ? AND period = ?", vals)


def log_token_usage(provider: str, tokens: int, cost_usd: float):
    """Increment daily token count and monthly cost."""
    with get_conn() as conn:
        conn.execute(
            "UPDATE agent_budgets SET used_tokens = used_tokens + ? WHERE provider = ? AND period = 'daily'",
            (tokens, provider),
        )
        conn.execute(
            "UPDATE agent_budgets SET used_usd = used_usd + ? WHERE provider = ? AND period = 'monthly'",
            (cost_usd, provider),
        )


def reset_daily_budgets():
    now = _now()
    with get_conn() as conn:
        conn.execute("UPDATE agent_budgets SET used_tokens = 0, reset_at = ? WHERE period = 'daily'", (now,))


def reset_monthly_budgets():
    now = _now()
    with get_conn() as conn:
        conn.execute("UPDATE agent_budgets SET used_usd = 0, reset_at = ? WHERE period = 'monthly'", (now,))


# ──────────────────── Insights ────────────────────

def create_insight(task_id: str, agent_id: str, category: str, title: str,
                   content: str, confidence: float = 0.8, obsidian_path: str = None) -> dict:
    iid = _uid()
    now = _now()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO agent_insights
               (id, task_id, agent_id, category, title, content, confidence, obsidian_path, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (iid, task_id, agent_id, category, title, content, confidence, obsidian_path, now),
        )
    return {"id": iid, "task_id": task_id, "agent_id": agent_id, "category": category,
            "title": title, "content": content, "confidence": confidence, "obsidian_path": obsidian_path, "created_at": now}


def get_insights(category: str = None, limit: int = 50) -> list[dict]:
    if category:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM agent_insights WHERE category = ? ORDER BY created_at DESC LIMIT ?",
                (category, limit),
            ).fetchall()
    else:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM agent_insights ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_insight(insight_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM agent_insights WHERE id = ?", (insight_id,)).fetchone()
    return _row_to_dict(row) if row else None


# ──────────────────── Recommendations ────────────────────

def create_recommendation(project: str, title: str, description: str = "",
                          category: str = "general", priority: int = 5,
                          suggested_agent: str = None) -> dict:
    rid = _uid()
    now = _now()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO agent_recommendations
               (id, project, title, description, category, priority, suggested_agent, status, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (rid, project, title, description, category, priority, suggested_agent, "pending", now),
        )
    return {"id": rid, "project": project, "title": title, "description": description,
            "category": category, "priority": priority, "suggested_agent": suggested_agent,
            "status": "pending", "created_at": now}


def get_recommendations(status: str = None) -> list[dict]:
    if status:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM agent_recommendations WHERE status = ? ORDER BY priority ASC, created_at DESC",
                (status,),
            ).fetchall()
    else:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM agent_recommendations ORDER BY priority ASC, created_at DESC"
            ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_recommendation(rec_id: str, **fields):
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f"{k} = ?")
        vals.append(v)
    vals.append(rec_id)
    with get_conn() as conn:
        conn.execute(f"UPDATE agent_recommendations SET {', '.join(sets)} WHERE id = ?", vals)


def seed_default_agents():
    """Create the 4 default agents if table is empty."""
    existing = get_agent_workers()
    if existing:
        return existing

    defaults = [
        ("Claude Builder", "claude", "claude-sonnet-4-20250514"),
        ("GPT Coder", "openai", "gpt-4o"),
        ("Gemini Researcher", "gemini", "gemini-2.0-flash"),
        ("Ollama Worker", "ollama", "llama3"),
    ]
    agents = []
    for name, provider, model in defaults:
        agent = create_agent_worker(name, provider, model)
        agents.append(agent)
    return agents
