"""Agent 단위 테스트 — FakeLLM 으로 네트워크 없이 루프·가드·도구 오류 처리를 검증한다.

실제 도구 결과 숫자는 상수로 박지 말고 도구에서 꺼내 쓴다(원천 데이터가 바뀌면 값도 바뀐다).
"""
from agent import guard, tools
from agent.llm import FakeLLM
from agent.loop import run_turn


@tools.tool("get_rate", "지역 낙찰가율 조회", {"region": {"type": "string"}}, ["region"], label="낙찰가율 조회")
def get_rate(region, **_):
    if region == "없는곳":
        raise KeyError(region)
    return tools.ok({"지역": region, "낙찰가율": "43.59%"}, numbers=[43.59])


@tools.tool("boom", "항상 실패", label="실패 도구")
def boom(**_):
    raise ValueError("내부 오류")


SYS = "test"


def test_tool_then_answer_and_trace():
    llm = FakeLLM([{"tool": "get_rate", "args": {"region": "전주"}}, "전주 낙찰가율은 43.59%입니다."])
    events = []
    r = run_turn(llm, "전주 낙찰가율?", system=SYS, emit=events.append)
    assert r["trace"] == ["tool:get_rate", "answer"]
    assert r["unverified"] == []
    assert any(e["type"] == "step" and "낙찰가율 조회" in e["label"] for e in events)
    assert all("get_rate" not in e.get("label", "") for e in events)   # 함수명 노출 금지


def test_unverified_number_is_marked():
    llm = FakeLLM([{"tool": "get_rate", "args": {"region": "전주"}}, "전주는 43.59%, 군산은 51.20%입니다."])
    r = run_turn(llm, "비교", system=SYS)
    assert r["unverified"] == ["51.20"]
    assert "51.20%⚠" in r["reply"]


def test_tool_error_does_not_stop_turn():
    llm = FakeLLM([{"tool": "boom"}, {"tool": "get_rate", "args": {"region": "없는곳"}}, "조회할 수 없습니다."])
    r = run_turn(llm, "x", system=SYS)
    assert [t["ok"] for t in r["tools"]] == [False, False]
    assert r["status"] == "answered"


def test_duplicate_call_not_executed_twice():
    llm = FakeLLM([{"tool": "get_rate", "args": {"region": "전주"}},
                   {"tool": "get_rate", "args": {"region": "전주"}}, "끝"])
    r = run_turn(llm, "x", system=SYS)
    assert r["tools"][1]["ok"] is False


def test_ask_user_ends_turn():
    llm = FakeLLM([{"tool": "ask_user", "args": {"question": "어느 기준월인가요?"}}])
    r = run_turn(llm, "x", system=SYS)
    assert r["status"] == "asked" and r["reply"] == "어느 기준월인가요?"


def test_step_limit_forces_answer():
    llm = FakeLLM([{"tool": "get_rate", "args": {"region": f"r{i}"}} for i in range(3)] + ["한도 답"])
    r = run_turn(llm, "x", system=SYS, max_steps=3)
    assert r["trace"][-1] == "step_limit" and r["reply"].startswith("한도 답")


def test_reset_event_when_preamble_before_tool():
    class Preamble(FakeLLM):
        def chat_tools(self, messages, schemas, on_text=None):
            out = super().chat_tools(messages, schemas, on_text)
            if out["tool_calls"] and on_text:
                on_text("먼저 조회하겠습니다.")
            return out
    events = []
    run_turn(Preamble([{"tool": "get_rate", "args": {"region": "전주"}}, "답 43.59%"]), "x", system=SYS, emit=events.append)
    assert {"type": "reset"} in events


def test_guard_rules():
    ok = guard.evidence([0.5, 7061], ["1.25조원"])
    for text in ["비율은 50%입니다", "7,061억원", "12,500억원", "2026.03 기준", "2026년 3월", "3개월", "`x = 0.37`"]:
        assert guard.check(text, ok)["unverified"] == [], text
    assert guard.check("802.8의 차이", ok)["unverified"] == ["802.8"]   # 한글 조사 앞 소수도 한 수로 읽는다


def test_normalize_ym():
    assert tools.normalize_args({"ym": 202604, "x": None, "y": ""}) == {"ym": "202604"}
    assert tools.normalize_args({"ym": "2026-04"}) == {"ym": "202604"}
