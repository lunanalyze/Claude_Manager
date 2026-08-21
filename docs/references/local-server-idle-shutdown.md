# 로컬 데스크톱 앱: 단일 인스턴스 + 유휴 자동 종료 (127.0.0.1 HTTP 서버)

> 참고(reference) 문서 · 강제 표준 아님. "이런 요구를 이렇게 풀었고, 이렇게 검증한다"는 재사용 사례.

- **프로젝트**: 조사연구 도우미 (ResearchReportAutomation) / `app.py`
- **스택/버전**: Python 3.10+ 표준 라이브러리(`http.server.ThreadingHTTPServer`, `threading`,
  `socket`, `webbrowser`). 프레임워크 없음.
- **관련 파일**: `app.py:5137-5155`(main·싱글톤), `app.py:5105-5134`(활동추적·유휴감시), `app.py:70-82`(STATE), `app.py:37-40`(HOST/PORT/타임아웃)
- **작성일**: 2026-07-07
- **키워드**: 로컬 서버, 단일 인스턴스, singleton, connect_ex, 유휴 종료, idle shutdown, ThreadingHTTPServer, daemon thread, 127.0.0.1:8765, webbrowser.open, 데스크톱 앱 서버

## 언제 참고
- 브라우저 UI를 쓰는 **로컬 데스크톱 앱을 로컬 HTTP 서버**로 구현하고, 두 번 실행 시 새 서버 대신
  **기존 창을 재사용**하게 하고 싶을 때.
- 사용자가 창을 닫아도 서버 프로세스가 유령으로 남는 걸 막아 **일정 시간 유휴면 자동 종료**시키고
  싶을 때(단, 진행 중 작업은 죽이지 않게).

## 문제 / 목표
설치형 앱을 `.exe`로 빌드해 로컬 서버 + 브라우저 UI로 띄운다. 두 가지가 필요:
1. **싱글톤**: 바로가기를 또 눌러도 포트 충돌/중복 서버 없이 이미 뜬 창만 다시 연다.
2. **유휴 종료**: 사용자가 브라우저 탭만 닫으면 서버 프로세스가 계속 살아 포트를 점유한다. 일정 시간
   요청이 없으면 스스로 종료하되, **수집/보고서 생성 같은 장기 작업 중에는 종료하면 안 된다**.

## 접근 방식 (핵심 아이디어)
- 싱글톤: 서버 띄우기 전에 `socket.connect_ex((HOST, PORT))`로 **포트가 이미 열렸는지 프로브**.
  열려 있으면(이미 실행 중) 새 서버 안 띄우고 `webbrowser.open`으로 기존 창만 열고 종료.
- 유휴 종료: 모든 요청 핸들러가 `touch_server_activity()`로 `last_activity` 타임스탬프 갱신.
  **데몬 스레드**가 주기적으로 유휴 시간을 재고, 임계 초과 & **활성 작업 없음**이면 `server.shutdown()`.
- 활성 작업 판정은 `STATE`의 job id들로(`server_has_active_jobs`) → 장기 작업 중이면 종료 유예.

## 핵심 코드

```python
# app.py:37 — 상수. 15분 유휴, 15초마다 체크
HOST = "127.0.0.1"
PORT = 8765
SERVER_IDLE_TIMEOUT_SECONDS = 15 * 60
SERVER_IDLE_CHECK_SECONDS = 15
```

```python
# app.py:5137 — main: 포트 프로브로 싱글톤. 이미 뜨면 창만 열고 return 0
def main() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        already_running = s.connect_ex((HOST, PORT)) == 0     # 0 == 연결 성공 == 서버 이미 존재
    if already_running:
        print(f"이미 실행 중: http://{HOST}:{PORT}")
        webbrowser.open(f"http://{HOST}:{PORT}/")
        return 0
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    start_idle_shutdown_watcher(server)
    if os.environ.get("RRA_NO_BROWSER") != "1":               # 테스트/CI에선 브라우저 억제
        threading.Timer(0.8, lambda: webbrowser.open(f"http://{HOST}:{PORT}/")).start()
    server.serve_forever()
    return 0
```

```python
# app.py:5105 — 활동 추적 + 활성작업 판정 + 유휴 감시(데몬 스레드)
def touch_server_activity() -> None:
    with STATE_LOCK:
        STATE["last_activity"] = time.time()

def server_has_active_jobs() -> bool:
    with STATE_LOCK:
        return bool(STATE.get("active_collect_job_id")
            or STATE.get("active_generate_job_id")
            or STATE.get("pending_run_dir"))

def start_idle_shutdown_watcher(server: ThreadingHTTPServer) -> None:
    def watch() -> None:
        while True:
            time.sleep(SERVER_IDLE_CHECK_SECONDS)
            with STATE_LOCK:
                idle_for = time.time() - float(STATE.get("last_activity") or time.time())
            if idle_for < SERVER_IDLE_TIMEOUT_SECONDS:
                continue
            if server_has_active_jobs():
                touch_server_activity()                       # 작업 중이면 타이머 리셋(종료 유예)
                continue
            print(f"[app] idle for {int(idle_for)}s; shutting down server")
            server.shutdown()
            return
    threading.Thread(target=watch, daemon=True).start()       # daemon: 메인 종료 시 자동 회수
```

