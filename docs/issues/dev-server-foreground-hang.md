---
title: dev 서버가 포그라운드로 떠 "실행 안 됨"처럼 보이고, 파이프 실행은 안 끝남
date: 2026-07-07
type: 실패→해결
status: resolved
stack: WSL Ubuntu, Next.js dev(`npm run dev`), bash
tags: [npm run dev, next dev, 개발서버, setsid, background, disown, fuser, EADDRINUSE, 포트, curl 검증, Exit 143]
---

# dev 서버가 포그라운드로 떠 "실행 안 됨"처럼 보이고, 파이프 실행은 안 끝남

## 언제 참고
- `npm run dev`(next dev, vite 등 **종료되지 않는 장기 실행 서버**)를 띄워 동작을 확인할 때.
- "명령을 실행했는데 프롬프트가 안 돌아온다 / 안 된다"고 느껴질 때.
- 서버 출력을 `| head` 등으로 파이프했더니 명령이 안 끝날 때.

## 무엇을 하려 했나
webui 개발 서버를 띄워 라우트(HTTP 200)와 렌더를 확인.

## 무슨 일이 있었나
- 출력만 보려고 파이프로 실행 → 2분간 안 끝나고 강제 종료됨:
- 사용자가 `npm run dev`를 직접 실행 → 프롬프트가 안 돌아와 "실행이 안돼"로 인식.

```text
$ timeout 45 npm run dev 2>&1 | head -60
Exit code 143
Command timed out after 2m 0s
Terminated
```

## 원인
`npm run dev`(next dev)는 **끝나지 않는 장기 실행 프로세스**다.
- 포그라운드로 돌리면 당연히 프롬프트가 안 돌아온다(고장이 아니라 정상 실행 중).
- `... | head`는 head가 원하는 줄을 받은 뒤에도 서버가 EOF를 안 보내 파이프가 닫히지 않고,
  `timeout`도 파이프라인 자식까지 확실히 죽이지 못해 오래 매달린다(Exit 143 = SIGTERM).

## 해결 (실제로 통한 것)
detached 백그라운드 실행 + 로그 리다이렉트 + curl 헬스체크 + `fuser`로 종료.

```bash
# 실행 (기존 포트 정리 후 detached 실행, 출력은 로그로)
fuser -k 4321/tcp 2>/dev/null; sleep 1
setsid bash -c 'PORT=4321 npm run dev > /tmp/.../scratchpad/dev.log 2>&1' < /dev/null & disown

# 준비 확인 (로그에서 Ready/Local 신호를 폴링)
for i in $(seq 1 30); do grep -qiE "ready|Local:|error|EADDRINUSE" /tmp/.../scratchpad/dev.log && break; sleep 1; done

# 동작 검증
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/route

# 종료
fuser -k 4321/tcp
```

정상일 때 로그: `✓ Ready in 1726ms`, curl → `200`.

## 다음엔 이렇게 (재발 방지 규칙)
- **장기 실행 서버는 포그라운드/`| head`로 돌리지 말 것.** `setsid bash -c '… > dev.log 2>&1' < /dev/null & disown` 로 detached 실행하고, **로그 파일 + curl 헬스체크**로 검증한다.
- "프롬프트가 안 돌아옴 = 고장"이 아니다. 로그의 `Ready`를 먼저 확인한다.
- 포트 재사용 충돌(`EADDRINUSE`)은 `fuser -k <PORT>/tcp` 로 정리한 뒤 재실행.
- foreground `sleep`으로 기다리지 말고 로그 신호를 폴링(위 for 루프).

## 검증 방법
`curl -s -o /dev/null -w "%{http_code}"` 가 200을 반환하고 `dev.log`에 `Ready in …ms` 가 있으면 정상.

## 출처
이 repo webui 작업 세션(2026-07-07). 패턴이 반복돼 스크래치패드 `dev.log`로 표준화함.
