---
title: 로컬 서버형 exe — 브라우저 종료 후 서버 잔존 + 재실행 시 중복 기동
date: 2026-07-07
type: 실패→해결
status: resolved
stack: Python, http.server, PyInstaller onefile exe, 로컬 웹앱(127.0.0.1:8765)
tags: [로컬 서버, 중복 기동, 포트 점유, socket connect_ex, PyInstaller, exe, idle shutdown, 싱글턴]
---

# 로컬 서버형 exe — 브라우저 종료 후 서버 잔존 + 재실행 시 중복 기동

## 언제 참고
로컬에서 HTTP 서버를 띄우고 브라우저로 UI를 여는 데스크톱 앱(PyInstaller exe 등)을 만들 때.
"브라우저 닫아도 서버 프로세스가 계속 떠 있다", "exe 두 번 실행하면 서버가 또 뜬다/포트 충돌" 같은
로컬 서버 라이프사이클 문제.

## 무엇을 하려 했나
`http://127.0.0.1:8765` 로 UI를 제공하는 로컬 앱. exe를 다시 실행해도 **서버를 새로 띄우지 말고**
기존 서버 화면을 열고, 안 쓰면 알아서 종료되게. (사용자 U8·U12·U15)

## 무슨 일이 있었나
브라우저 창을 닫아도 백그라운드 서버가 살아 있었고, exe를 재실행하면 서버를 또 기동하려 해
중복 프로세스/포트 점유 우려가 있었다.

```text
증상 1: 브라우저 종료 → 서버 프로세스 잔존
증상 2: exe 재실행 → 이미 :8765 떠 있는데 새 서버 기동 시도
```

## 원인
로컬 웹앱은 브라우저(뷰)와 서버(프로세스) 수명이 분리돼 있다. 창을 닫아도 서버는 안 죽고,
재실행 시 "이미 떠 있는지"를 확인하지 않으면 중복 기동/포트 충돌이 난다.

## 해결 (실제로 통한 것)
기동 전에 **포트 점유를 `socket.connect_ex` 로 확인**해 이미 떠 있으면 새 서버 대신 브라우저만 열고 종료.
더해서 **idle 감시 스레드**로 일정 시간 무활동이면 서버가 스스로 shutdown.

```python
# app.py:5137-5150 (main)  — 싱글턴 가드
import socket
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    already_running = s.connect_ex((HOST, PORT)) == 0
if already_running:
    print(f"이미 실행 중: http://{HOST}:{PORT}")
    webbrowser.open(f"http://{HOST}:{PORT}/")
    return 0
server = ThreadingHTTPServer((HOST, PORT), Handler)
start_idle_shutdown_watcher(server)          # app.py:5130 근처 — idle 시 server.shutdown()
```

## 다음엔 이렇게 (재발 방지 규칙)
- 로컬 서버 앱은 **기동 전 포트 점유부터 확인**하라: `socket.connect_ex((HOST,PORT))==0` 이면
  이미 떠 있는 것 → 새로 bind 하지 말고 브라우저만 열어라.
- 브라우저 종료 ≠ 서버 종료. 서버를 끝내려면 **idle-timeout 자동 shutdown** 스레드나 명시적
  종료 경로를 반드시 둔다(사용자는 창만 닫는다고 가정).
- 서버 수동 종료가 필요하면: 해당 포트를 잡은 프로세스를 죽인다
  (Windows: `netstat -ano | findstr :8765` → `taskkill /PID <pid> /F`).
- `EADDRINUSE`/bind 실패로 죽지 말고, 그 상황을 "이미 실행 중"으로 우아하게 처리하라.

## 검증 방법
- exe/스크립트를 두 번 실행 → 두 번째는 "이미 실행 중" 출력 후 브라우저만 열리고 종료(exit 0).
- `netstat -ano | findstr :8765` 로 서버 프로세스가 하나만 있는지 확인.
- 앱을 idle로 두면 워처 타임아웃 후 서버가 내려가는지 확인.

## 출처
프로젝트 `조사연구 자동화` / app.py:5130-5151 / 과거 세션 2026-07 이전. 환경: Windows, PyInstaller onefile.
