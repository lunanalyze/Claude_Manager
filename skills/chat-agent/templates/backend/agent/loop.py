"""Agent 루프 — 네이티브 도구 호출을 직접 돌리는 for 루프(LangGraph 불필요, 약 80줄).

think → (도구 호출이 있으면) act → think … → 답 → 숫자 가드
- 같은 (도구, 인자) 반복 호출은 실행하지 않고 "이미 조회함"을 돌려준다
- ask_user 가 나오면 실행하지 않고 그 질문으로 턴을 끝낸다(status="asked")
- MAX_STEPS 를 넘으면 도구 없이 지금까지 결과로 답하게 한다
- 도구 호출로 끝난 응답이 서두를 흘렸으면 reset 이벤트로 화면에서 지운다
- 지난 턴은 '질문·답 본문'만 넣는다. 도구 결과는 넣지 않는다 → 숫자는 이번 턴 도구 결과에서만 나와야 가드가 성립

emit(event) 는 SSE 로 내보낼 이벤트를 받는다. 연결이 끊기면 emit 이 예외를 던져 루프·LLM 스트림이 멈춘다.
"""
from __future__ import annotations

import json
import time
import uuid
from typing import Callable

from . import guard, tools

MAX_STEPS = 8
STEP_LIMIT_MSG = "조회 단계 한도에 도달했습니다. 더 조회하지 말고 지금까지의 결과만으로 답하세요."


def run_turn(llm, question: str, *, system: str, history: list[dict] | None = None,
             emit: Callable[[dict], None] = lambda e: None, max_steps: int = MAX_STEPS,
             extra_ok_texts: tuple[str, ...] = ()) -> dict:
    request_id = uuid.uuid4().hex[:12]
    t0 = time.time()
    msgs = [{"role": "system", "content": system}, *(history or []), {"role": "user", "content": question}]
    seen: set[tuple[str, str]] = set()
    results: list[dict] = []
    trace: list[str] = []
    status, answer = "answered", ""
    schemas = tools.schemas()

    for _ in range(max_steps):
        streamed = []

        def on_text(t):
            streamed.append(t)
            emit({"type": "token", "text": t})

        out = llm.chat_tools(msgs, schemas, on_text=on_text)
        calls = out["tool_calls"]
        if not calls:
            trace.append("answer")
            answer = out["content"]
            break
        if streamed:
            emit({"type": "reset"})           # 도구 호출 전 서두는 지운다

        calls = [{**c, "arguments": tools.normalize_args(c["arguments"])} for c in calls]
        msgs.append({"role": "assistant", "content": out["content"], "tool_calls": [
            {"id": c["id"], "type": "function",
             "function": {"name": c["name"], "arguments": json.dumps(c["arguments"], ensure_ascii=False)}}
            for c in calls]})

        asked = next((c for c in calls if c["name"] == "ask_user"), None)
        if asked:
            status, answer = "asked", str(asked["arguments"].get("question", "")).strip()
            trace.append("ask_user")
            break

        for c in calls:
            key = (c["name"], json.dumps(c["arguments"], sort_keys=True, ensure_ascii=False))
            label = tools.label(c["name"], c["arguments"])
            if key in seen:
                res = tools.fail("같은 조회를 이미 했습니다. 받은 결과로 답하세요.")
            else:
                seen.add(key)
                emit({"type": "step", "label": f"{label} 중"})
                res = tools.call_tool(c["name"], c["arguments"])
                emit({"type": "step", "label": f"{label} 완료" if res["ok"] else f"{label} — 조건을 바꿔 다시 조회"})
            trace.append(f"tool:{c['name']}")
            results.append({"tool": c["name"], "args": c["arguments"], **res})
            msgs.append({"role": "tool", "tool_call_id": c["id"], "name": c["name"],
                         "content": json.dumps({"ok": res["ok"], "errors": res["errors"], "result": res["payload"]},
                                               ensure_ascii=False, default=str)})
    else:
        trace.append("step_limit")
        msgs.append({"role": "user", "content": STEP_LIMIT_MSG})
        answer = llm.chat(msgs, on_text=lambda t: emit({"type": "token", "text": t}))

    # 숫자 가드: 이번 턴 도구 결과 + 사용자 발화만 근거로 인정
    texts = [question, *extra_ok_texts, *(json.dumps(r["payload"], ensure_ascii=False, default=str) for r in results)]
    allowed = guard.evidence((n for r in results for n in r.get("numbers", [])), texts)
    g = guard.check(guard.limit_bold(answer), allowed) if status == "answered" else {"text": answer, "unverified": []}
    reply = g["text"]
    if g["unverified"]:
        reply += f"\n\n⚠ 표시 숫자 {len(g['unverified'])}개는 조회 결과에서 확인되지 않았습니다."

    return {"request_id": request_id, "status": status, "reply": reply, "unverified": g["unverified"],
            "tools": [{k: r.get(k) for k in ("tool", "args", "ok", "errors", "payload", "title")} for r in results],
            "trace": trace, "model": getattr(llm, "model", ""), "elapsed": round(time.time() - t0, 2)}
