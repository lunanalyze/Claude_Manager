# 포트 점유 표준 (Port Registry) — 단일 원본

이 문서는 **WSL과 Windows 양쪽에서** 각 프로젝트가 점유하는 포트의 단일 원본이다.
여러 프로젝트를 동시에 띄울 때 충돌하지 않도록, 포트는 여기서 **배정받아** 쓴다.

> ⚠️ **한 환경만 담긴 표는 반쪽이 아니라 틀린 표다.** 이 문서 초판은 WSL만 담았고, 그 결과
> Windows `AI_IB_Agent_CA` 가 쓰던 3020을 MOM_Generator에 배정했다.
> ([작업 규칙](./working-agreement.md) 규칙 4)

## 기본 규칙

1. **새 서비스는 이 표에서 빈 번호를 배정받고, 그 번호를 코드에 명시적으로 박는다.**
   프레임워크 기본값(Next.js 3000, Vite 5173 등)에 의존하지 않는다.
2. 포트는 **실행 스크립트/설정에 하드코딩**한다(`next dev -p 3060`, `server.port: 8110`).
   "필요하면 `PORT=` 로 바꿔 쓰세요"는 배정이 아니다 — 아무도 안 바꾸고 결국 충돌한다.
   **CLI로만 준 값은 배정이 아니다** — 로그에만 남고 재현되지 않는다(아래 3020 사례).
3. 표를 바꿨으면 **해당 repo의 코드도 같이 고친다.** 표와 코드가 어긋나면 **이 표가 기준**이다.
4. 대역(band)을 지켜 배정한다 — 번호만 보고 **어느 환경의 무슨 서비스**인지 알 수 있게.
5. **번호는 환경을 넘어 유일해야 한다.** WSL과 Windows가 같은 번호를 쓰면 안 된다(아래 이유).

## 왜 환경을 넘어 유일해야 하나 — 에러가 안 나기 때문

이 PC는 WSL2 **NAT 모드**다(`.wslconfig` 없음). 그래서 WSL과 Windows는 **네트워크
네임스페이스가 분리**돼 있고, 양쪽이 같은 번호를 잡아도 `EADDRINUSE` 가 **나지 않는다.**

대신 이런 일이 벌어진다:

- Windows가 그 번호를 점유하면, Windows 브라우저의 `localhost:PORT` 는 **Windows 앱으로 간다.**
- WSL 서비스는 죽지도 않고 에러도 없이 **조용히 가려진다.**
- 즉 "다른 프로젝트 화면을 보면서 디버깅"하는 실패 모드가, 같은 환경 안에서보다 **훨씬 발견하기
  어려운 형태로** 일어난다.

> 🔍 **확인 시 함정**: Windows에서 `Get-NetTCPConnection` 으로 보면 WSL 서비스도 `::1` 에
> 잡혀 보인다. 소유 프로세스가 **`wslrelay.exe`** 면 그건 Windows 앱이 아니라 **WSL 서비스가
> 포워딩된 것**이다. 프로세스 이름을 확인하지 않고 충돌로 단정하면 오판한다(실제로 했다).

```bash
# WSL에서 Windows 리스너 확인 (소유 프로세스까지 봐야 한다)
powershell.exe -NoProfile -Command "Get-NetTCPConnection -State Listen |
  Where-Object { \$_.LocalPort -ge 3000 -and \$_.LocalPort -le 9100 } |
  Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort"
```

## 대역 배정

환경별로 대역을 갈라 **번호만 보고 어느 환경인지** 알 수 있게 한다.

| 대역 | 환경 | 용도 |
|---|---|---|
| `3000` | 양쪽 | **영구 공석.** 아무에게도 배정하지 않는다 (아래 "3000을 비우는 이유") |
| `3010–3099` | **WSL** | 프론트엔드 dev 서버 (Next.js / Vite) |
| `3100–3199` | **WSL** | 프론트엔드 — 기존 배정 유지분 |
| `3200–3299` | **Windows** | 프론트엔드 dev 서버 |
| `8100–8199` | **WSL** | 백엔드 API (Spring Boot / FastAPI) |
| `8200–8299` | **Windows** | 백엔드 API (Spring Boot / FastAPI) |
| `8780–8799` | WSL | Cloudflare wrangler 로컬 (`wrangler dev`, `pages dev`) |
| 예약 | — | `5173`(Vite 기본), `1234`(LM Studio), `11434`(Ollama), `5432`/`3306`/`27017`(DB 기본) — 배정 금지 |

---

## 배정표 — WSL (`/home/raspvery/`)

`적용` 열: **적용** = repo 코드가 이 포트로 고정됨 / **미적용** = 표만 정해졌고 코드는 아직 옛 값.

