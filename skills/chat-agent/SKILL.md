---
name: chat-agent
description: 업무 웹앱(FastAPI + React 계열)에 '도구를 불러 실제 데이터로 답하는' AI 챗봇을 붙인다. Ollama 클라우드 네이티브 도구 호출 루프 → 숫자 가드(환각 숫자 ⚠ 표시) → SSE 스트리밍(start/step/token/reset/final/title/error) → 대화 저장·제목 → 스트리밍 렌더링 → FakeLLM 단위 테스트·데이터 도달률 평가까지 검증된 템플릿으로 구현한다. ALM·withnim 두 프로젝트에서 실패로 배운 규칙을 담았다. "챗봇 붙여줘", "AI 어시스턴트 만들어", "Agent 챗 구현", "도구 호출 챗봇", "챗봇 스트리밍", "챗봇 숫자 환각 막아", "/chat-agent" 에 사용.
---

# chat-agent

업무 앱에 **"질문 → 도구로 실제 데이터 조회 → 근거 있는 답"** 챗봇을 붙이는 skill.
출처: `Desktop\Github\ALM`(LangGraph 판, 평가셋·스트리밍 렌더링이 성숙) +
`Desktop\Github\withnim`(직접 루프 판, 가드·연결 끊김 처리가 성숙)을 합친 것. 템플릿은 2026-11-13에
FakeLLM 테스트 13개 통과, 실제 모델(`deepseek-v4.1-flash:cloud`) 루프 1회 동작을 확인했다.

## 핵심 원칙 (먼저 읽는다)

1. **숫자는 도구가 만든다. LLM은 고르고 설명만 한다.** 계산은 결정론 엔진·DB 함수로.
2. **환각은 막지 말고 표시한다.** 답의 숫자를 이번 턴 도구 결과와 대조해 안 맞으면 `⚠`.
   검열(재생성·표 대체)은 오탐이 잦아 두 프로젝트 모두 폐기했다. "원인" 서술 가드도 오탐뿐이라 제거.
3. **통제는 프롬프트 금지문보다 도구 계약·코드 후처리로.** 꼭 필요한 정보는 도구의 필수 인자,
   모호하면 `ask_user`. 프롬프트로 막아도 모델은 어긴다(상투적 서두·굵게 남발) → 코드로 강제.
   단, 도구 계약은 "값이 명시된다"를 보장할 뿐 "사용자가 답했다"를 보장하지 않는다(모델이 가정하고 바로 부름).
4. **LLM 탐색을 막지 않는다.** 사양 추출 + 코드 라우팅 방식은 열린 질문을 억지로 단건 조회로 처리해서
   네이티브 도구 호출 루프로 바꿨다(ALM P6). 재현성보다 탐색, 환각은 근거 표시로 대응.
5. **화면에 함수명·내부 코드값을 내보내지 않는다.** 진행 표시는 도구 `label`, 테스트로 강제.

## 구성 (templates/)

| 파일 | 역할 |
|---|---|
| `backend/agent/llm.py` | Ollama 네이티브 `/api/chat` 래퍼. `chat()`/`chat_tools()` 반환 계약 고정, `on_text` 스트리밍, `make_llm`(lru_cache), `available()`(키 값 비노출), `FakeLLM` |
| `backend/agent/tools.py` | `@tool` 등록, `call_tool`(예외 → `ok=False`+이유), `normalize_args`, `ask_user` 스키마, `label` |
| `backend/agent/loop.py` | 직접 루프 `run_turn`: 반복 호출 차단·ask_user·단계 한도 강제 답·reset·가드 |
| `backend/agent/guard.py` | 숫자 가드 `evidence`/`check`, `limit_bold` |
| `backend/agent/prompts.py` | 시스템 프롬프트(일하는 방식/답하는 방식/형식), 제목 프롬프트, `PROMPT_VERSION` |
| `backend/chats.py` | 대화 파일 저장(원자적 쓰기·ID 검증·제목 규칙), 지난 대화 = 본문만 |
| `backend/chat_api.py` | FastAPI 라우터: `/api/chat` SSE(스레드+큐, 끊김 시 중지 저장), `/api/chats` CRUD, `/api/llm-status` |
| `frontend/sse.js` | POST SSE 파서(청크 경계·여러 이벤트·abort·끊김 감지) |
| `frontend/useChat.js` | 챗 상태 훅(turnRef·final 교체·끼어들기·localStorage try/catch) |
| `frontend/StreamText.jsx` | 도착 속도 1/2 렌더링, rAF 루프 1개, 완성된 줄만 Markdown, 미완성 표 숨김 |
| `tests/test_agent.py`, `tests/test_chat_api.py` | FakeLLM 단위·API 테스트(네트워크 없음, 저장 폴더는 tmp) |
| `eval/agent_eval.yaml`, `eval/run_agent_eval.py` | 데이터 도달률 평가(실제 LLM) |

