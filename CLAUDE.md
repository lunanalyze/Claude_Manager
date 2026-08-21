# Claude_Manager

Claude 설정·표준·세션 로그를 한곳에 모으는 **관리 허브**. WSL Ubuntu와 Windows 네이티브 Claude Code를 둘 다 상시 사용하는 환경에서, **콘텐츠(문서)는 공유하고 실행 배선은 환경별로 분리**한다.

> 이 문서는 이 프로젝트에서 작업하는 Claude를 위한 운영 지침이다. 아래 "핵심 설계 원칙"과 "구축 순서"는 사용자가 확정한 결정사항이며 임의로 바꾸지 않는다.

---

## 목적

- CLAUDE.md에 다는 참고 문서/표준을 단일 원본으로 보관
- **skill로 세션 transcript를 사람이 읽기 쉬운 markdown으로 변환·저장** (hook 자동 배선이 아니라, 사용자가 원할 때 명시적으로 실행)
- 문서/로그를 WebUI(Next.js)로 한눈에 뷰잉
- 추후 Project_Manager(프로젝트별 개요·기능 문서)를 레이어로 얹음

## 환경 전제

- **WSL Ubuntu**와 **Windows 네이티브 Claude Code**를 둘 다 상시 사용한다.
- **Windows 담당**: PowerPoint COM 자동화, 서버 띄워 실제 산출물(Word 등) 열어보기, 기타 Windows 필요 작업.
- **WSL 담당**: Next.js 기반 WebUI, 유닉스 결이 맞는 작업.
- 두 환경의 `.claude` 폴더는 **서로 별개 개체**(경로·실행환경 다름)다. WSL은 `~/.claude`, Windows는 `/mnt/c/Users/JBB/.claude`(WSL에서 본 경로).
- WSL에 **`jq` 미설치**. 파서·스크립트는 **Python3**(또는 Node v20)로 작성한다.

## 핵심 설계 원칙 (반드시 지킬 것)

1. 공유 대상은 **'콘텐츠(마크다운 문서/표준)'뿐**이다. `settings.json`의 hook 배선(실행 명령·경로)은 환경별로 분리하며 **절대 공유하지 않는다**.
2. 문서 **단일 원본(single source of truth)은 git 저장소**로 관리한다. WSL과 Windows가 각각 clone해서 자기 네이티브 파일시스템에서 읽는다. (심링크/UNC 직접 공유 대신 **git 동기화**)
3. hook은 양쪽에 같은 **'목적'**으로 두되, 각자 자기 환경 문법으로 자기 환경 스크립트를 호출한다. (WSL=bash/python, Windows=대응 명령) 공통 파싱 로직은 환경 중립 코어로 한 번만 작성해 양쪽이 호출한다.
4. transcript 등 **생성 로그는 git 동기화에 포함하지 않는다.** 각 환경 로컬에 쌓고, WebUI가 양쪽 로그를 각각 읽어 보여준다.
5. 각 환경의 CLAUDE.md는 공유 문서 원본을 **import/참조만** 한다.
6. WebUI(Next.js)는 **WSL 한 곳에서만** 돌리고, **읽기 전용 대시보드**로 양쪽 문서·로그를 뷰잉한다. Project_Manager 문서는 나중에 소스로 추가해 레이어링한다.

## 구축 순서 (이 순서를 반드시 지킨다)

