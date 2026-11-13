"""대화 저장소 — data/chats/<thread_id>.json 파일 하나가 대화 하나(git 제외 폴더).

- threading.Lock + 임시 파일에 쓴 뒤 replace(원자적 쓰기)
- thread_id 는 ^[A-Za-z0-9_-]{1,64}$ 만 허용(경로 조작 방지: "../etc" → KeyError)
- 제목 규칙
  1) 첫 저장 때는 첫 질문 60자 (title_source="question")
  2) 첫 턴이 끝나면 LLM 요약 제목 (title_source="summary"), 이후 자동으로 바꾸지 않음
  3) 사용자가 바꾼 제목(title_source="user")은 자동 요약이 덮어쓰지 않음
DB 를 쓰는 프로젝트면 같은 계약으로 테이블에 옮겨도 된다.
"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path

CHAT_DIR = Path(os.getenv("CHAT_DIR", "data/chats"))
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_LOCK = threading.Lock()


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def _path(thread_id: str) -> Path:
    if not _ID.match(thread_id or ""):
        raise KeyError(thread_id)
    return CHAT_DIR / f"{thread_id}.json"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _write(rec: dict) -> None:
    CHAT_DIR.mkdir(parents=True, exist_ok=True)
    p = _path(rec["id"])
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)


def load(thread_id: str) -> dict | None:
    p = _path(thread_id)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def history(rec: dict | None, turns: int = 6) -> list[dict]:
    """LLM 에 넣을 지난 대화: 질문·답 '본문'만 최근 N턴(도구 결과는 넣지 않는다)."""
    if not rec:
        return []
    out = []
    for m in rec.get("messages", [])[-turns * 2:]:
        if m.get("role") == "user":
            out.append({"role": "user", "content": m["content"]})
        elif m.get("role") == "agent" and not m.get("stopped"):
            out.append({"role": "assistant", "content": m.get("content", "")})
    return out


def save_turn(thread_id: str, question: str, final: dict | None, *, stopped: bool = False,
              partial_text: str = "") -> dict:
    """정상 종료·중지 모두 저장한다(중지면 stopped=True, 받은 데까지의 글)."""
    with _LOCK:
        rec = load(thread_id) or {"id": thread_id, "title": question.strip()[:60], "title_source": "question",
                                  "created": _now(), "messages": []}
        rec["messages"].append({"role": "user", "content": question, "at": _now()})
        agent = {"role": "agent", "at": _now(), "stopped": stopped}
        if final:
            agent.update(content=final.get("reply", ""), status=final.get("status"), tools=final.get("tools", []),
                         unverified=final.get("unverified", []), model=final.get("model"))
        else:
            agent.update(content=partial_text)
        rec["messages"].append(agent)
        rec["updated"] = _now()
        _write(rec)
        return rec


def set_title(thread_id: str, title: str, source: str) -> dict:
    with _LOCK:
        rec = load(thread_id)
        if rec is None:
            raise KeyError(thread_id)
        if source == "summary" and rec.get("title_source") in ("summary", "user"):
            return rec
        title = " ".join((title or "").split())[:80]
        if not title:
            raise ValueError("빈 제목")
        rec["title"], rec["title_source"] = title, source
        _write(rec)
        return rec


def list_chats(limit: int = 50) -> list[dict]:
    if not CHAT_DIR.exists():
        return []
    recs = []
    for p in CHAT_DIR.glob("*.json"):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        recs.append({"id": r["id"], "title": r.get("title", ""), "created": r.get("created"),
                     "updated": r.get("updated"), "turns": len(r.get("messages", [])) // 2})
    return sorted(recs, key=lambda r: r.get("updated") or "", reverse=True)[:limit]


def delete(thread_id: str) -> None:
    with _LOCK:
        p = _path(thread_id)
        if not p.exists():
            raise KeyError(thread_id)
        p.unlink()
