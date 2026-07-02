"""Google Sheet sync support for the Ascendance voice caller.

The backend does not ship with a Google service-account credential. Instead it
posts call updates to a configured webhook writer, and queues every payload
locally until that writer is configured.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

HERE = Path(__file__).parent
CONFIG_PATH = HERE / "voice_config.json"
PENDING_PATH = HERE / "pending_sheet_sync.jsonl"

CALL_COLUMNS = [
    "Call ID",
    "Retell Call ID",
    "Campaign",
    "Business",
    "Lead Name",
    "Phone",
    "Status",
    "Disposition",
    "Simulated",
    "Created At",
    "Ended At",
    "Duration Sec",
    "Demo Booked At",
    "Recording URL",
    "Transcript",
    "Last Synced At",
]


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_config(updates: dict[str, Any]) -> None:
    cfg = _load_config()
    cfg.update({k: v for k, v in updates.items() if v is not None})
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def _resolve_webhook(cfg: dict[str, Any]) -> str:
    return (
        os.environ.get("VOICE_CALLER_SHEET_WEBHOOK_URL")
        or cfg.get("sheet_webhook_url")
        or cfg.get("google_sheet_webhook_url")
        or ""
    ).strip()


def _pending_count() -> int:
    if not PENDING_PATH.exists():
        return 0
    try:
        return sum(1 for line in PENDING_PATH.read_text(encoding="utf-8").splitlines() if line.strip())
    except Exception:
        return 0


def status() -> dict[str, Any]:
    cfg = _load_config()
    return {
        "google_sheet_id": cfg.get("google_sheet_id", ""),
        "google_sheet_url": cfg.get("google_sheet_url", ""),
        "webhook_configured": bool(_resolve_webhook(cfg)),
        "pending_count": _pending_count(),
        "pending_path": str(PENDING_PATH),
        "last_sync_at": cfg.get("sheet_last_sync_at", ""),
    }


def _duration_seconds(call: dict[str, Any]) -> int | str:
    created, ended = call.get("created_at"), call.get("ended_at")
    if not created or not ended:
        return ""
    try:
        start = datetime.fromisoformat(str(created))
        stop = datetime.fromisoformat(str(ended))
        return max(0, int((stop - start).total_seconds()))
    except Exception:
        return ""


def call_row(call: dict[str, Any]) -> list[Any]:
    synced_at = datetime.utcnow().isoformat(timespec="seconds")
    return [
        call.get("call_id", ""),
        call.get("retell_call_id", ""),
        call.get("campaign", ""),
        call.get("business", ""),
        call.get("lead_name", ""),
        call.get("phone", ""),
        call.get("status", ""),
        call.get("disposition", ""),
        bool(call.get("simulated")),
        call.get("created_at", ""),
        call.get("ended_at", ""),
        _duration_seconds(call),
        call.get("demo_booked_at", ""),
        call.get("recording_url", ""),
        call.get("transcript", ""),
        synced_at,
    ]


def call_payload(call: dict[str, Any]) -> dict[str, Any]:
    cfg = _load_config()
    return {
        "operation": "upsert_call",
        "spreadsheet_id": cfg.get("google_sheet_id", ""),
        "spreadsheet_url": cfg.get("google_sheet_url", ""),
        "tab": "Calls",
        "key_column": "Call ID",
        "columns": CALL_COLUMNS,
        "row": call_row(call),
        "call": call,
    }


def _append_pending(payload: dict[str, Any], reason: str) -> None:
    PENDING_PATH.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "queued_at": datetime.utcnow().isoformat(timespec="seconds"),
        "reason": reason,
        "payload": payload,
    }
    with PENDING_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


async def _queue_pending(payload: dict[str, Any], reason: str) -> None:
    await asyncio.to_thread(_append_pending, payload, reason)


async def sync_call(call: dict[str, Any]) -> dict[str, Any]:
    cfg = _load_config()
    payload = call_payload(call)
    webhook = _resolve_webhook(cfg)
    has_sheet = bool(payload.get("spreadsheet_id") or payload.get("spreadsheet_url"))
    if not has_sheet:
        await _queue_pending(payload, "google_sheet_id not configured")
        return {"ok": False, "mode": "queued", "reason": "google_sheet_id not configured"}
    if not webhook:
        await _queue_pending(payload, "sheet_webhook_url not configured")
        return {"ok": False, "mode": "queued", "reason": "sheet_webhook_url not configured"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(webhook, json=payload)
            response.raise_for_status()
        _save_config({"sheet_last_sync_at": datetime.utcnow().isoformat(timespec="seconds")})
        return {"ok": True, "mode": "webhook"}
    except Exception as exc:
        await _queue_pending(payload, f"webhook failed: {exc}")
        return {"ok": False, "mode": "queued", "reason": str(exc)}


async def flush_pending(limit: int = 100) -> dict[str, Any]:
    cfg = _load_config()
    webhook = _resolve_webhook(cfg)
    if not webhook:
        return {"ok": False, "flushed": 0, "remaining": _pending_count(), "reason": "sheet_webhook_url not configured"}
    if not PENDING_PATH.exists():
        return {"ok": True, "flushed": 0, "remaining": 0}

    lines = [line for line in PENDING_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    sent = 0
    keep: list[str] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for i, line in enumerate(lines):
            if sent >= limit:
                keep.extend(lines[i:])
                break
            try:
                record = json.loads(line)
                response = await client.post(webhook, json=record["payload"])
                response.raise_for_status()
                sent += 1
            except Exception:
                keep.append(line)
    PENDING_PATH.write_text(("\n".join(keep) + "\n") if keep else "", encoding="utf-8")
    if sent:
        _save_config({"sheet_last_sync_at": datetime.utcnow().isoformat(timespec="seconds")})
    return {"ok": True, "flushed": sent, "remaining": len(keep)}
