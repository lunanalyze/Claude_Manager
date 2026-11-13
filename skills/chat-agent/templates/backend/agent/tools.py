"""도구 등록·실행.

원칙
- 숫자 계산은 도구(결정론 엔진·DB)가 한다. LLM 은 고르고 설명만 한다.
- 도구는 {"ok", "errors", "payload", "numbers", "title"} 를 돌려준다.
    payload : 화면·LLM 이 그대로 읽을 표시용 값(한국어 키, "70.0%"·"1.25조원" 같은 표시 문자열 권장)
    numbers : 숫자 가드가 대조할 원값 float 목록 — 도구가 명시적으로 낸다
    title   : 진행 표시·근거 영역에 쓸 사람용 이름(함수명 노출 금지)
- 인자 오류·내부 예외는 예외로 올리지 말고 ok=False + 이유로 돌려준다 → LLM 이 고쳐 다시 부른다.
- 도구 함수는 **_ 를 받아 LLM 이 낸 여분의 인자를 무시한다.
"""
from __future__ import annotations

import re
from typing import Callable

_REGISTRY: dict[str, dict] = {}


def tool(name: str, description: str, properties: dict | None = None,
         required: list[str] | None = None, label: str | None = None):
    """@tool("get_x", "설명(한국어)", {"ym": {"type": "string", "description": "기준월 YYYYMM"}}, ["ym"])"""
    def deco(fn: Callable):
        _REGISTRY[name] = {
            "fn": fn,
            "label": label or name,
            "schema": {"type": "function", "function": {
                "name": name, "description": description,
                "parameters": {"type": "object", "properties": properties or {},
                               "required": required or [], "additionalProperties": False}}},
        }
        return fn
    return deco


# 되묻기: 실행하지 않고 루프가 턴을 끝낸다. 가정하면 결과가 달라질 때만 쓰게 프롬프트로 안내한다.
ASK_USER = {"type": "function", "function": {
    "name": "ask_user",
    "description": "답에 꼭 필요한데 데이터로 정할 수 없는 정보를 사용자에게 묻는다. 추측하면 결과가 달라질 때만 쓴다.",
    "parameters": {"type": "object", "properties": {"question": {"type": "string"}},
                   "required": ["question"], "additionalProperties": False}}}


def schemas(include_ask_user: bool = True) -> list[dict]:
    out = [t["schema"] for t in _REGISTRY.values()]
    return out + [ASK_USER] if include_ask_user else out


def label(name: str, args: dict) -> str:
    """진행 표시용 이름. 화면에 함수명·코드값을 내보내지 않는다."""
    if name == "ask_user":
        return "추가 정보 확인"
    t = _REGISTRY.get(name)
    return t["label"] if t else "조회"


_YM = re.compile(r"^(19|20)\d\d-?(0[1-9]|1[0-2])$")


def normalize_args(args: dict) -> dict:
    """LLM 응답 직후 한 번만 정규화한다(진행 표시·실행·기록이 같은 값을 쓰게).
    - None·"" 제거
    - 기준월: 202604(int) / "2026-04" → "202604"  (실제 사고: 숫자로 와서 TypeError 로 턴이 멈춤)
    프로젝트 도메인에 맞게 키 이름을 고친다.
    """
    out = {}
    for k, v in (args or {}).items():
        if v is None or v == "":
            continue
        if k in ("ym", "base_ym", "compare_ym") and _YM.match(str(v)):
            v = str(v).replace("-", "")
        out[k] = v
    return out


def ok(payload, numbers=(), title: str = "") -> dict:
    return {"ok": True, "errors": [], "payload": payload,
            "numbers": [float(x) for x in numbers if x is not None], "title": title}


def fail(*errors: str) -> dict:
    return {"ok": False, "errors": list(errors), "payload": {}, "numbers": [], "title": ""}


def call_tool(name: str, args: dict) -> dict:
    t = _REGISTRY.get(name)
    if not t:
        return fail(f"알 수 없는 도구: {name}")
    try:
        res = t["fn"](**normalize_args(args))
    except KeyError as e:
        return fail(f"찾을 수 없는 값: {str(e).strip(chr(39) + chr(34))}. 사용할 수 있는 값을 먼저 조회하세요.")
    except Exception as e:  # noqa: BLE001 — 턴을 멈추지 않는 것이 목적
        return fail(f"도구 실행 중 오류({type(e).__name__}): {e}. 인자를 확인해 다시 부르거나 다른 방법을 쓰세요.")
    res.setdefault("title", t["label"])
    return res
