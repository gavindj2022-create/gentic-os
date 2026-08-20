import os
"""Knowledge extraction — analyzes task results and writes insights to DB + Obsidian vault."""

import logging
import re
from datetime import datetime
from pathlib import Path
from .database import create_insight
from .executors import get_executor

log = logging.getLogger("workforce.knowledge")

VAULT_PATH = Path(os.getenv("VAULT_PATH", "./vault"))
INSIGHTS_DIR = VAULT_PATH / "SYSTEM" / "AgentInsights"

CATEGORIES = ["security", "expansion", "improvement", "revenue"]

EXTRACTION_PROMPT = """You are an insight extraction engine for an AI development team.
Analyze the following task result and extract structured insights.

For each insight found, output it in this exact format (one per line):
[CATEGORY] Title: description

Where CATEGORY is one of: SECURITY, EXPANSION, IMPROVEMENT, REVENUE

Rules:
- SECURITY: vulnerabilities, auth issues, data exposure, missing encryption
- EXPANSION: new features, integrations, scaling opportunities, new markets
- IMPROVEMENT: code quality, performance, UX, reliability, maintainability
- REVENUE: monetization ideas, cost savings, value-add features, competitive advantages

Only output insights that are clearly supported by the task result. If no insights found, output: [NONE]
Be concise — one line per insight, max 5 insights."""


async def extract_insights(task: dict, result: str, agent_id: str) -> list[dict]:
    """Extract insights from a completed task using Ollama (free) or basic heuristics."""
    insights = []
    task_id = task["id"]

    # Try Ollama first (free)
    ollama = get_executor("ollama")
    if ollama:
        try:
            user_prompt = f"Task: {task['title']}\nDescription: {task.get('description', '')}\n\nResult:\n{result[:3000]}"
            resp = await ollama.run(EXTRACTION_PROMPT, user_prompt, model="llama3")
            if resp.get("output") and not resp.get("error"):
                insights = _parse_extraction(resp["output"], task_id, agent_id)
        except Exception as e:
            log.warning(f"Ollama extraction failed, falling back to heuristics: {e}")

    # Fallback: basic keyword heuristics if Ollama didn't produce results
    if not insights:
        insights = _heuristic_extraction(task, result, agent_id)

    # Save to DB + Obsidian
    saved = []
    for ins in insights:
        try:
            obsidian_path = _write_to_obsidian(ins)
            db_insight = create_insight(
                task_id=ins["task_id"],
                agent_id=ins["agent_id"],
                category=ins["category"],
                title=ins["title"],
                content=ins["content"],
                confidence=ins.get("confidence", 0.7),
                obsidian_path=obsidian_path,
            )
            saved.append(db_insight)
        except Exception as e:
            log.error(f"Failed to save insight: {e}")

    return saved


def _parse_extraction(text: str, task_id: str, agent_id: str) -> list[dict]:
    """Parse the LLM extraction output into insight dicts."""
    insights = []
    pattern = re.compile(r'\[(SECURITY|EXPANSION|IMPROVEMENT|REVENUE)\]\s*(.+?):\s*(.*)', re.IGNORECASE)
    for line in text.strip().splitlines():
        match = pattern.match(line.strip())
        if match:
            category = match.group(1).lower()
            title = match.group(2).strip()
            content = match.group(3).strip()
            if title and content:
                insights.append({
                    "task_id": task_id,
                    "agent_id": agent_id,
                    "category": category,
                    "title": title,
                    "content": content,
                    "confidence": 0.75,
                })
    return insights


def _heuristic_extraction(task: dict, result: str, agent_id: str) -> list[dict]:
    """Fallback: extract insights using keyword matching."""
    insights = []
    task_id = task["id"]
    text = (result or "").lower()

    security_keywords = ["vulnerability", "security", "auth", "xss", "injection", "exposed", "leak", "secret", "password"]
    expansion_keywords = ["feature", "integration", "scale", "api", "new", "add", "extend", "plugin"]
    improvement_keywords = ["refactor", "optimize", "performance", "clean", "test", "quality", "maintainability"]
    revenue_keywords = ["monetize", "revenue", "cost", "saving", "value", "profit", "pricing", "premium"]

    for kw in security_keywords:
        if kw in text:
            insights.append({
                "task_id": task_id, "agent_id": agent_id,
                "category": "security",
                "title": f"Security finding in {task.get('title', 'task')}",
                "content": f"Task result contains security-relevant content (keyword: {kw}).",
                "confidence": 0.5,
            })
            break

    for kw in expansion_keywords:
        if kw in text:
            insights.append({
                "task_id": task_id, "agent_id": agent_id,
                "category": "expansion",
                "title": f"Expansion opportunity from {task.get('title', 'task')}",
                "content": f"Task result suggests expansion potential (keyword: {kw}).",
                "confidence": 0.5,
            })
            break

    for kw in improvement_keywords:
        if kw in text:
            insights.append({
                "task_id": task_id, "agent_id": agent_id,
                "category": "improvement",
                "title": f"Improvement suggestion from {task.get('title', 'task')}",
                "content": f"Task result suggests code/UX improvement (keyword: {kw}).",
                "confidence": 0.5,
            })
            break

    for kw in revenue_keywords:
        if kw in text:
            insights.append({
                "task_id": task_id, "agent_id": agent_id,
                "category": "revenue",
                "title": f"Revenue insight from {task.get('title', 'task')}",
                "content": f"Task result contains revenue-relevant content (keyword: {kw}).",
                "confidence": 0.5,
            })
            break

    return insights


def _write_to_obsidian(insight: dict) -> str | None:
    """Write an insight as a markdown note to the Obsidian vault."""
    try:
        category = insight["category"]
        cat_dir = INSIGHTS_DIR / category.capitalize()
        cat_dir.mkdir(parents=True, exist_ok=True)

        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        safe_title = re.sub(r'[^\w\s-]', '', insight["title"])[:60].strip()
        safe_title = re.sub(r'\s+', '-', safe_title)
        filename = f"{date_str}-{safe_title}.md"
        filepath = cat_dir / filename

        frontmatter = f"""---
agent: {insight.get('agent_id', 'unknown')}
task: {insight.get('task_id', 'unknown')}
category: {category}
confidence: {insight.get('confidence', 0.7)}
created: {datetime.utcnow().isoformat()}
tags: [agent-insight, {category}]
---

# {insight['title']}

{insight.get('content', '')}

---
*Generated by GenTIC OS Workforce — {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}*
"""
        filepath.write_text(frontmatter, encoding="utf-8")
        rel_path = str(filepath.relative_to(VAULT_PATH))
        log.info(f"Insight written to Obsidian: {rel_path}")
        return rel_path
    except Exception as e:
        log.error(f"Failed to write insight to Obsidian: {e}")
        return None
