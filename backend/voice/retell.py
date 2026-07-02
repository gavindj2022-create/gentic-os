"""Thin shim that reuses Bella's RetellClient from the Obsidian vault.

We deliberately do NOT duplicate the Retell wrapper — Bella already maintains it
at AGENTS/bella_agents/tools/retell_client.py. This module makes that package
importable from GenTIC OS and hands back a configured client.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# AGENTS dir holds the `bella_agents` package.
_AGENTS_DIR = Path("C:/Users/ninja/Gavs Brain/Gavs Brain/AGENTS")
if _AGENTS_DIR.exists() and str(_AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(_AGENTS_DIR))

try:
    from bella_agents.tools.retell_client import RetellClient  # type: ignore
    _IMPORT_ERROR: str | None = None
except Exception as exc:  # pragma: no cover - surfaced via status
    RetellClient = None  # type: ignore
    _IMPORT_ERROR = str(exc)


def retell_available() -> tuple[bool, str | None]:
    """Whether Bella's RetellClient could be imported."""
    return RetellClient is not None, _IMPORT_ERROR


def load_key() -> str | None:
    """Resolve the Retell API key: GenTIC env first, then Bella's secret vault.

    This keeps the key in the single secrets store (passwords and keys/_secrets/
    *retell*.env) — no need to duplicate it into gentic-os/backend/.env.
    """
    key = os.getenv("RETELL_API_KEY")
    if key:
        return key
    try:
        from bella_agents.tools.secrets import get_secret  # type: ignore
        return get_secret("RETELL_API_KEY", "retell")
    except Exception:
        return None


def has_key() -> bool:
    return bool(load_key())


def get_client(live: bool | None = None) -> "RetellClient":
    """Return a configured RetellClient. Goes live only if a key is resolvable."""
    if RetellClient is None:
        raise RuntimeError(f"RetellClient unavailable: {_IMPORT_ERROR}")
    api_key = load_key()
    if live is None:
        live = bool(api_key)
    return RetellClient(api_key=api_key, live=live)
