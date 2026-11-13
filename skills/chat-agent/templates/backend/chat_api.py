"""챗봇 API (FastAPI) — SSE 스트리밍 + 대화 저장.

SSE 이벤트 계약 (data: {json}\\n\\n)
  start  {thread_id, request_id?}        프록시가 헤더를 지울 때를 대비해 본문에도 thread_id
  step   {label}                         진행 표시("○○ 조회 중/완료") — 함수명 노출 금지
  token  {text}                          답 본문 조각
  reset  {}                              도구 호출로 끝난 응답의 서두 → 화면에서 지움
  final  {request_id, status, reply, unverified, tools, trace, model, prompt_version}
                                         ⚠ 가 붙은 최종본 — 화면은 본문을 이것으로 교체, 이후 token 무시
  title  {thread_id, title}              첫 턴만. 답을 보낸 '뒤' 만든다(사용자를 기다리게 하지 않음)
  error  {message}                       사용자용 문장(내부 예외 원문 금지)

연결 끊김: Starlette 은 클라이언트가 끊겨도 '동기' 생성기를 닫지 않는다.
→ Agent 는 별도 스레드에서 돌리고 queue 로 이벤트를 받는다. async 생성기의 finally 에서 stop 을 세우면
  다음 emit 에서 예외가 나 LLM 스트림 연결까지 닫힌다. 중지된 턴은 받은 데까지 stopped=True 로 저장한다.

앱에 붙이기: app.include_router(chat_api.router)
"""
from __future__ import annotations

import json
import queue
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

import chats
from agent import llm as L
from agent import prompts
from agent.loop import run_turn

router = APIRouter()
DOMAIN = "OO"                         # 프로젝트 업무 이름으로 바꾼다
ERROR_MSG = "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요."


class ChatReq(BaseModel):
    message: str
    thread_id: str | None = None


class _Stopped(Exception):
    pass


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False, default=str)}\n\n"


def context_note() -> str:
    """동적 맥락(최신 기준월 등). 프로젝트에 맞게 채운다."""
    return ""


def _make_title(llm, question: str, reply: str) -> str:
    try:
        t = llm.chat([{"role": "system", "content": prompts.TITLE_SYSTEM},
                      {"role": "user", "content": f"질문: {question}\n답: {reply[:800]}"}])
        return t.strip().strip('"').splitlines()[0][:40]
    except Exception:  # noqa: BLE001 — 제목 실패는 무시
        return ""


@router.post("/api/chat")
async def chat(req: ChatReq):
    question = (req.message or "").strip()
    if not question:
        raise HTTPException(400, "질문을 입력해 주세요.")
    # 스트림을 열기 전에 검사한다 — 열고 나면 상태코드를 바꿀 수 없다
    try:
        llm = L.make_llm()
    except L.LLMUnavailable as e:
        raise HTTPException(503, str(e)) from e
    thread = req.thread_id or chats.new_id()
    try:
        rec = chats.load(thread)
    except KeyError as e:
        raise HTTPException(400, "잘못된 대화 ID 입니다.") from e
    first_turn = rec is None
    history = chats.history(rec)

    q: queue.Queue = queue.Queue()
    stop = threading.Event()

    def emit(e: dict):
        if stop.is_set():
            raise _Stopped()
        q.put(e)

    def work():
        try:
            final = run_turn(llm, question, system=prompts.agent_system(DOMAIN, context_note()),
                             history=history, emit=emit)
            q.put({"type": "final", "prompt_version": prompts.PROMPT_VERSION, **final})
        except _Stopped:
            pass
        except Exception:  # noqa: BLE001
            q.put({"type": "error", "message": ERROR_MSG})
        finally:
            q.put(None)

    threading.Thread(target=work, daemon=True).start()

    async def gen():
        final, partial = None, []
        try:
            yield _sse({"type": "start", "thread_id": thread})
            while True:
                e = await run_in_threadpool(q.get)
                if e is None:
                    break
                if e["type"] == "token":
                    partial.append(e["text"])
                elif e["type"] == "reset":
                    partial.clear()
                elif e["type"] == "final":
                    final = e
                yield _sse(e)
            if final:
                await run_in_threadpool(chats.save_turn, thread, question, final)
                if first_turn:
                    title = await run_in_threadpool(_make_title, llm, question, final["reply"])
                    if title:
                        await run_in_threadpool(chats.set_title, thread, title, "summary")
                        yield _sse({"type": "title", "thread_id": thread, "title": title})
        finally:
            stop.set()
            if final is None:   # 끊김·오류 → 받은 데까지 '중지'로 저장
                await run_in_threadpool(chats.save_turn, thread, question, None,
                                        stopped=True, partial_text="".join(partial))

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "X-Thread-Id": thread})


# ── 대화 기록 ──
@router.get("/api/chats")
def list_chats(limit: int = 50):
    return {"chats": chats.list_chats(limit)}


@router.get("/api/chats/{thread_id}")
def get_chat(thread_id: str):
    try:
        rec = chats.load(thread_id)
    except KeyError as e:
        raise HTTPException(400, "잘못된 대화 ID 입니다.") from e
    if rec is None:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    return rec


class TitleReq(BaseModel):
    title: str


@router.patch("/api/chats/{thread_id}")
def rename_chat(thread_id: str, req: TitleReq):
    try:
        rec = chats.set_title(thread_id, req.title, "user")
    except KeyError as e:
        raise HTTPException(404, "대화를 찾을 수 없습니다.") from e
    except ValueError as e:
        raise HTTPException(400, "제목을 입력해 주세요.") from e
    return {"id": rec["id"], "title": rec["title"]}


@router.delete("/api/chats/{thread_id}")
def delete_chat(thread_id: str):
    try:
        chats.delete(thread_id)
    except KeyError as e:
        raise HTTPException(404, "대화를 찾을 수 없습니다.") from e
    return {"id": thread_id, "deleted": True}


@router.get("/api/llm-status")
def llm_status():
    return L.available()