### 프론트엔드

| 포트 | 프로젝트 | 서비스 | 현재 코드 | 적용 | 고정 위치 |
|---|---|---|---|---|---|
| 3010 | Claude_Manager | webui (Next 15) | 3010 | **적용** | `webui/package.json:7,9` |
| 3020 | MOM_Generator | apps/web (Next 14) | 3020 | **적용** | `apps/web/package.json:6,8` |
| 3030 | credit-review-assistant | apps/web (Next 14) | 3030 | **적용** | `apps/web/package.json:6,8` |
| 3040 | JB_Worldcup | Next 14 | 3040 | **적용** | `package.json:6,8` |
| 3050 | literacy | Next 16 | 3050 | **적용** | `package.json:6,8` |
| 3060 | Project_Manager | Next 14 WebUI | 3060 | **적용** | `package.json:6,8` |
| 3070 | Ubob_Recon | WebUI (node:http) | 3070 | **적용** | `src/server.mjs:14` |
| 3100 | AI_Compliance | Next 14 | 3100 | **적용** | `package.json:6,8` |

### 백엔드 API

| 포트 | 프로젝트 | 서비스 | 현재 코드 | 적용 | 고정 위치 |
|---|---|---|---|---|---|
| 8100 | MOM_Generator | Spring Boot (Java 8) | 8100 | **적용** | `apps/api/.../application.yml:8` |
| 8110 | credit-review-assistant | Spring Boot | 8110 | **적용** | `apps/api/.../application.yml:3` |
| 8120 | projects/AI_IB_Agent | FastAPI + uvicorn | 8120 | **적용** | `launcher.py:35` |

### Cloudflare wrangler 로컬

| 포트 | 프로젝트 | 서비스 | 현재 코드 | 적용 |
|---|---|---|---|---|
| 8787 | Ubob_Recon | worker `wrangler dev` | 8787 | **적용** (`worker/wrangler.toml` `[dev]`) |
| 8788 | JB_Worldcup | `wrangler pages dev` | 8788 | **적용** (`package.json:11` `--port`) |

### 리스너 없음

- **JB_Competition_Reviewer** — 정적 HTML 한 개(`review/FinAI_망분리_리뷰.html`). 서버 없음.

---

## 배정표 — Windows (`C:\Users\JBB\Desktop\`)

전부 **미적용(제안)** 이다. 각 프로젝트 repo에서 코드를 고쳐야 확정된다.
`현재 코드` 열이 지금 실제로 박혀 있는 값이다.

### 프론트엔드 (3200–3299)

| 포트 | 프로젝트 | 서비스 | 현재 코드 | 적용 | 고정 위치 |
|---|---|---|---|---|---|
| 3210 | AI_IB_Agent_Converged | apps/web (Next) | **3010** | 미적용(제안) | `apps/web/package.json:6,8`, `dev-web.cmd:5-6` |
| 3220 | AI_IB_Agent_CA | apps/web (Next) | **3010** 고정 / 3020 실기동 | 미적용(제안) | `apps/web/package.json:6,8` |

### 백엔드 API (8200–8299)

| 포트 | 프로젝트 | 서비스 | 현재 코드 | 적용 | 고정 위치 |
|---|---|---|---|---|---|
| 8210 | AI_IB_Agent_Converged | Spring Boot (Java 8) | **8000** | 미적용(제안) | `apps/api/.../application.yml:3` |
| 8220 | AI_IB_Agent_CA | Spring Boot (Java 8) | **8010** | 미적용(제안) | `apps/api/.../application.yml:4` |
| 8230 | AI IB Agent | FastAPI + uvicorn | **8767** | 미적용(제안) | `launcher.py:35` |
| 8240 | 조사연구 자동화 | FastAPI | **8765** | 미적용(제안) | `app.py:38` |
| 8250 | (해외사업팀) 조사연구 자동화 | FastAPI | **8766** | 미적용(제안) | `app.py:38` |

### 배정하지 않음 — 포크·백업·미러

같은 앱의 복제본이라 **원본과 동시에 띄우지 않는다.** 번호를 새로 주면 오히려 동시 실행을
부추기므로 배정하지 않고, 대신 "동시 실행 금지"로 관리한다.

| 디렉터리 | 정체 | 현재 포트 |
|---|---|---|
| `AI IB Agent_Codex`, `부동산PF_Codex`, `승인신청서 초안 생성_Codex` | Codex 브랜치 포크 (6월, 정지) | 8767 |
| `부동산PF 백업` | 이름 그대로 백업 | 8767 |
| `승인신청서 초안 생성_Claude` | `AI IB Agent` 계열 사본 | 8767 |
| `Github/ApprovalApplicationDraftGenerator` | 위의 공개 미러 | 8767 |
| `Github/JBPPCResearchAutomation` | `(해외사업팀) 조사연구 자동화` 공개 미러 | 8766 |