## 적용 절차

1. **대상 파악 (읽기만)** — 백엔드 구조, 기존 챗봇 유무, 도메인 계산 함수(도구 후보), 프론트 스택, 포트(`ports.md`).
   기존 챗봇이 있으면 무엇을 갈아끼울지 **안을 먼저 제시하고 승인**받는다(작업 규칙 1).
2. **템플릿 복사** — `backend/agent/`, `chats.py`, `chat_api.py` → 대상 백엔드. 대상 import 방식에 맞게 경로를 고친다
   (예: `sys.path` 에 backend 가 있으면 `from agent import ...` 그대로). `data/chats/`, `data/eval/` 는 `.gitignore`.
3. **도구 작성** — 기존 서비스 함수를 감싼다. 각 도구:
   - 설명·인자 설명은 **한국어**, 고정 값은 `enum`, 코드→뜻은 description 에.
   - 반환 `tools.ok(payload, numbers=[원값...])`. payload 는 한국어 키 + 표시 문자열("70.0%", "1.25조원").
     **`numbers` 에 가드가 대조할 원값을 꼭 넣는다** — 빠뜨리면 맞는 숫자도 ⚠ 가 붙는다.
   - "조회 가능한 기간/항목" 도구를 하나 둔다(모델이 묻지 않고 스스로 확인하게).
   - 기간 밖·없는 값은 `fail("보유 기간은 X~Y입니다")` 처럼 **고칠 방법**을 돌려준다.
4. **프롬프트** — `prompts.agent_system(도메인, context_note)`. 최신 기준월 같은 동적 맥락은 `context_note()`.
5. **API 연결** — `app.include_router(chat_api.router)`, `DOMAIN` 지정. 키 없으면 503(스트림 열기 전), 조회 기능은 계속 동작.
6. **프론트** — `sse.js`·`useChat.js`·`StreamText.jsx` 복사. 마크다운: `react-markdown remark-gfm remark-breaks
   remark-cjk-friendly`(+코드가 필요하면 `rehype-highlight`, 언어 등록·`detect:false`). `skipHtml`, 이미지 금지.
   답 카드에 "근거 자세히 보기(조회 N건 · 확인 안 된 숫자 M개)" 접힘 영역 — `final.tools[].payload` 를 표로.
   입력: Enter 전송, **IME 조합 중(`e.nativeEvent.isComposing`) 무시**, Shift+Enter 줄바꿈.
   자동 스크롤 effect 는 `scrollIntoView()` 반환값을 돌려주지 않게 중괄호로 감싼다.
7. **테스트** — 템플릿 테스트를 대상 도구로 바꿔 통과시킨다. 실제 숫자는 상수로 박지 말고 도구에서 꺼낸다.
8. **평가** — `agent_eval.yaml` 에 대상 업무 질문 10~40개(+손대지 않는 `hold` 세트). `run_agent_eval.py` 로
   데이터 도달률 ≥ 90%, 되묻기 문항 통과를 확인한다. 실제 LLM 호출이므로 **실행 전 사용자에게 알린다.**
9. **검증 보고** — 브라우저로 질문 1~2개(내부 조회형, 검색형)를 실제로 돌려 step·token·final·title 이 오는지,
   ⚠ 표시·근거 영역이 보이는지 확인하고 보고한다. 확인 못 한 것은 "확인 불가".

## LLM 호출 방식 선택

- **기본: Ollama 네이티브 `POST {base}/api/chat`** (`llm.py`). NDJSON 스트림, `tool_calls[].function.arguments`
  가 **dict**, tool 메시지는 `tool_name`, 온도는 `options.temperature`. 두 프로젝트 모두 이 방식이다.
- 2026-11-13 직접 확인(`deepseek-v4.1-flash:cloud`, `https://ollama.com`):
  네이티브 일반·스트리밍 도구 호출 O, OpenAI 호환 `https://ollama.com/v1` 스트리밍 도구 호출 O
  (이때 `delta.tool_calls[i].function.arguments` 는 **조각 문자열 → index 별로 이어 붙여** JSON 파싱해야 한다).
  모델명은 `:cloud` 붙인 것·뗀 것 모두 직접 API에서 동작했다.
- 모델명은 **설정값**(`LLM_MODEL`)으로만. 없는 모델명은 `model not found` (실제 사고).
- 모델마다 파라미터 제약이 다르다: 예) OpenAI gpt-6 계열은 `temperature=0` 을 400으로 거부,
  Chat Completions 는 도구+추론 동시 사용 불가 → Responses API. 새 모델은 **작은 호출로 먼저 확인**한다.
- 생각 과정(`message.thinking`)은 답 본문으로 보내지 않는다.

