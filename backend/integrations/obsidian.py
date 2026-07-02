import os
from datetime import datetime
from ..config import VAULT_PATH, KNOWLEDGE_DIR, DAILY_NOTES_DIR


def get_knowledge_topics() -> list:
    topics = []
    if not KNOWLEDGE_DIR.exists():
        return topics
    for fname in sorted(KNOWLEDGE_DIR.iterdir()):
        if fname.suffix != ".md":
            continue
        try:
            content = fname.read_text(encoding="utf-8")
            lines = [l.strip() for l in content.splitlines() if l.strip() and not l.startswith("#")]
            summary = " ".join(lines)[:300]
            mtime = os.path.getmtime(fname)
            topics.append({
                "title": fname.stem.replace("_", " ").title(),
                "filename": fname.name,
                "updated": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
                "word_count": len(content.split()),
                "summary": summary,
            })
        except Exception:
            continue
    return topics


def get_daily_note(date_str: str = None) -> str | None:
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    note_path = DAILY_NOTES_DIR / f"{date_str}.md"
    if note_path.exists():
        return note_path.read_text(encoding="utf-8")
    return None


def get_vault_stats() -> dict:
    md_count = 0
    total_words = 0
    for root, dirs, files in os.walk(VAULT_PATH):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.endswith(".md"):
                md_count += 1
                try:
                    total_words += len(open(os.path.join(root, f), encoding="utf-8").read().split())
                except Exception:
                    pass
    return {"note_count": md_count, "total_words": total_words}


def search_vault(query: str, max_results: int = 20) -> list:
    results = []
    query_lower = query.lower()
    for root, dirs, files in os.walk(VAULT_PATH):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if not f.endswith(".md"):
                continue
            fpath = os.path.join(root, f)
            try:
                content = open(fpath, encoding="utf-8").read()
                if query_lower in content.lower():
                    rel = os.path.relpath(fpath, VAULT_PATH)
                    idx = content.lower().index(query_lower)
                    snippet = content[max(0, idx - 80):idx + 120].replace("\n", " ")
                    results.append({"path": rel, "snippet": snippet})
                    if len(results) >= max_results:
                        return results
            except Exception:
                continue
    return results
