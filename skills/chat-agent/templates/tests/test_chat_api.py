"""챗 API 테스트 — make_llm 을 FakeLLM 으로 바꾸고, 대화 저장 폴더를 임시 폴더로 돌려 실제 기록을 건드리지 않는다."""
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import chat_api
import chats
from agent import tools
from agent.llm import FakeLLM


@tools.tool("get_rate2", "낙찰가율 조회", {"region": {"type": "string"}}, ["region"], label="낙찰가율 조회")
def get_rate2(region, **_):
    return tools.ok({"지역": region, "낙찰가율": "43.59%"}, numbers=[43.59])


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(chats, "CHAT_DIR", tmp_path)
    app = FastAPI()
    app.include_router(chat_api.router)
    return TestClient(app)


def _events(res):
    return [json.loads(line[6:]) for line in res.text.splitlines() if line.startswith("data: ")]


def test_chat_stream_saves_turn_and_title(client, monkeypatch):
    fake = FakeLLM([{"tool": "get_rate2", "args": {"region": "전주"}}, "전주는 43.59%입니다.", "전주 낙찰가율 문의"])
    monkeypatch.setattr(chat_api.L, "make_llm", lambda *a, **k: fake)
    res = client.post("/api/chat", json={"message": "전주 낙찰가율?"})
    assert res.status_code == 200
    ev = _events(res)
    types = [e["type"] for e in ev]
    assert types[0] == "start" and "final" in types and types[-1] == "title"
    assert all("get_rate2" not in e.get("label", "") for e in ev)
    tid = ev[0]["thread_id"]
    rec = client.get(f"/api/chats/{tid}").json()
    assert rec["title"] == "전주 낙찰가율 문의" and rec["title_source"] == "summary"
    assert [m["role"] for m in rec["messages"]] == ["user", "agent"]
    assert client.get("/api/chats").json()["chats"][0]["id"] == tid


def test_no_key_returns_503_before_stream(client, monkeypatch):
    def boom(*a, **k):
        raise chat_api.L.LLMUnavailable("OLLAMA_API_KEY 가 설정되지 않았습니다.")
    monkeypatch.setattr(chat_api.L, "make_llm", boom)
    assert client.post("/api/chat", json={"message": "x"}).status_code == 503


def test_bad_thread_id_rejected(client, monkeypatch):
    monkeypatch.setattr(chat_api.L, "make_llm", lambda *a, **k: FakeLLM(["x"]))
    assert client.post("/api/chat", json={"message": "x", "thread_id": "../etc"}).status_code == 400
    assert client.get("/api/chats/..%2Fetc").status_code in (400, 404)


def test_user_title_not_overwritten(client):
    chats.save_turn("t1", "질문", {"reply": "답"})
    chats.set_title("t1", "내 제목", "user")
    chats.set_title("t1", "자동 제목", "summary")
    assert chats.load("t1")["title"] == "내 제목"
