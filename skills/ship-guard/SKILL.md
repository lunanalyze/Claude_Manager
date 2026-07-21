---
name: ship-guard
description: 커밋·푸시·배포 직전 게이트. 빌드 통과 확인 → 시크릿·개인정보·대용량 파일 스캔 → 그다음에야 커밋한다. 배포와 푸시는 별도 승인을 받는다. "커밋해줘", "푸시해줘", "배포해줘", "배포하고 커밋&푸시", "공개해도 되나", "올려도 돼?", "/ship-guard" 에 사용. 저장소를 처음 공개하기 전 점검에도 사용.
---

# ship-guard

커밋·푸시·배포 직전에 **되돌리기 어려운 사고**를 막는 게이트다.
동봉된 `scan.py`(표준 라이브러리만, `jq` 불필요)가 위험물 탐지를 담당한다.

이 스킬이 막으려는 사고는 전부 실제로 났던 것들이다:

- 공개 라우트에 계정이 하드코딩된 채 배포 시도 → 차단 (Ubob_Recon)
- 실제 임원 실명이 커밋됨 → 히스토리 재작성 + 강제 푸시로 수습 (MOM_Generator)
- 토큰을 URL에 넣어 푸시한 뒤 `.git/config` 에 잔재 (literacy)
- **"확인만 해달라"고 했는데 배포까지 진행** (JB_Worldcup, 2회)

---

## 절대 규칙 3가지

### 1. 커밋과 배포는 다른 일이다
사용자가 "확인해줘"라고 했으면 **확인만** 한다. "커밋해줘"는 커밋까지다.
**푸시·배포는 매번 따로 승인받는다.** 지난번에 승인했다고 이번에도 승인된 게 아니다.
([작업 규칙](../../docs/standards/working-agreement.md) 규칙 3)

### 2. BLOCK이 남으면 진행하지 않는다
`scan.py` 가 BLOCK을 뱉으면 커밋·푸시·배포를 멈추고 사용자에게 보고한다.
스스로 "이건 괜찮겠지" 판단하지 않는다.

### 3. 이미 커밋된 비밀은 파일을 지워도 남는다
새 커밋으로 삭제해도 **히스토리에 그대로 있다.** 아래 "이미 커밋된 경우" 절차를 따른다.
그리고 무엇보다, **노출된 키는 폐기·재발급이 우선**이다. 히스토리 정리는 그다음이다.

---

## 표준 절차

```bash
G=/home/raspvery/Claude_Manager/skills/ship-guard/scan.py

# 1) 빌드 게이트 — 깨진 걸 커밋하지 않는다 (프로젝트 타입에 맞게)
npx tsc --noEmit && npm run build      # Next.js / TypeScript
./gradlew compileJava                  # Spring Boot (Java 8)
python3 -m compileall -q src           # Python

# 2) 스캔 — 커밋 예정분
git add -A
python3 "$G" --mode staged

# 3) BLOCK 0 이면 커밋
git commit -m "..."

# 4) 푸시·배포는 여기서 멈추고 사용자에게 승인 요청
```

저장소를 **처음 공개하기 전**에는 staged 가 아니라 전체를 본다:

```bash
python3 "$G" --mode tracked      # HEAD에 추적 중인 모든 파일
```

| 모드 | 대상 | 언제 |
|---|---|---|
| `staged` (기본) | 커밋 예정분의 **추가된 줄만** | 매 커밋 전 |
| `worktree` | 미커밋 변경 + untracked 전부 | 커밋 범위를 정하기 전 |
| `tracked` | HEAD의 추적 파일 전체 | 공개 전 · 정기 점검 |

---

## 무엇을 잡나

**BLOCK** — 올리면 안 되는 것
API 키(OpenAI/Anthropic/Google/AWS/GitHub/Slack), 개인키, URL에 박힌 인증정보,
코드에 하드코딩된 비밀번호·토큰, `.env`·`api_keys*.txt`·인증서 파일 추적,
`.git/config` 의 토큰 잔재, 주민등록번호.

**REVIEW** — 사람이 판단할 것
실명+직위(`김철수 부장`), 계좌번호·전화번호·이메일, 로컬 DB(`*.sqlite3`),
배포 바이너리(`*.exe`), 5MB 초과 파일.

REVIEW는 종료 코드를 올리지 않는다. 다만 **회의록·심사자료를 다루는 프로젝트에서는
REVIEW가 진짜 사고 지점**이다(MOM_Generator의 임원 실명이 정확히 이 범주였다).
그냥 넘기지 말고 사용자에게 보여준다.

### 오탐을 줄이는 장치
- 값이 플레이스홀더(`your-api-key`, `<TOKEN>`, `${ENV}`, `changeme`)면 잡지 않는다.
- `*.example*`, `docs/issues/`, `docs/references/`, `node_modules`, 락파일은 제외.
- **스캐너 자신(`skills/ship-guard/`)도 제외** — 패턴 목록이 자기를 잡는 사고 방지.
- 줄 끝에 `# ship-guard: allow` 를 붙이면 그 줄은 건너뛴다. 남용하지 말 것.
- 발견된 비밀은 출력할 때 가린다(`sk-pro…[가림]`) — 로그에 다시 흘리지 않기 위해.

---

## 이미 커밋된 경우

```bash
# 1) 언제 들어왔는지 — 문자열이 등장/사라진 커밋을 찾는다
git log -S "찾을문자열" --oneline --all

# 2) 아직 히스토리에 살아 있는지
git grep -n "찾을문자열" $(git rev-list --all) | head
```

그다음:

1. **키·비밀번호라면 즉시 폐기하고 재발급한다.** 히스토리를 지워도 이미 노출된 것은 노출된 것이다.
2. 히스토리 정리는 `git filter-repo`(권장) 또는 `filter-branch` — **강제 푸시가 필요하므로
   반드시 사용자 승인을 받는다.** 협업자가 있으면 재클론이 필요하다는 점도 알린다.
3. 원격이 있으면 정리 후 재스캔한다.

`.git/config` 에 `https://user:token@…` 형태가 남았으면 remote URL을 토큰 없는 주소로 되돌린다.

```bash
git remote set-url origin https://gitea.com/<owner>/<repo>.git
```

---

## 배포 전 추가 확인

- **포트·환경**: 로컬 검증은 [`local-server`](../local-server/SKILL.md) 로. 배포 대상 환경과
  로컬이 다른 점(호스트 바인딩, 환경변수)을 먼저 확인한다.
- **호스팅 가정을 검증한다**: "이 서비스가 정적 호스팅을 지원한다"를 확인 없이 믿지 않는다.
  gitea.com에 Pages가 있다고 가정해 `basePath` 까지 바꿔 빌드했다가 전부 되돌린 적이 있다(literacy).
  → 배포 전에 **문서 확인 또는 최소 요청 1회**로 실재를 확인한다.
- **비대화형 셸의 토큰**: `wrangler` 등은 토큰을 못 읽어 실패한다. `set -a && . ./.env` 로 주입하되,
  그 `.env` 가 추적되고 있지 않은지 스캔으로 확인한다.

---

## 관련 문서

- [작업 규칙](../../docs/standards/working-agreement.md) — 규칙 3(되돌릴 수 없는 일은 먼저 묻는다)
- [local-server](../local-server/SKILL.md) — 배포 전 로컬 검증
- [이슈 로그](../../docs/issues/) — `wsl-jq-missing` 외
