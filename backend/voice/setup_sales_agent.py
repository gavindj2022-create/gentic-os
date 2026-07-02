#!/usr/bin/env python3
"""One-time builder for the Ascendance outbound sales agent on Retell.

Reuses Bella's RetellClient. Dry-run by default — inspect the prompt + payloads,
then re-run with --live (requires RETELL_API_KEY in the environment) to actually
create the Retell LLM + agent and save the IDs to voice_config.json.

Usage:
    python -m backend.voice.setup_sales_agent              # dry run
    python -m backend.voice.setup_sales_agent --live       # create for real
    python -m backend.voice.setup_sales_agent --live --voice 11labs-Adrian \
        --from-number +13125550123
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running both as a module and as a script.
try:
    from . import retell as retell_shim
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from backend.voice import retell as retell_shim

AGENT_NAME = "Ascendance Sales Caller"
DEFAULT_VOICE = "11labs-Adrian"  # confident male; change with --voice
HERE = Path(__file__).parent
CONFIG_PATH = HERE / "voice_config.json"
TEMPLATE_PATH = HERE / "salescaller_prompt_template.md"

DEFAULT_CONFIG = {
    "campaign": "ascendance",
    "agent_id": "",
    "llm_id": "",
    "from_number": "",
    "caller_name": "Alex",
    "demo_owner": "Gav",
    "callback_number": "",
    "price": "$750 to set up plus $150 to 200 a month",
}


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            cfg.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except Exception:
            pass
    return cfg


def save_config(updates: dict) -> dict:
    cfg = load_config()
    cfg.update({k: v for k, v in updates.items() if v is not None})
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    return cfg


def _mask_id(value: str) -> str:
    value = str(value or "")
    if len(value) <= 12:
        return value
    return f"{value[:6]}...{value[-4:]}"


def build_payloads(prompt: str, voice_id: str) -> tuple[dict, dict]:
    llm_payload = {
        "general_prompt": prompt,
        "general_tools": [{"type": "end_call", "name": "end_call"}],
    }
    agent_payload = {
        "agent_name": AGENT_NAME,
        "voice_id": voice_id,
        "language": "en-US",
        # filled with the real llm_id after the LLM is created
        "response_engine": {"type": "retell-llm", "llm_id": "<llm_id>"},
    }
    return llm_payload, agent_payload


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the Ascendance Retell sales agent")
    ap.add_argument("--live", action="store_true", help="actually create on Retell")
    ap.add_argument(
        "--update-existing",
        action="store_true",
        help="update the llm_id/agent_id already saved in voice_config.json",
    )
    ap.add_argument("--publish", action="store_true", help="publish the agent after a live create/update")
    ap.add_argument("--voice", default=DEFAULT_VOICE, help="Retell voice_id")
    ap.add_argument("--from-number", default="", help="Retell-managed phone number to call from")
    args = ap.parse_args()

    cfg = load_config()
    prompt = TEMPLATE_PATH.read_text(encoding="utf-8")
    llm_payload, agent_payload = build_payloads(prompt, args.voice)

    mode = "UPDATE" if args.update_existing else "CREATE"
    print(f"=== {AGENT_NAME} — {mode} — {'LIVE' if args.live else 'DRY RUN'} ===\n")
    print("--- PROMPT (dynamic {{vars}} filled per-call by Retell) ---")
    print(prompt[:1400] + ("\n…\n" if len(prompt) > 1400 else "\n"))
    print(f"voice_id: {args.voice}")
    print(f"general_tools: {json.dumps(llm_payload['general_tools'])}\n")

    available, err = retell_shim.retell_available()
    if not available:
        print(f"[!] Bella RetellClient unavailable: {err}")
        return 1

    client = retell_shim.get_client(live=args.live)
    if args.live and not client.live:
        print("[!] --live set but no RETELL_API_KEY found in environment. Aborting.")
        return 1

    if args.update_existing:
        llm_id = cfg.get("llm_id")
        agent_id = cfg.get("agent_id")
        if not llm_id or not agent_id:
            print("[!] --update-existing needs llm_id and agent_id in voice_config.json.")
            return 1
        agent_payload["response_engine"]["llm_id"] = llm_id
        llm = client.update_llm(llm_id, llm_payload)
        agent = client.update_agent(agent_id, agent_payload)
    else:
        llm = client.create_llm(llm_payload)
        llm_id = llm.get("llm_id", "dry-llm")
        agent_payload["response_engine"]["llm_id"] = llm_id
        agent = client.create_agent(agent_payload)
        agent_id = agent.get("agent_id", "dry-agent")

    print(f"llm_id:   {_mask_id(llm_id)}")
    print(f"agent_id: {_mask_id(agent_id)}")
    if llm.get("dry_run") or agent.get("dry_run"):
        print("dry_run:  true")

    if args.publish:
        if not args.live:
            print("[!] --publish ignored in dry-run mode.")
        else:
            published = client.publish_agent(agent_id)
            print(f"published: {bool(published)}")

    if args.live:
        saved = save_config({
            "agent_id": agent_id,
            "llm_id": llm_id,
            "from_number": args.from_number or cfg.get("from_number", ""),
        })
        print("\n[✓] Saved to voice_config.json")
        if not saved.get("from_number"):
            print("[!] No from_number set — provision a Chicago (312/773) Retell "
                  "number and pass --from-number, or set it in the cockpit config.")
    else:
        action = "update the existing Retell agent" if args.update_existing else "create on Retell"
        print(f"\n(dry run — nothing saved. Re-run with --live to {action}.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