비자명한 점:
- `connect_ex`는 예외 대신 **에러코드**를 반환(0=성공). `connect`는 실패 시 예외라 try/except가
  필요하지만 `connect_ex`는 분기만으로 깔끔.
- 활성 작업이면 `server.shutdown()` 대신 `touch_server_activity()`로 **타이머를 리셋** → 장기 작업이
  15분 넘어도 종료 안 됨.
- 감시 스레드는 `daemon=True` → 서버가 죽으면 프로세스와 함께 사라짐(join 불필요).

## 동작 원리 / 흐름
- 요청 핸들러(`Handler`)가 진입마다 `touch_server_activity()` 호출 → 사용자가 UI를 만지는 한
  `last_activity`가 갱신돼 종료 안 됨.
- 15초마다 감시: 유휴<15분이면 계속, 유휴≥15분이면 활성 작업 확인 → 있으면 유예, 없으면
  `server.shutdown()`(`serve_forever` 루프를 깨움) 후 스레드 종료.
- 재실행: 두 번째 프로세스는 포트 프로브에서 `already_running`을 만나 서버를 안 띄우고 창만 연 뒤
  즉시 `return 0` → 단일 서버 보장.

> 관련 실패 사례(포트 점유·좀비 프로세스로 인한 싱글톤 오작동)는 issues의
> `local-server-exe-singleton-port.md` 참고. 이 문서는 "정상 동작 패턴", 그쪽은 "겪은 함정".

## 검증 방법 (How to verify)

```bash
cd "C:\Users\JBB\Desktop\조사연구 자동화"
# 1) 싱글톤: 첫 실행은 서버 뜸, 두 번째 실행은 "이미 실행 중" 출력 후 즉시 종료
set RRA_NO_BROWSER=1
start /b python app.py            # 백그라운드로 서버 기동
timeout /t 2 >nul
python app.py                     # 두 번째 실행
# 기대(2번째): "이미 실행 중: http://127.0.0.1:8765" 출력 후 exit 0 (새 서버 안 뜸)
```

```bash
# 2) 유휴 판정 로직만 단위 확인 (네트워크/서버 불필요)
python -c "import app, time; \
app.STATE['last_activity']=time.time()-10; print('active?', app.server_has_active_jobs()); \
app.STATE['active_collect_job_id']='job1'; print('active after set?', app.server_has_active_jobs())"
# 기대:
#   active? False
#   active after set? True     ← job id 세팅되면 종료 유예 대상
```

- 정상 신호: 2번째 `python app.py`가 새 포트를 열지 않고 "이미 실행 중" 후 종료. 유휴 15분 무요청
  시 서버 로그에 `idle for ...s; shutting down server`.
- 흔한 오판: 유휴 종료가 안 뜬다면 (a) `SERVER_IDLE_TIMEOUT_SECONDS`가 커서 아직, (b) 어떤 핸들러가
  주기적으로 `touch_server_activity`를 부르는 백그라운드 폴링이 있어 계속 리셋되는 경우. 활성 작업
  플래그가 안 꺼지고 남아있어도 종료 안 됨(작업 종료 시 job id 비우는지 확인).

## 결정과 함정 (왜 이렇게 했나)
- **포트 프로브 싱글톤(연결 성공=존재)**: 파일락/뮤텍스보다 간단하고, "서버가 실제로 응답 가능한가"를
  직접 확인. 좀비 프로세스가 포트만 잡고 있으면 오탐 가능(→ issues 문서의 함정).
- **활성 작업 유예**: 유휴만 보면 장기 수집 중 종료돼 데이터 유실. job id/pending으로 "일하는 중"을
  판정해 유예.
- **데몬 스레드 + 폴링**: 이벤트 기반 대신 15초 폴링 — 단순하고 누락 없음. 정밀 타이밍이 필요 없어 충분.
- **함정 — 127.0.0.1 고정**: 외부 노출 없음(의도). 다른 기기 접근이 필요하면 바인딩 주소를 바꾸되
  로컬앱 보안 전제가 깨짐.
- **함정 — 종료 시 in-flight 요청**: `server.shutdown()`은 `serve_forever` 루프만 멈춤. 진행 중
  요청과의 경합을 활성작업 판정으로 최소화하지만, 원자적이진 않음.

## 다른 프로젝트에 재사용하려면 (체크리스트)
- [ ] 모든 요청 핸들러 진입점에서 `touch_server_activity()` 호출 배선(하나라도 빠지면 그 화면만 쓰다
      유휴 종료될 수 있음).
- [ ] `server_has_active_jobs()`가 참조하는 상태 키를 프로젝트의 장기작업 플래그로 교체.
- [ ] `HOST/PORT/IDLE_*` 상수 조정. 테스트용 브라우저 억제 env(`RRA_NO_BROWSER`) 유지 권장.
- [ ] 위 검증 1)·2)로 싱글톤·유휴 판정 확인.

## 출처
- `app.py:5137-5155`, `app.py:5105-5134`, `app.py:70-82`, `app.py:37-40`. 원본이 바뀔 수 있으니
  재현 전 현재 코드와 대조. 관련 실패 사례: `docs/issues/local-server-exe-singleton-port.md`.
