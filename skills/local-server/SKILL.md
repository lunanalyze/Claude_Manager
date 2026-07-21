---
name: local-server
description: 로컬 개발 서버를 안전하게 띄우고·확인하고·정리한다. 포트 배정표(ports.md) 확인 → detached 기동 → 로그 리다이렉트 → curl 헬스체크 → 정리까지. "서버 띄워줘", "실행해서 확인해줘", "dev 서버 켜", "포트 뭐 쓰지", "서버 안 뜨는데", "왜 접속이 안 돼", "서버 정리해줘", "/local-server" 에 사용. Next.js·Spring Boot·FastAPI·node 스크립트 모두 해당.
---

# local-server

로컬 서버를 띄워 동작을 확인하는 일은 이 환경에서 **가장 자주 반복되고, 가장 많이 삽질한** 작업이다.
같은 함정을 프로젝트마다 처음부터 다시 밟지 않도록 절차와 지식을 여기 모았다.

동봉된 `devserver.sh` 가 기동·상태·종료를 담당한다(WSL/bash 전용, `jq` 불필요).

## 언제 쓰나

- "서버 띄워줘", "실행해서 확인해줘", "이 화면 동작하나 봐줘"
- 서버를 띄운 상태에서 검증이 필요한 모든 작업
- "안 뜬다 / 접속이 안 된다 / 포트가 이미 쓰인다"는 증상

---

## 절대 규칙 4가지

### 1. 포트는 배정표에서 받는다
기동 전 **반드시** `docs/standards/ports.md` 를 확인한다. 프레임워크 기본값(Next 3000, Vite 5173)에
의존하지 않는다. **3000번은 영구 공석**이다 — 거기 떠 있으면 그 앱이 포트를 아직 안 박았다는 신호다.

표에 없는 새 서비스면 빈 번호를 배정하고 **표와 코드를 같이 고친다.**

### 2. 사용자의 서버를 말없이 죽이지 않는다
사용자가 띄워 둔 서버가 있을 수 있다. 점검하려고 남의 것을 내리지 않는다.
점검이 필요하면 **다른 포트에 따로 띄운다**(예: 3010 사용 중 → 점검용 3011).
정말 죽여야 하면 **먼저 묻는다**([작업 규칙](../../docs/standards/working-agreement.md) 규칙 3).

### 3. 포그라운드로 띄우지 않는다
`npm run dev` 는 **끝나지 않는 프로세스**다. 포그라운드로 돌리면 프롬프트가 안 돌아온다
(고장이 아니라 정상). 파이프(`| head`)로 묶으면 EOF가 안 와서 영영 안 끝난다(Exit 143).
→ **항상 detached + 로그 파일 + curl 헬스체크.**

### 4. "떴다"는 curl로 증명한다
프로세스가 살아 있는 것과 요청이 처리되는 것은 다르다. **HTTP 상태 코드를 받아야** 뜬 것이다.

---

## 표준 절차

```bash
S=/home/raspvery/Claude_Manager/skills/local-server/devserver.sh

# 0) 포트 주인 확인 — 남이 쓰고 있으면 죽이지 말고 다른 번호로
"$S" status 3010

# 1) 기동 (detached + 로그)
"$S" start 3010 /home/raspvery/Claude_Manager/webui "npm run dev -- -p 3010"

# 2) 헬스체크 — 200이 나올 때까지 폴링, 실패 시 로그 꼬리를 보여줌
"$S" health 3010 /

# 3) 확인 작업 …

# 4) 정리 (내가 띄운 것만)
"$S" stop 3010
```

`start` 는 로그를 `local/logs/<port>.log` 에 남기고 **새 세션 리더 PID(=PGID)** 를 기록한다.
`stop` 은 그 그룹만 죽이고, 그래도 포트가 남아 있으면 `fuser` 로 회수한다.
**기록이 없는 포트는 죽이지 않는다** — 사용자 서버일 수 있으므로 경고만 하고 멈춘다.

---

## 함정 모음 (전부 실제로 밟은 것)

### `pkill -f` 가 자기 자신을 죽인다 ★
`pkill -f "next-server"` 는 **자기 명령줄에도 매칭**되어 실행 중인 셸을 죽인다.
두 프로젝트가 독립적으로 이 버그를 밟았다(JB_Worldcup, MOM_Generator).

```bash
pkill -f "next-server"      # ✗ 자기도 죽음
pkill -f "next-serve[r]"    # ✓ 대괄호로 자기 매칭 회피
pkill -f "bootRun"          # ✗
pkill -f "boot[R]un"        # ✓
```
→ 애초에 `devserver.sh stop` 을 쓰면 PID로 죽이므로 이 문제가 없다.