> **8767 을 6개 디렉터리가 공유한다.** 전부 한 앱의 계보라 평소엔 하나만 뜨지만, 두 개를
> 동시에 띄우면 충돌한다. 원본(`AI IB Agent`)만 8230으로 옮기고 나머지는 그대로 둔다.

### 코드 없음 (프로젝트 아님)

`AI Seed Lab`(영상·PDF) · `ddpack`(보고서) · `JB CI`(로고) · `api`(키 메모) · `research`(빈 폴더) ·
`KTX_auto_reservation`(빈 폴더) · `AI IB 샘플` · `논문` · `JB/*`(회의자료 12개 폴더)

---

## 교차 충돌 해소 (이 배정안이 푸는 것)

| 포트 | 충돌 | 해소 |
|---|---|---|
| **3010** | WSL Claude_Manager webui ↔ Windows Converged·CA (둘 다 고정) | WSL이 3010 유지, Converged→**3210**, CA→**3220** |
| **3020** | WSL MOM_Generator ↔ Windows CA 실기동값 | WSL이 3020 유지, CA→**3220** (설정에 박아 재현 가능하게) |
| **3000** | Windows `Claude_Manager` clone의 webui가 미고정 → 3000에 뜸 | **Windows에서는 webui를 실행하지 않는다** (원칙 6 — WebUI는 WSL 전용). `git pull` 하면 `-p 3010` 이 따라오지만, 애초에 띄우지 않는 게 맞다 |
| 8000·8010 | 배정표에 없던 Windows 백엔드 | **8210·8220** 으로 편입 |
| 8765·8766·8767 | 배정표에 없던 Windows FastAPI 계열 | 원본만 **8230·8240·8250**, 포크·미러는 비배정 |

### ⚠️ 백엔드 포트를 바꿀 때 같이 고쳐야 하는 것

Windows 두 프로젝트도 WSL과 같은 구조로 `appConfig.ts` 에 **백엔드 포트 상수**를 둔다.
서버 포트만 바꾸고 이걸 두면 **프론트가 API를 못 찾는다.**

- `AI_IB_Agent_Converged/apps/web/src/lib/appConfig.ts:6,14` — 8000 → 8210
- `AI_IB_Agent_CA/apps/web/src/lib/appConfig.ts:7,15` — 8010 → 8220

### 3020의 출처는 확인 불가

`AI_IB_Agent_CA` 가 실제로 3020에 뜬 근거는 **`ca-web.log:2` 로그 한 줄뿐**이고, 설정·스크립트
어디에도 없다. 즉 손으로 `--port 3020` 을 준 즉석 오버라이드이고 **재현되지 않는다.**
이런 값은 배정이 아니다(기본 규칙 2). 3220으로 파일에 박아야 고정된다.

---

## 3000을 비우는 이유

현재 **Claude_Manager / JB_Worldcup / Project_Manager / credit-review-assistant / literacy** 5개가
3000을 두고 경쟁한다. 이 중 4개는 `next dev` 를 포트 지정 없이 실행해 **프레임워크 기본값에
암묵적으로 의존**한다. 결과:

- 두 번째로 뜬 앱은 `EADDRINUSE` 로 죽거나 **조용히 3001로 밀려난다.**
- 밀려난 걸 모르고 3000에 붙으면 **다른 프로젝트의 화면을 보면서 디버깅**하게 된다. 실제로 가장
  많은 시간을 낭비하는 실패 모드다.

그래서 3000은 **누구에게도 배정하지 않는다.** 포트를 안 박은 앱이 있으면 3000에 떠서
"아, 얘가 아직 배정 안 받았구나"가 바로 드러나게 하는 감지용 공석이다.

**이 감지기는 실제로 작동했다** — Windows `Claude_Manager` clone의 `webui/package.json` 이
아직 미고정이라 3000에 뜨는 것이 이번 조사에서 그대로 드러났다. (WebUI는 WSL 전용이므로
Windows에서는 애초에 띄우지 않는 것이 답이다.)

## 클라이언트로 접속만 하는 포트 (점유 아님)

이 번호들은 우리 프로젝트가 **여는** 게 아니라 **붙는** 대상이다. 배정 대상이 아니지만, 로컬에서
띄울 때 다른 서비스가 선점하지 않도록 기록해둔다.

