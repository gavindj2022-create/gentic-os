"""Limitless Outbound — reads the campaign tracker Google Sheet (link-shared CSV
export, no auth) and exposes stats/pipeline for the /outbound dashboard page.
Kill switch toggles WF1's active flag via the n8n Cloud public API."""

import asyncio
import csv
import io
import json
from datetime import date
from pathlib import Path

import httpx
import os

CONFIG_PATH = Path(__file__).parent.parent / "outbound_config.json"
# The outbound agent team writes its heartbeat here (separate limitless-outbound repo).
AGENTS_STATUS_PATH = Path(r"C:\Users\ninja\limitless-outbound\agents\team_status.json")
SECRET_MARKER = "__encrypted__"

# Static team manifest (mirrors agents/orchestrator.py TEAM) so the panel renders
# even before any agent has run and written a heartbeat.
TEAM_MANIFEST = [
    {"name": "Prospector", "role": "Finds & ranks leads per niche, runs them through suppression", "category": "expansion", "human_in_loop": False},
    {"name": "Copywriter", "role": "Writes personalized hooks + sequences per offer×niche", "category": "revenue", "human_in_loop": False},
    {"name": "Deliverability", "role": "Spam-trigger scan, warmup ramp, domain health", "category": "improvement", "human_in_loop": False},
    {"name": "ReplyHandler", "role": "Classifies replies, drafts responses, routes hot leads", "category": "revenue", "human_in_loop": True},
    {"name": "ComplianceGuard", "role": "CAN-SPAM gate, suppression, secrets, kill switch", "category": "security", "human_in_loop": False},
    {"name": "Orchestrator", "role": "Schedules the team, gates on compliance, reports status", "category": "general", "human_in_loop": False},
]


def _resolve_secret(name: str, cfg: dict) -> str:
    """Read a secret: env override wins; if the config value is the encrypted
    marker, fall back to the env var; otherwise use the plaintext value."""
    env = os.environ.get("LIMITLESS_" + name.upper())
    if env:
        return env
    val = cfg.get(name, "")
    return "" if val == SECRET_MARKER else val

_state = {
    "configured": False,
    "leads": [],
    "sends": [],
    "replies": [],
    "pipeline": [],
    "invoices": [],
    "daily": [],
    "sender_active": None,
    "last_poll": None,
    "error": None,
}


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(cfg: dict):
    existing = load_config()
    existing.update({k: v for k, v in cfg.items() if v is not None})
    CONFIG_PATH.write_text(json.dumps(existing, indent=2))
    return existing


def _csv_url(sheet_id: str, tab: str) -> str:
    from urllib.parse import quote
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={quote(tab)}"


async def _fetch_tab(client: httpx.AsyncClient, sheet_id: str, tab: str) -> list[dict]:
    r = await client.get(_csv_url(sheet_id, tab), follow_redirects=True, timeout=20)
    r.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(r.text)))
    return [{(k or "").strip().lower().replace(" ", "_"): (v or "").strip()
             for k, v in row.items()} for row in rows]


async def poll_tracker():
    cfg = load_config()
    sheet_id = cfg.get("sheet_id")
    if not sheet_id:
        _state["configured"] = False
        _state["error"] = "sheet_id not set — POST /api/outbound/config"
        return False
    try:
        async with httpx.AsyncClient() as client:
            tabs = await asyncio.gather(*[
                _fetch_tab(client, sheet_id, t)
                for t in ("Leads", "Sends Log", "Replies", "Pipeline", "Invoices", "Daily Stats")
            ])
        _state.update({
            "leads": tabs[0], "sends": tabs[1], "replies": tabs[2],
            "pipeline": tabs[3], "invoices": tabs[4], "daily": tabs[5],
            "configured": True, "error": None,
        })
        from datetime import datetime
        _state["last_poll"] = datetime.now().isoformat(timespec="seconds")
        return True
    except Exception as e:
        _state["error"] = f"tracker poll failed: {e}"
        return False


def _filter_track(rows: list[dict], track: str | None) -> list[dict]:
    """Filter rows by the `track` column (websites | receptionists). 'all'/None = no filter.
    Rows without a track (legacy auto-repair leads) pass through only when unfiltered."""
    if not track or track == "all":
        return rows
    return [r for r in rows if (r.get("track") or "").lower() == track]


def get_agents() -> dict:
    """Outbound agent-team panel: manifest merged with live heartbeats."""
    live = {}
    if AGENTS_STATUS_PATH.exists():
        try:
            live = json.loads(AGENTS_STATUS_PATH.read_text()).get("agents", {})
        except (json.JSONDecodeError, OSError):
            live = {}
    agents = []
    for m in TEAM_MANIFEST:
        h = live.get(m["name"], {})
        agents.append({**m,
                       "status": h.get("status", "idle"),
                       "last_action": h.get("last_action", ""),
                       "awaiting_review": h.get("awaiting_review", 0),
                       "updated": h.get("updated")})
    return {"agents": agents,
            "awaiting_review_total": sum(a["awaiting_review"] for a in agents)}