1. **[완료] WSL 한쪽에서 `transcript → 사람이 읽기 쉬운 markdown` 변환 skill**을 먼저 완성한다. (hook 아님 — 명시적 실행) → `skills/transcript-to-md/`, `~/.claude/skills/`에 심링크 설치.
2. **[완료] Claude_Manager를 git repo**로 만들어 문서 단일 원본을 확립하고, WSL의 CLAUDE.md가 그 문서를 import하게 한다. → 전역 `~/.claude/CLAUDE.md`가 `docs/standards/index.md`를 `@import`.
3. **[완료] Next.js WebUI**로 문서/로그를 렌더링한다. → `webui/` (읽기 전용, WSL 전용). 실행: `cd webui && npm run dev`. `docs/`·`local/transcripts/`를 직접 읽음. 이번 버전은 WSL 로그만.
4. **Windows 쪽을 clone**하고, skill·문서를 쌍둥이로 정렬한다. WebUI에 Windows 로그(`/mnt/c/Users/JBB/.claude` 변환분) 소스를 추가한다.
   - **[완료] clone**: `C:\Users\JBB\Claude_Manager`. 원격은 GitHub `lunanalyze/Claude_Manager`(private)로, 양쪽 clone이 같은 origin을 공유한다.
   - **[완료] skill·agent 정렬** (2026-08-21): 양쪽 `~/.claude/skills/` 가 동일한 8개 집합
     (`issue-log`·`transcript-to-md`·`reference-doc`·`project-map`·`local-server`·`ship-guard`·`hwp-report`·`hwp-template-extractor`)
     + `~/.claude/agents/hwp-doc-reviewer.md`. WSL은 심링크, Windows는 복사(DrvFs).
     환경 제약이 있는 스킬은 **`description` 에 박아** 세션이 잘못 고르지 않게 했다(hwp 계열 = Windows 전용).
   - **[완료] 문서 정렬**: Windows 로컬에만 있던 `docs/issues` 6건·`docs/references` 4건을 repo로 편입.
   - **[다음] WebUI Windows 로그 소스**: 미착수. ⚠️ Windows `projects/` 슬러그는 한글 폴더명이
     전부 하이픈으로 뭉개져(`C--Users-JBB-Desktop---------` 5건) 슬러그만으로 프로젝트를 구분할 수 없다.
     JSONL 라인의 `cwd` 필드를 읽어 실제 경로를 복원해야 한다.
5. **Project_Manager**를 얹는다.

> **트리거 결정**: transcript 변환은 `SessionEnd` hook 자동 배선 대신 **skill**(사용자 명시 실행)로 한다. 이유 — 환경별 settings.json 배선 분리가 불필요해지고, fire-and-forget hook의 디버깅 난점을 피하며, 원할 때만 변환할 수 있다. (hook 스펙은 아래에 참고용으로만 남김.)

---

## 참고: Claude Code hook 스펙 (검증됨 v2.1.191 — 현재 transcript 변환엔 미사용)

- `SessionStart` / `SessionEnd` 이벤트 모두 존재. 향후 다른 목적(예: 세션 시작 시 컨텍스트 주입)에 쓸 수 있어 참고로만 남김.
- **SessionEnd**: 종료 시 fire-and-forget. stdin JSON: `session_id`, `transcript_path`, `cwd`, `reason`(`clear`/`resume`/`logout`/`prompt_input_exit`/`other`). 출력으로 세션 차단 불가.
- 배선 위치: 각 환경 `~/.claude/settings.json` (repo 미공유, 원칙 1).

## transcript JSONL 실제 포맷 (직접 검증 — skill 파서의 입력)

- 위치: `~/.claude/projects/<slug>/<session-id>.jsonl` (기본 30일 보관).
- 라인 `type`: `user`, `assistant`, `system`, `attachment`, `mode`, `permission-mode`, `file-history-snapshot`, `ai-title`, `last-prompt`.
- `assistant`: `message.content`는 블록 리스트 — `thinking` / `text` / `tool_use`.
- `user`: `message.content`는 **문자열 또는** 블록 리스트(`tool_result` 포함).
- → 파서는 `user`/`assistant` 본문만 markdown으로 추리고, 나머지 메타 타입은 스킵한다.

---

## 폴더 구조 (제안 — 합의 후 생성)

```
Claude_Manager/
├─ CLAUDE.md                  # 이 문서 (프로젝트 운영 지침)
├─ README.md
├─ .gitignore                 # local/, node_modules, 환경 비밀 제외
│
├─ docs/                      # ★ 공유 콘텐츠 = single source of truth (git 추적)
│  ├─ standards/              #   표준 문서 (CLAUDE.md가 import)
│  └─ references/             #   참고자료 (UI 참고 등)
│
├─ skills/                    # ★ 공유 콘텐츠 = skill 소스 (git 추적)
│  └─ transcript-to-md/       #   1단계 skill
│     ├─ SKILL.md             #     Claude에게 주는 변환 지침
│     └─ transcript_to_md.py  #     JSONL → 읽기 쉬운 markdown 파서 (환경 중립)
│
├─ webui/                     # (3단계) Next.js, WSL에서만 실행, 읽기 전용
│
└─ local/                     # ★ git 미포함 (환경 로컬 생성물)
   └─ transcripts/            #   변환된 markdown 로그가 쌓이는 곳
```

- skill은 repo가 단일 원본이고, 각 환경 `~/.claude/skills/`에 심링크/복사로 설치한다(원칙 2·5).
- WebUI는 WSL `local/`과 Windows `/mnt/c/.../local/`을 각각 읽어 양쪽 로그를 렌더링한다(원칙 4·6).