### `setsid … & echo $!` 는 엉뚱한 PID를 잡는다 ★
`setsid` 는 호출한 프로세스가 **이미 프로세스 그룹 리더면 fork** 한다. 그래서 부모가 받은 `$!` 는
곧 사라지는 껍데기이고, 실제 세션 리더(=PGID)는 **다른 PID**다. 이 PID로 그룹 kill 을 하면
빗나가서 `npm → next → next-server` 자손이 **살아남는다**(이 스킬을 만들며 실제로 밟았다).

```bash
setsid bash -c "$cmd" & echo $! > pid            # ✗ 껍데기 PID
setsid bash -c "echo \$\$ > pid; exec $cmd" &    # ✓ 자식이 자기 PID를 기록 + exec 로 셸 대체
```

### WSL에서 `127.0.0.1` 로는 안 붙는다
WSL2 릴레이가 `[::1]`(IPv6)에만 바인딩되는 경우가 있다. 프론트가 `127.0.0.1` 을 하드코딩하면
**조용히 실패**한다(MOM_Generator의 "전문을 읽지 못했습니다" 원인).
→ 검증은 `localhost` 로, 안 되면 `[::1]` 과 `127.0.0.1` 을 **둘 다** 시도한다.
→ Windows 브라우저에서 여는지 확인하려면 Windows쪽 `curl.exe` 로 쏴 본다.

### `npm run start` 가 옛 빌드를 서빙한다
소스를 고치고 `npm run start` 하면 **이전 빌드가 그대로 뜬다.** 반드시 `npm run build` 를 먼저.
반대로 dev 서버가 떠 있는 상태에서 `npm run build` 를 돌리면 `.next` 가 깨진다.
→ **dev와 build를 동시에 돌리지 않는다.**

### 로그의 에러가 이미 지나간 것일 수 있다
편집 중 일시적으로 깨진 파일 때문에 남은 에러가 로그에 남아 있으면, 고친 뒤에도
"아직 에러"로 오판하게 된다(AI_Compliance에서 4라운드 낭비).
→ 판단 전에 **파일을 `touch` 해 재컴파일을 유발**하고, 그 이후 타임스탬프의 로그만 본다.
→ `devserver.sh health` 는 헬스체크 시작 시각 이후의 로그만 보여준다.

### curl HTML에 없다고 "렌더 실패"가 아니다
- **recharts/차트**: `ResponsiveContainer` 는 브라우저 하이드레이션 후에 그려진다.
  SSR HTML엔 `<svg>` 가 **없는 게 정상**이다. → 라우트 200 + 컨테이너·제목 마커만 확인하고,
  시각 확인은 브라우저/스크린샷으로.
- **React SSR 텍스트**: 인접 표현식 경계에 `<!-- -->` 가 끼어 문자열이 쪼개진다.
  `커버리지 66 / 66` 은 원본 HTML에 연속으로 존재하지 않는다. → grep 전에 주석 마커를 제거.

```bash
curl -s "$URL" | python3 -c "import sys,re;print(re.sub(r'<!--.*?-->','',sys.stdin.read()))" | grep -o "찾을문구"
```

### 포트가 안 죽는다 / 죽은 PID가 물고 있다
`fuser -k 3010/tcp` 로 정리한다. WSL 릴레이가 죽은 PID를 물고 있는 경우가 있어
`ss -ltnp | grep 3010` 으로 실제 주인을 먼저 본다.

### 기타
- **`jq` 없음** — JSON 파싱은 `python3 -c "import json…"`. `jq` 쓰면 exit 127.
- **`.env` 필요** — wrangler 등은 비대화형 셸에서 토큰을 못 읽는다. `set -a && . ./.env` 로 주입.

---

## Windows 환경

이 스킬의 `devserver.sh` 는 **WSL 전용**이다. Windows 네이티브에서는 목적은 같되 도구가 다르다
(Claude_Manager 원칙 3 — 같은 목적, 환경별 배선).

| 목적 | WSL | Windows |
|---|---|---|
| 포트 주인 확인 | `ss -ltnp` | `Get-NetTCPConnection -State Listen -LocalPort <p>` |
| 프로세스 확인 | `pgrep -af` | `Get-CimInstance Win32_Process -Filter "Name='java.exe'"` (CommandLine 필터) |
| detached 기동 | `setsid … &` | `Start-Process cmd.exe "/c gradlew.bat …"` |
| 종료 | `fuser -k <p>/tcp` | `Stop-Process -Force -Id <pid>` |

Windows에서 한글이 깨지면 python 호출 앞에 `PYTHONIOENCODING=utf-8` 을 붙인다.
경로에 공백이 있으면(`AI IB Agent`) 반드시 인용한다.

---

## 관련 문서

- [포트 점유 표준](../../docs/standards/ports.md) — 배정표 (기동 전 필독)
- [작업 규칙](../../docs/standards/working-agreement.md) — 규칙 3(되돌릴 수 없는 일)
- [이슈 로그](../../docs/issues/) — `dev-server-foreground-hang`, `recharts-ssr-curl-empty`,
  `nextjs-ssr-html-grep-comment-nodes`, `wsl-jq-missing`