def get_stats(track: str | None = None) -> dict:
    leads = _filter_track(_state["leads"], track)
    sends = _filter_track(_state["sends"], track)
    replies = _filter_track(_state["replies"], track)
    today = date.today().isoformat()
    by_status: dict[str, int] = {}
    for l in leads:
        s = l.get("status") or "queued"
        by_status[s] = by_status.get(s, 0) + 1
    contacted = sum(1 for l in leads if l.get("status") not in ("", "queued") or l.get("last_sent"))
    positive = sum(1 for r in replies if r.get("sentiment") == "positive")
    paying = by_status.get("paying", 0)
    sends_today = sum(1 for s in sends if str(s.get("timestamp", "")).startswith(today))
    sent_total = len(sends)
    reply_rate = round(100 * len(replies) / contacted, 1) if contacted else 0.0
    # daily series for the sparkline
    series: dict[str, dict] = {}
    for s in sends:
        d = str(s.get("timestamp", ""))[:10]
        if d:
            series.setdefault(d, {"date": d, "sends": 0, "replies": 0})["sends"] += 1
    for r in replies:
        d = str(r.get("timestamp", ""))[:10]
        if d:
            series.setdefault(d, {"date": d, "sends": 0, "replies": 0})["replies"] += 1
    # per-touch performance
    touches: dict[str, int] = {"1": 0, "2": 0, "3": 0}
    for s in sends:
        t = str(s.get("touch", "")).strip()
        if t in touches:
            touches[t] += 1
    mrr = paying * 147
    return {
        "configured": _state["configured"],
        "error": _state["error"],
        "last_poll": _state["last_poll"],
        "sender_active": _state["sender_active"],
        "kpis": {
            "leads_total": len(leads),
            "contacted": contacted,
            "sends_today": sends_today,
            "sends_total": sent_total,
            "replies": len(replies),
            "reply_rate": reply_rate,
            "positive": positive,
            "pilots": by_status.get("pilot", 0),
            "paying": paying,
            "mrr": mrr,
            "opted_out": by_status.get("opted_out", 0),
        },
        "by_status": by_status,
        "daily_series": sorted(series.values(), key=lambda x: x["date"]),
        "touches": touches,
        "recent_sends": sends[-12:][::-1],
        "recent_replies": replies[-8:][::-1],
        "invoices": _state["invoices"][-10:][::-1],
    }


def get_pipeline(track: str | None = None) -> dict:
    stages = {"queued": [], "in_sequence": [], "replied": [], "pilot": [], "paying": []}
    for l in _filter_track(_state["leads"], track):
        s = l.get("status") or "queued"
        if s in stages:
            stages[s].append({
                "lead_id": l.get("lead_id"), "business": l.get("business"),
                "city": l.get("city"), "email": l.get("email"),
                "touch_stage": l.get("touch_stage"), "last_sent": l.get("last_sent"),
            })
    return {"stages": stages}


async def _n8n(method: str, path: str, **kw):
    cfg = load_config()
    base, key = cfg.get("n8n_url", "").rstrip("/"), _resolve_secret("n8n_api_key", cfg)
    if not base or not key:
        raise RuntimeError("n8n_url / n8n_api_key not configured")
    async with httpx.AsyncClient() as client:
        r = await client.request(method, f"{base}/api/v1{path}",
                                 headers={"X-N8N-API-KEY": key}, timeout=20, **kw)
        r.raise_for_status()
        return r.json() if r.text else {}


async def _find_sender_id() -> str | None:
    cfg = load_config()
    if cfg.get("wf1_id"):
        return cfg["wf1_id"]
    data = await _n8n("GET", "/workflows?limit=100")
    for wf in data.get("data", []):
        if "WF1 Sender" in wf.get("name", ""):
            save_config({"wf1_id": wf["id"]})
            return wf["id"]
    return None


async def refresh_sender_state():
    try:
        wf_id = await _find_sender_id()
        if wf_id:
            wf = await _n8n("GET", f"/workflows/{wf_id}")
            _state["sender_active"] = bool(wf.get("active"))
    except Exception:
        _state["sender_active"] = None


async def set_killswitch(active: bool) -> dict:
    wf_id = await _find_sender_id()
    if not wf_id:
        return {"error": "WF1 Sender workflow not found in n8n"}
    await _n8n("POST", f"/workflows/{wf_id}/{'activate' if active else 'deactivate'}")
    _state["sender_active"] = active
    return {"sender_active": active}