| 포트 | 대상 | 쓰는 곳 |
|---|---|---|
| 8100 | MOM_Generator API | `apps/web/src/lib/appConfig.ts:6` (`BACKEND_PORT` 상수) |
| 8110 | credit-review-assistant API | `apps/web/src/lib/appConfig.ts:7` (`BACKEND_PORT` 상수) |
| 443 | api.openai.com / api.anthropic.com / api.football-data.org / jbbank.ubob.com | 원격 HTTPS |

> ✅ 두 프로젝트의 `appConfig.ts` 는 이제 **"백엔드 포트가 아니면 dev"** 로 판단한다(프론트 포트를
> 하드코딩해 비교하지 않는다). 따라서 **프론트 dev 포트는 이 표에서 자유롭게 바꿔도 API 연결이
> 안 깨진다.** 반대로 **백엔드 포트(8100/8110)를 바꿀 때는 `BACKEND_PORT` 상수도 반드시 같이 고쳐야 한다.**

## 이 배정안을 적용하는 순서

Windows 쪽 변경은 **각 프로젝트 repo에서** 해야 한다. WSL 세션에서 남의 repo 코드를 임의로
고치지 않는다. 순서는 충돌이 큰 것부터:

1. **`AI_IB_Agent_CA`** — `package.json` 3010→**3220**, `application.yml` 8010→**8220**,
   `appConfig.ts` 상수 8010→8220. (3020 즉석값을 없애는 게 가장 시급하다)
2. **`AI_IB_Agent_Converged`** — `package.json`·`dev-web.cmd` 3010→**3210**,
   `application.yml` 8000→**8210**, `appConfig.ts` 상수 8000→8210.
3. **`AI IB Agent`** — `launcher.py:35` 8767→**8230**.
4. **`조사연구 자동화` / `(해외사업팀)`** — `app.py:38` 8765→**8240**, 8766→**8250**.
5. Windows `Claude_Manager` clone — webui를 **실행하지 않는다**(설정 변경 불필요).

각 단계 후 `적용` 열을 **적용**으로 바꾸고 `현재 코드` 를 갱신한다.

## 정리 대상 (죽은 참조)

- `projects/AI_IB_Agent/.claude/settings.local.json` — `8765`, `8768` 허용 항목이 남아 있으나
  실제 바인딩은 `8120` 뿐. 이력상 8765→8766→8767→8768 로 떠돌았던 잔재. (미정리)
- `Project_Manager/README.md:13` — `PORT=3111` 예시. **이제 동작하지 않는다** — `-p` 플래그가
  `PORT` 환경변수를 이긴다. 아래 "PORT 환경변수는 더 이상 안 먹는다" 참조. (미정리)
- `Claude_Manager/docs/issues/*.md` — `4321` 은 헤드리스 검증용 임시 관례이지 앱의 고정 포트가 아니다.
  검증 스크립트 전용으로 계속 쓸 거면 **4321을 "검증 전용"으로 예약**하고 배정표에서 빼둔다.

## 바인딩 주소 주의

- `next dev` 는 `-H` 없이 실행하면 **`0.0.0.0`(전 인터페이스)** 에 바인딩된다. WSL에서는 Windows
  호스트 및 동일 네트워크에서 접근 가능해진다.
- 로컬 전용 도구는 `-H 127.0.0.1` 을 붙인다. 현재 `credit-review-assistant`(Spring `address: 127.0.0.1`)
  와 `AI_IB_Agent`(`launcher.py:34`) 만 루프백에 제대로 묶여 있다.
- `Project_Manager/README.md:85` 의 "localhost 바인딩을 전제" 서술은 **사실과 다르다** — 실제로는
  `*:3060` 에 뜬다. (미정리)

## PORT 환경변수는 더 이상 안 먹는다

배정은 전부 `next dev -p <포트>` / `wrangler --port` 로 **CLI 플래그에 박았다.** Next.js는
`-p` 플래그가 `PORT` 환경변수보다 우선하므로, `PORT=9999 npm run dev` 는 **무시된다.**
일시적으로 다른 포트에 띄우려면 플래그를 직접 주거나(`npm run dev -- -p 9999`) 스크립트를 고친다.

예외: **Ubob_Recon** 은 `process.env.PORT || 3070` 이라 `PORT` 가 계속 동작한다.

Windows 쪽은 `.cmd` 실행 스크립트(`dev-web.cmd`, `dev-api.cmd`, `run-app.cmd`)와
`application.yml` / `launcher.py` 에 박는다. Windows에서 프로세스·포트를 확인·정리할 때:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3210
Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Select ProcessId,CommandLine
Stop-Process -Force -Id <pid>
```

---

> 이 문서는 Claude_Manager의 공유 표준이며, 각 환경 CLAUDE.md가 import해 모든 프로젝트가 참조한다.