## 실패에서 배운 규칙 (체크리스트)

**루프·도구**
- [ ] LLM 인자는 응답 직후 **한 번** 정규화(기준월 202604/"2026-04" → "202604"). 안 하면 진행 표시·필수값 점검이 `TypeError` 로 턴을 멈추고 "데이터 없음" 오답.
- [ ] 도구 내부 예외는 `ok=False` + 이유로 LLM에 돌려준다 → 턴이 멈추지 않고 모델이 고쳐 부른다.
- [ ] 같은 (도구, 인자) 반복 호출 차단. 단계 한도 초과 시 도구 없이 지금까지 결과로 답하게.
- [ ] LLM 이 키 대신 한글 라벨을 내는 경우 → 출력 정규화 + "영문 키로" 지시.
- [ ] LLM의 "승인/판정"은 믿지 않는다. 규칙(점검표) 미충족이면 코드가 뒤집는다.

**숫자 가드** (`guard.py` 주석에 근거)
- [ ] 소수↔백분율(0.50↔50%), 억↔조, 부호 반전 허용. 날짜(2026.09·26.09·2026년 9월)·쉼표 없는 작은 정수(≤31)·코드 블록 제외.
- [ ] 한글 조사: `\b` 는 한글 앞에서 실패 → lookahead 정규식("802.8의"를 한 수로).
- [ ] 지난 턴 도구 결과를 다시 넣지 않는다 — 숫자는 이번 턴 결과에서만 나와야 가드가 성립. (대신 "필요하면 다시 조회" 지시)
- [ ] ⚠ 대부분은 모델이 직접 더하거나 나눈 값(합계·비중·"약 2배")이다 — 의도대로 작동하는 것. 프롬프트에 "직접 계산한 값 쓰지 말 것".
- [ ] 한계: 결과에 있는 숫자를 다른 항목에 붙여 쓰는 오류는 못 잡는다(문서에 명시).

**스트리밍·화면**
- [ ] Starlette 은 끊겨도 동기 생성기를 닫지 않는다 → Agent 는 스레드+큐, async 생성기 `finally` 에서 stop → 다음 emit 에서 LLM 연결까지 닫힘. 중지 턴은 받은 데까지 `stopped` 로 저장.
- [ ] 도구 호출로 끝난 응답이 흘린 서두는 `reset` 으로 지운다.
- [ ] ⚠ 는 다 쓴 뒤에 붙으므로 `final` 로 본문 교체, 이후 token 무시.
- [ ] 제목은 답(`final`)을 보낸 뒤 같은 SSE 에서 `title` 이벤트로(백그라운드+폴링보다 깔끔).
- [ ] `start` 본문에도 thread_id(프록시가 `X-Thread-Id` 헤더를 지울 수 있음). 헤더 `X-Accel-Buffering: no`.
- [ ] 마크다운을 안 그리면 `**`·표가 그대로 보인다 → 렌더링 + 형식 규칙. 굵게는 `limit_bold` 로 강제.
- [ ] 스트림 렌더링: 도착 속도 1/2, rAF 루프 1개(재시작하면 2.7~2.8배로 빨라짐), 미완성 표 숨김.
- [ ] 조각 이벤트가 수천 개면 rAF 프레임마다 모아서 setState.
- [ ] 늦게 끝난 이전 스트림이 현재 busy 를 풀지 않게 turnRef.

**평가**
- [ ] 채점은 문장이 아니라 "필요한 도구·키에 도달했나". 채점기 키 누락 버그로 오판한 적 있음 → 채점기도 테스트.
- [ ] 오류 문항은 traceback·실패 턴·도구 인자를 기록(없으면 원인 확인 불가).
- [ ] 개발 중 고친 문항은 과적합 → `hold` 보류 세트.

## 보안·운영

- 키는 `.env`(git 제외)에서만. `available()`·로그·응답 어디에도 키 값을 내보내지 않는다.
- 대화 ID 정규식 검증으로 경로 조작 차단, 대화 파일은 git 제외 폴더.
- 외부 모델로 업무 데이터가 나간다 — 조직 허용 여부를 확인한 뒤 적용(허용됐으면 다시 묻지 않는다).
- 감사가 필요하면 ALM `api/audit.py` 방식(날짜별 JSONL, `prev_hash`+SHA-256 체인, `verify()`)을 추가한다.

## 하지 않는 것

- 대상 프로젝트의 기존 챗봇을 승인 없이 통째로 갈아끼우지 않는다(안 제시 → 승인 → 적용).
- 평가 실행(실제 LLM 다회 호출)을 말없이 돌리지 않는다.
- 템플릿을 그대로 붙이고 "완료"라 하지 않는다 — 대상 도구로 테스트를 통과시키고 브라우저로 확인한 뒤 보고.
