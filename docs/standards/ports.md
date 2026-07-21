# 포트 점유 표준 (Port Registry) — 단일 원본

이 문서는 **로컬(WSL) 개발 환경에서 각 프로젝트가 점유하는 포트의 단일 원본**이다.
여러 프로젝트를 동시에 띄울 때 충돌하지 않도록, 포트는 여기서 **배정받아** 쓴다.

## 기본 규칙

1. **새 서비스는 이 표에서 빈 번호를 배정받고, 그 번호를 코드에 명시적으로 박는다.**
   프레임워크 기본값(Next.js 3000, Vite 5173 등)에 의존하지 않는다.
2. 포트는 **실행 스크립트/설정에 하드코딩**한다(`next dev -p 3060`, `server.port: 8110`).
   "필요하면 `PORT=` 로 바꿔 쓰세요"는 배정이 아니다 — 아무도 안 바꾸고 결국 충돌한다.
3. 표를 바꿨으면 **해당 repo의 코드도 같이 고친다.** 표와 코드가 어긋나면 **이 표가 기준**이다.
4. 대역(band)을 지켜 배정한다 — 번호만 보고 무슨 서비스인지 알 수 있게.

## 대역 배정

| 대역 | 용도 |
|---|---|
| `3000` | **영구 공석.** 아무에게도 배정하지 않는다 (아래 "3000을 비우는 이유") |
| `3010–3099` | 프론트엔드 dev 서버 (Next.js / Vite) |
| `3100–3199` | 프론트엔드 — 기존 배정 유지분 |
| `8100–8199` | 백엔드 API (Spring Boot / FastAPI) |
| `8780–8799` | Cloudflare wrangler 로컬 (`wrangler dev`, `pages dev`) |
| 예약 | `5173`(Vite 기본), `1234`(LM Studio), `11434`(Ollama), `5432`/`3306`/`27017`(DB 기본) — 배정 금지 |

---

## 배정표

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

## 3000을 비우는 이유

현재 **Claude_Manager / JB_Worldcup / Project_Manager / credit-review-assistant / literacy** 5개가
3000을 두고 경쟁한다. 이 중 4개는 `next dev` 를 포트 지정 없이 실행해 **프레임워크 기본값에
암묵적으로 의존**한다. 결과:

- 두 번째로 뜬 앱은 `EADDRINUSE` 로 죽거나 **조용히 3001로 밀려난다.**
- 밀려난 걸 모르고 3000에 붙으면 **다른 프로젝트의 화면을 보면서 디버깅**하게 된다. 실제로 가장
  많은 시간을 낭비하는 실패 모드다.

그래서 3000은 **누구에게도 배정하지 않는다.** 포트를 안 박은 앱이 있으면 3000에 떠서
"아, 얘가 아직 배정 안 받았구나"가 바로 드러나게 하는 감지용 공석이다.

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

---

> 이 문서는 Claude_Manager의 공유 표준이며, 각 환경 CLAUDE.md가 import해 모든 프로젝트가 참조한다.
