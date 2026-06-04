#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "data" / "source_config.json"
OUTPUT_PATH = ROOT / "data" / "candidate_events.json"


def fetch_text(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; public-schedule-tracker/0.1)",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "ignore")


def strip_html(value: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def page_title(raw_html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, flags=re.I | re.S)
    return strip_html(match.group(1)) if match else ""


def find_keyword_snippets(text: str, keywords: list[str]) -> list[str]:
    snippets: list[str] = []
    lower = text.lower()
    for keyword in keywords:
        start = lower.find(keyword.lower())
        if start == -1:
            continue
        left = max(0, start - 140)
        right = min(len(text), start + len(keyword) + 220)
        snippets.append(text[left:right].strip())
    return snippets


def build_candidates(config: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    keywords = config.get("keywords", [])
    for source in config.get("sources", []):
      # Keep this script conservative: it only creates candidates for review.
        url = source["url"]
        try:
            raw = fetch_text(url)
            text = strip_html(raw)
            snippets = find_keyword_snippets(text, keywords)
            if snippets:
                candidates.append(
                    {
                        "status": "needs-review",
                        "sourceName": source["name"],
                        "sourceType": source["type"],
                        "url": url,
                        "title": page_title(raw),
                        "matchedKeywords": [keyword for keyword in keywords if keyword.lower() in text.lower()],
                        "snippets": snippets[:3],
                    }
                )
        except Exception as exc:
            candidates.append(
                {
                    "status": "fetch-error",
                    "sourceName": source.get("name", ""),
                    "sourceType": source.get("type", ""),
                    "url": url,
                    "error": str(exc),
                }
            )
    return candidates


def main() -> None:
    parser = argparse.ArgumentParser(description="抓取公開來源並輸出待審核候選事件，不自動發布。")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--output", default=str(OUTPUT_PATH))
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "notice": "候選資料只供人工審核；確認前不要合併到 data/events.json。",
        "candidates": build_candidates(config),
    }
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(payload['candidates'])} candidates to {args.output}")


if __name__ == "__main__":
    main()
