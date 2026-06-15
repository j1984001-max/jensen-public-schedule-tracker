#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "data" / "source_config.json"
EVENTS_PATH = ROOT / "data" / "events.json"
CANDIDATE_OUTPUT_PATH = ROOT / "data" / "candidate_events.json"
SIGNALS_OUTPUT_PATH = ROOT / "data" / "latest_signals.json"

DATE_PATTERNS = [
    re.compile(r"\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b"),
    re.compile(r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+([0-3]?\d),\s*(20\d{2})\b", re.I),
    re.compile(r"\b(20\d{2})\s*年\s*(0?[1-9]|1[0-2])\s*月\s*(0?[1-9]|[12]\d|3[01])\s*日?\b"),
]

MONTHS = {
    "jan": "01",
    "january": "01",
    "feb": "02",
    "february": "02",
    "mar": "03",
    "march": "03",
    "apr": "04",
    "april": "04",
    "may": "05",
    "jun": "06",
    "june": "06",
    "jul": "07",
    "july": "07",
    "aug": "08",
    "august": "08",
    "sep": "09",
    "sept": "09",
    "september": "09",
    "oct": "10",
    "october": "10",
    "nov": "11",
    "november": "11",
    "dec": "12",
    "december": "12",
}

BLOCKED_PRIVACY_TERMS = [
    "flight",
    "hotel",
    "airport",
    "residence",
    "private jet",
    "private residence",
    "航班",
    "班機",
    "機場",
    "飯店",
    "住處",
    "住家",
    "私人",
    "即時",
    "現在",
]

PUBLIC_CONTEXT_REVIEW_TERMS = [
    "restaurant",
    "night market",
    "dinner",
    "beer",
    "visited",
    "visits",
    "逛",
    "吃",
    "喝",
    "夜市",
    "餐廳",
    "台啤",
    "觀光",
    "合照",
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def fetch_text(url: str, timeout: int = 25) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; public-schedule-tracker/1.0; +https://github.com/j1984001-max/jensen-public-schedule-tracker)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, "ignore")


def strip_html(value: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def page_title(raw_html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, flags=re.I | re.S)
    return strip_html(match.group(1)) if match else ""


def find_keyword_snippets(text: str, keywords: list[str], window: int = 180) -> list[str]:
    snippets: list[str] = []
    lower = text.lower()
    for keyword in keywords:
        start = lower.find(keyword.lower())
        if start == -1:
            continue
        left = max(0, start - window)
        right = min(len(text), start + len(keyword) + window)
        snippet = text[left:right].strip()
        if snippet and snippet not in snippets:
            snippets.append(snippet)
    return snippets


def matched_terms(text: str, terms: list[str]) -> list[str]:
    lower = text.lower()
    return [term for term in terms if term.lower() in lower]


def parse_datetime(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def is_recent(value: str | None, lookback_days: int, now: datetime) -> bool:
    if not value:
        return True
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return True
    return parsed >= now - timedelta(days=lookback_days)


def detect_dates(text: str) -> list[str]:
    dates: list[str] = []
    for pattern in DATE_PATTERNS:
        for match in pattern.finditer(text):
            if len(match.groups()) == 3 and match.group(1).isdigit() and "年" not in match.group(0):
                year, month, day = match.groups()
            elif len(match.groups()) == 3 and match.group(3).isdigit() and not match.group(1).isdigit():
                month_name, day, year = match.groups()
                month = MONTHS.get(month_name.lower().rstrip("."), "01")
            else:
                year, month, day = match.groups()
            normalized = f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
            if normalized not in dates:
                dates.append(normalized)
    return dates[:3]


def canonical_url(url: str, base: str | None = None) -> str:
    absolute = urllib.parse.urljoin(base or "", url)
    parsed = urllib.parse.urlparse(absolute)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    filtered = [(key, value) for key, value in query if not key.lower().startswith("utm_")]
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(filtered), fragment=""))


def signal_id(source_name: str, url: str, title: str) -> str:
    digest = hashlib.sha1(f"{source_name}|{url}|{title}".encode("utf-8")).hexdigest()
    return digest[:12]


def same_registered_host(url: str, source_url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower().removeprefix("www.")
    source_host = urllib.parse.urlparse(source_url).netloc.lower().removeprefix("www.")
    return bool(host and source_host and (host == source_host or host.endswith(f".{source_host}")))


def classify_signal(source: dict[str, Any], text: str, event_terms: list[str], url: str) -> tuple[str, int]:
    source_type = source.get("type", "")
    event_matches = matched_terms(text, event_terms)
    is_same_host = same_registered_host(url, source.get("url", ""))
    if source_type in {"官方", "主辦方"} and event_matches and is_same_host:
        return "公開行程候選", 82
    if source_type in {"官方", "主辦方"} and event_matches:
        return "官方頁引用公開訊號", 68
    if source_type in {"官方", "主辦方"}:
        return "官方公開提及", 72
    if event_matches:
        return "媒體公開行程候選", 64
    return "公開提及", 48


def make_signal(
    *,
    source: dict[str, Any],
    title: str,
    url: str,
    text: str,
    published_at: str | None,
    generated_at: str,
    keywords: list[str],
    event_keywords: list[str],
) -> dict[str, Any] | None:
    searchable = f"{title} {text}"
    keyword_matches = matched_terms(searchable, keywords)
    event_matches = matched_terms(searchable, event_keywords)
    if not keyword_matches:
        return None

    category, confidence = classify_signal(source, searchable, event_keywords, url)
    blocked_privacy_flags = matched_terms(searchable, BLOCKED_PRIVACY_TERMS)
    context_review_flags = matched_terms(searchable, PUBLIC_CONTEXT_REVIEW_TERMS)
    if blocked_privacy_flags or context_review_flags:
        confidence = min(confidence, 55)

    snippets = find_keyword_snippets(strip_html(searchable), keyword_matches + event_matches)
    detected_dates = detect_dates(searchable)

    return {
        "id": signal_id(source["name"], url, title),
        "status": "needs-review",
        "category": category,
        "confidence": confidence,
        "sourceName": source["name"],
        "sourceType": source["type"],
        "title": title.strip() or source["name"],
        "url": url,
        "publishedAt": published_at,
        "detectedDates": detected_dates,
        "matchedKeywords": keyword_matches,
        "matchedEventKeywords": event_matches,
        "privacyReviewFlags": blocked_privacy_flags + context_review_flags,
        "blockedPrivacyFlags": blocked_privacy_flags,
        "publicContextFlags": context_review_flags,
        "summary": snippets[0] if snippets else strip_html(searchable)[:260],
        "capturedAt": generated_at,
    }


def child_text(element: ET.Element, names: list[str]) -> str:
    for name in names:
        found = element.find(name)
        if found is not None and found.text:
            return found.text.strip()
    for child in element:
        local_name = child.tag.rsplit("}", 1)[-1].lower()
        if local_name in {candidate.lower() for candidate in names} and child.text:
            return child.text.strip()
    return ""


def child_link(element: ET.Element) -> str:
    direct = child_text(element, ["link"])
    if direct:
        return direct
    for child in element:
        local_name = child.tag.rsplit("}", 1)[-1].lower()
        if local_name == "link":
            href = child.attrib.get("href")
            if href:
                return href
    return ""


def rss_signals(source: dict[str, Any], raw: str, config: dict[str, Any], generated_at: str, now: datetime) -> list[dict[str, Any]]:
    root = ET.fromstring(raw)
    items = list(root.findall(".//item")) or [node for node in root.iter() if node.tag.rsplit("}", 1)[-1].lower() == "entry"]
    signals: list[dict[str, Any]] = []
    lookback_days = int(config.get("lookbackDays", 30))

    for item in items[:30]:
        title = child_text(item, ["title"])
        link = canonical_url(child_link(item), source["url"])
        summary = child_text(item, ["description", "summary", "content"])
        published_at = parse_datetime(child_text(item, ["pubDate", "published", "updated", "dc:date"]))
        if not is_recent(published_at, lookback_days, now):
            continue
        signal = make_signal(
            source=source,
            title=strip_html(title),
            url=link or source["url"],
            text=summary,
            published_at=published_at,
            generated_at=generated_at,
            keywords=config.get("keywords", []),
            event_keywords=config.get("eventKeywords", []),
        )
        if signal:
            signals.append(signal)
    return signals


def html_signals(source: dict[str, Any], raw: str, config: dict[str, Any], generated_at: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    title = page_title(raw) or source["name"]

    link_pattern = re.compile(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>", re.I)
    for href, label_html in link_pattern.findall(raw)[:160]:
        label = strip_html(label_html)
        searchable = f"{label} {href}"
        if not matched_terms(searchable, config.get("keywords", []) + config.get("eventKeywords", [])):
            continue
        signal = make_signal(
            source=source,
            title=label or title,
            url=canonical_url(href, source["url"]),
            text=searchable,
            published_at=None,
            generated_at=generated_at,
            keywords=config.get("keywords", []),
            event_keywords=config.get("eventKeywords", []),
        )
        if signal:
            signals.append(signal)
    return signals


def build_signals(config: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    now = utc_now()
    generated_at = now.isoformat()
    signals: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for source in config.get("sources", []):
        try:
            raw = fetch_text(source["url"])
            if source.get("format") == "rss":
                source_signals = rss_signals(source, raw, config, generated_at, now)
            else:
                source_signals = html_signals(source, raw, config, generated_at)
            signals.extend(source_signals)
        except Exception as exc:
            errors.append(
                {
                    "sourceName": source.get("name", ""),
                    "sourceType": source.get("type", ""),
                    "url": source.get("url", ""),
                    "error": str(exc),
                }
            )

    deduped: dict[str, dict[str, Any]] = {}
    for signal in signals:
        key = signal["url"] or signal["id"]
        current = deduped.get(key)
        if current is None or signal["confidence"] > current["confidence"]:
            deduped[key] = signal

    def signal_sort_key(item: dict[str, Any]) -> tuple[int, str, int]:
        detected_dates = item.get("detectedDates") or []
        best_date = item.get("publishedAt") or (f"{detected_dates[0]}T00:00:00+00:00" if detected_dates else "")
        event_rank = 1 if item.get("matchedEventKeywords") else 0
        return event_rank, best_date, int(item.get("confidence", 0))

    sorted_signals = sorted(deduped.values(), key=signal_sort_key, reverse=True)
    return sorted_signals[: int(config.get("maxSignals", 24))], errors


def build_candidates(signals: list[dict[str, Any]], errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    for signal in signals:
        candidates.append(
            {
                "status": signal["status"],
                "sourceName": signal["sourceName"],
                "sourceType": signal["sourceType"],
                "url": signal["url"],
                "title": signal["title"],
                "category": signal["category"],
                "confidence": signal["confidence"],
                "matchedKeywords": signal["matchedKeywords"],
                "matchedEventKeywords": signal["matchedEventKeywords"],
                "privacyReviewFlags": signal.get("privacyReviewFlags", []),
                "blockedPrivacyFlags": signal.get("blockedPrivacyFlags", []),
                "detectedDates": signal["detectedDates"],
                "snippets": [signal["summary"]],
            }
        )
    for error in errors:
        candidates.append({"status": "fetch-error", **error})
    return candidates


def source_type_for_event(signal: dict[str, Any]) -> str:
    if signal.get("sourceType") == "新聞彙整":
        return "媒體"
    return str(signal.get("sourceType") or "公開來源")


def event_date_from_signal(signal: dict[str, Any]) -> str:
    detected_dates = signal.get("detectedDates") or []
    if detected_dates:
        return detected_dates[0]
    for key in ("publishedAt", "capturedAt"):
        value = signal.get(key)
        if value:
            try:
                return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
            except ValueError:
                continue
    return utc_now().date().isoformat()


def should_publish_signal(signal: dict[str, Any], config: dict[str, Any]) -> bool:
    settings = config.get("autoPublish", {})
    if signal.get("blockedPrivacyFlags"):
        return False
    if not signal.get("matchedEventKeywords"):
        return False
    low_threshold = int(settings.get("lowConfidenceEventThreshold", 45))
    high_threshold = int(settings.get("highConfidenceThreshold", 80))
    if int(signal.get("confidence", 0)) >= high_threshold:
        return True
    return bool(settings.get("includeLowConfidenceEvents", True)) and int(signal.get("confidence", 0)) >= low_threshold


def signal_status(signal: dict[str, Any], config: dict[str, Any]) -> str:
    high_threshold = int(config.get("autoPublish", {}).get("highConfidenceThreshold", 80))
    if int(signal.get("confidence", 0)) >= high_threshold and not signal.get("blockedPrivacyFlags"):
        return "confirmed"
    if signal.get("matchedEventKeywords"):
        return "low-confidence"
    return "source-only"


def signal_type(signal: dict[str, Any], status: str) -> str:
    if signal.get("publicContextFlags"):
        return "自動抓取非正式公開足跡"
    if status == "confirmed":
        return "自動確認公開行程"
    return "自動抓取低可信訊號"


def signal_to_event(signal: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    status = signal_status(signal, config)
    source_name = str(signal.get("sourceName") or "公開來源")
    event_keywords = signal.get("matchedEventKeywords") or []
    matched_keywords = signal.get("matchedKeywords") or []
    source_type = source_type_for_event(signal)
    confidence = int(signal.get("confidence", 0))
    summary_prefix = "高可信公開來源自動確認" if status == "confirmed" else "低可信度自動標注"

    companies = [
        {
            "name": "NVIDIA",
            "executives": ["黃仁勳"],
            "relationship": "公開來源提及"
        }
    ]
    if source_name not in {"Google News: 黃仁勳", "Google News: Jensen Huang"}:
        companies.append(
            {
                "name": source_name,
                "executives": ["未指名高層"],
                "relationship": "公開來源 / 主辦方"
            }
        )

    return {
        "id": f"auto-{signal['id']}",
        "date": event_date_from_signal(signal),
        "time": "",
        "city": "公開來源未明",
        "country": "公開來源",
        "venue": source_name,
        "type": signal_type(signal, status),
        "status": status,
        "confidence": confidence,
        "privacy": "public-auto",
        "headline": signal.get("title") or "自動抓取公開訊號",
        "summary": f"{summary_prefix}：{signal.get('summary') or '來源未提供摘要。'}",
        "businessImpact": "這筆資料由公開來源自動抓取。高可信來源可直接作為正式時間線訊號；低可信資料已標注，應以後續官方公告或多來源交叉確認為準。",
        "industries": ["自動抓取", "公開訊號"],
        "watchlist": list(dict.fromkeys([source_name, *event_keywords, *matched_keywords]))[:8],
        "mentionedCompanies": ["NVIDIA"],
        "companies": companies,
        "sources": [
            {
                "label": signal.get("title") or "自動抓取公開來源",
                "url": signal.get("url"),
                "publisher": source_name,
                "sourceType": source_type,
            }
        ],
        "autoGenerated": True,
        "autoSignalId": signal["id"],
        "autoCategory": signal.get("category"),
        "autoCapturedAt": signal.get("capturedAt"),
    }


def auto_publish_events(events_path: Path, signals: list[dict[str, Any]], config: dict[str, Any], generated_at: str) -> int:
    if not events_path.exists():
        return 0

    payload = json.loads(events_path.read_text(encoding="utf-8"))
    original_events = [event for event in payload.get("events", []) if not str(event.get("id", "")).startswith("auto-")]
    known_source_urls = {
        source.get("url")
        for event in original_events
        for source in event.get("sources", [])
        if source.get("url")
    }
    max_auto_events = int(config.get("autoPublish", {}).get("maxAutoEvents", 12))
    auto_events: list[dict[str, Any]] = []

    for signal in signals:
        if len(auto_events) >= max_auto_events:
            break
        if not should_publish_signal(signal, config):
            signal["status"] = signal_status(signal, config)
            continue
        if signal.get("url") in known_source_urls:
            signal["status"] = "already-covered"
            continue
        signal["status"] = signal_status(signal, config)
        auto_events.append(signal_to_event(signal, config))

    payload["generatedAt"] = generated_at
    payload["notice"] = "資料收錄公開來源可驗證事件；高可信自動發布，低可信自動標注；不代表即時位置，也不收私人會面推測。"
    payload["events"] = sorted(
        [*original_events, *auto_events],
        key=lambda event: (event.get("date", ""), event.get("time", "")),
        reverse=True,
    )
    write_json(events_path, payload)
    return len(auto_events)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="抓取公開來源，高可信自動發布，低可信自動標注。")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--events", default=str(EVENTS_PATH))
    parser.add_argument("--candidate-output", default=str(CANDIDATE_OUTPUT_PATH))
    parser.add_argument("--signals-output", default=str(SIGNALS_OUTPUT_PATH))
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    generated_at = utc_now().isoformat()
    signals, errors = build_signals(config)
    published_count = auto_publish_events(Path(args.events), signals, config, generated_at)

    signal_payload = {
        "generatedAt": generated_at,
        "lookbackDays": int(config.get("lookbackDays", 30)),
        "notice": "自動抓取公開來源產生的訊號；高可信直接進正式時間線，低可信會標注，不代表即時位置。",
        "publishedToTimeline": published_count,
        "signals": signals,
        "errors": errors,
    }
    candidate_payload = {
        "generatedAt": generated_at,
        "notice": "候選資料同步保存；高可信已自動發布，低可信已標注。",
        "candidates": build_candidates(signals, errors),
    }

    write_json(Path(args.signals_output), signal_payload)
    write_json(Path(args.candidate_output), candidate_payload)
    print(f"Wrote {len(signals)} signals; published {published_count} auto events; {len(errors)} fetch errors")


if __name__ == "__main__":
    main()
