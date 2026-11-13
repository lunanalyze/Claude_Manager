"""LLM 래퍼 — Ollama 네이티브 /api/chat (도구 호출·스트리밍).

반환 계약은 스트리밍 여부와 무관하게 같다:
  chat(messages, on_text=None, json_mode=False) -> str
  chat_tools(messages, tools, on_text=None)    -> {"content": str, "tool_calls": [{"id","name","arguments": dict}]}
on_text 가 있으면 답 본문 조각을 받을 때마다 부른다(생각 과정 message.thinking 은 보내지 않는다).

메시지는 내부에서 OpenAI 형식으로 쌓는다
  assistant: {"role","content","tool_calls":[{"id","type":"function","function":{"name","arguments": JSON 문자열}}]}
  tool     : {"role":"tool","tool_call_id","name","content"}
Ollama 로 보낼 때만 _to_ollama 로 바꾼다(arguments → dict, name → tool_name).

환경변수(이름만 고정, 값은 .env): OLLAMA_API_KEY, OLLAMA_BASE_URL(기본 https://ollama.com), LLM_MODEL
"""
from __future__ import annotations

import json
import os
from functools import lru_cache

import httpx

DEFAULT_BASE_URL = "https://ollama.com"          # 온프레미스면 http://host:11434
DEFAULT_MODEL = "deepseek-v4.1-flash:cloud"       # 모델명은 반드시 설정값으로 둔다(없는 모델명 → "model not found")


class LLMUnavailable(RuntimeError):
    """키·모델 설정이 없다 — API 는 스트림을 열기 전에 503 으로 돌려준다."""


def _args(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return {}


class OllamaLLM:
    def __init__(self, model: str | None = None, base_url: str | None = None,
                 api_key: str | None = None, timeout: float = 120.0, temperature: float = 0.0):
        self.model = model or os.getenv("LLM_MODEL", DEFAULT_MODEL)
        key = api_key if api_key is not None else os.getenv("OLLAMA_API_KEY", "")
        if not key.strip():
            raise LLMUnavailable("OLLAMA_API_KEY 가 설정되지 않았습니다.")
        self.temperature = temperature
        self.client = httpx.Client(
            base_url=(base_url or os.getenv("OLLAMA_BASE_URL", DEFAULT_BASE_URL)).rstrip("/"),
            headers={"Authorization": f"Bearer {key.strip()}"},
            timeout=timeout,
        )

    # ── 형식 변환 ──
    @staticmethod
    def _to_ollama(messages: list[dict]) -> list[dict]:
        out = []
        for m in messages:
            m = dict(m)
            if m.get("tool_calls"):
                m["tool_calls"] = [{"function": {"name": c["function"]["name"],
                                                 "arguments": _args(c["function"].get("arguments"))}}
                                   for c in m["tool_calls"]]
            if m.get("role") == "tool":
                m = {"role": "tool", "content": m.get("content", ""), "tool_name": m.get("name", "")}
            out.append(m)
        return out

    def _body(self, messages, tools=None, json_mode=False) -> dict:
        body = {"model": self.model, "messages": self._to_ollama(messages),
                "options": {"temperature": self.temperature}}
        if tools:
            body["tools"] = tools
        if json_mode:
            body["format"] = "json"
        return body

    # ── 호출 ──
    def _once(self, body) -> dict:
        r = self.client.post("/api/chat", json={**body, "stream": False})
        if r.status_code != 200:
            raise RuntimeError(f"Ollama {r.status_code}: {r.text[:200]}")
        return r.json().get("message") or {}

    def _stream(self, body, on_text) -> dict:
        text, calls = [], []
        with self.client.stream("POST", "/api/chat", json={**body, "stream": True}) as r:
            if r.status_code != 200:
                r.read()
                raise RuntimeError(f"Ollama {r.status_code}: {r.text[:200]}")
            for line in r.iter_lines():
                if not line.strip():
                    continue
                d = json.loads(line)
                if "error" in d:
                    raise RuntimeError(d["error"])
                m = d.get("message") or {}
                if m.get("content"):
                    text.append(m["content"])
                    on_text(m["content"])          # 소비자가 예외를 던지면(연결 끊김) with 가 연결을 닫는다
                calls += m.get("tool_calls") or []
                if d.get("done"):
                    break
        return {"content": "".join(text), "tool_calls": calls}

    def chat(self, messages, on_text=None, json_mode=False) -> str:
        body = self._body(messages, json_mode=json_mode)
        msg = self._stream(body, on_text) if on_text else self._once(body)
        return msg.get("content") or ""

    def chat_tools(self, messages, tools, on_text=None) -> dict:
        body = self._body(messages, tools=tools)
        msg = self._stream(body, on_text) if on_text else self._once(body)
        calls = [{"id": c.get("id") or f"call_{i}",
                  "name": c["function"]["name"],
                  "arguments": _args(c["function"].get("arguments"))}
                 for i, c in enumerate(msg.get("tool_calls") or [])]
        return {"content": msg.get("content") or "", "tool_calls": calls}


@lru_cache(maxsize=8)
def make_llm(model: str | None = None) -> OllamaLLM:
    """모델별 클라이언트를 프로세스 안에서 재사용한다. 테스트는 이 함수를 monkeypatch 한다."""
    return OllamaLLM(model=model)


def available() -> dict:
    """키 값은 절대 내보내지 않는다 — 있는지 여부만."""
    return {"available": bool(os.getenv("OLLAMA_API_KEY", "").strip()),
            "model": os.getenv("LLM_MODEL", DEFAULT_MODEL)}


class FakeLLM:
    """테스트용. responses 를 순서대로 소비한다.
    - 문자열            → 최종 답
    - {"tool","args"}   → 도구 호출 1건,  그 목록 → 병렬 호출
    받은 messages 는 self.calls 에 남는다. on_text 는 4글자씩 불러 스트리밍을 흉내 낸다.
    """

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls: list[list[dict]] = []
        self.model = "fake"

    def _next(self, messages):
        self.calls.append(json.loads(json.dumps(messages, ensure_ascii=False)))
        return self.responses.pop(0)

    def chat(self, messages, on_text=None, json_mode=False) -> str:
        r = self._next(messages)
        text = r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)
        if on_text:
            for i in range(0, len(text), 4):
                on_text(text[i:i + 4])
        return text

    def chat_tools(self, messages, tools, on_text=None) -> dict:
        r = self._next(messages)
        if isinstance(r, str):
            if on_text:
                for i in range(0, len(r), 4):
                    on_text(r[i:i + 4])
            return {"content": r, "tool_calls": []}
        items = r if isinstance(r, list) else [r]
        return {"content": "", "tool_calls": [{"id": f"call_{i}", "name": x["tool"], "arguments": x.get("args", {})}
                                              for i, x in enumerate(items)]}
