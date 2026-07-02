import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env for API keys + budget config
load_dotenv(Path(__file__).parent / ".env")

VAULT_PATH = Path("C:/Users/ninja/Gavs Brain/Gavs Brain")
OLIVIA_DIR = VAULT_PATH / "OLIVIA"
ALFRED_DIR = VAULT_PATH / "ALFRED"
ICARUS_DIR = VAULT_PATH / "ICARUS"

OLIVIA_URL = "http://127.0.0.1:5555"
OBSIDIAN_URL = "https://127.0.0.1:27124"
AGENT_MONITOR_URL = "http://127.0.0.1:4820"

GENTIC_HOST = "127.0.0.1"
GENTIC_PORT = 7777

STATUS_FILE = VAULT_PATH / "OLIVIA_STATUS.json"
FEAR_FILE = VAULT_PATH / "FEAR_METER.json"
DIGEST_FILE = VAULT_PATH / "ALFRED_DIGEST.json"
CAR_FILE = VAULT_PATH / "CAR_VENTURE.json"
TOKEN_LOG = VAULT_PATH / "ALFRED_TOKEN_LOG.json"
KNOWLEDGE_DIR = VAULT_PATH / "Knowledge"
DAILY_NOTES_DIR = VAULT_PATH / "Daily Notes"

DB_PATH = Path(__file__).parent / "gentic.db"
CLAUDE_COMMANDS_DIR = Path(os.path.expanduser("~/.claude/commands"))

# ──────────────────── Workforce (Phase 4) ────────────────────

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

WORKFORCE_CONFIG = {
    "ANTHROPIC_API_KEY": ANTHROPIC_API_KEY,
    "OPENAI_API_KEY": OPENAI_API_KEY,
    "GEMINI_API_KEY": GEMINI_API_KEY,
    "OLLAMA_BASE_URL": OLLAMA_BASE_URL,
}

BUDGET_CAPS = {
    "claude": {"monthly_usd": float(os.getenv("CLAUDE_MONTHLY_CAP", "10")), "daily_tokens": int(os.getenv("CLAUDE_FREE_DAILY_TOKENS", "500000"))},
    "openai": {"monthly_usd": float(os.getenv("OPENAI_MONTHLY_CAP", "5")), "daily_tokens": int(os.getenv("OPENAI_FREE_DAILY_TOKENS", "200000"))},
    "gemini": {"monthly_usd": float(os.getenv("GEMINI_MONTHLY_CAP", "5")), "daily_tokens": int(os.getenv("GEMINI_FREE_DAILY_TOKENS", "1000000"))},
    "ollama": {"monthly_usd": 0, "daily_tokens": 999999999},
}

PROJECT_REGISTRY = [
    {"name": "GenTIC OS", "path": "C:/Users/ninja/gentic-os", "type": "fullstack"},
    {"name": "Limitless Website", "path": "C:/Users/ninja/limitless-website", "type": "nextjs"},
    {"name": "Studio B Hair Design", "path": "C:/Users/ninja/salon-sites/studio-b-hair-design", "type": "static"},
    {"name": "ReceiptVault Lite", "path": "C:/Users/ninja/receiptvault-lite", "type": "python"},
    {"name": "STR Website", "path": "C:/Users/ninja/OneDrive/Desktop/STR Website", "type": "static"},
    {"name": "BTC Scanner", "path": "C:/Users/ninja/btc-scanner", "type": "react"},
    {"name": "DAWGS AGI", "path": "C:/Users/ninja/dawgs-agi", "type": "business"},
    {"name": "Obsidian Vault", "path": "C:/Users/ninja/Gavs Brain/Gavs Brain", "type": "vault"},
]
