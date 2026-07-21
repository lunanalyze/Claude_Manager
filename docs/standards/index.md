# 공유 표준 (Shared Standards) — 단일 원본

이 파일은 Claude_Manager가 관리하는 **공유 표준의 진입점**이다. 각 환경(WSL/Windows)의
CLAUDE.md는 이 파일을 `@import`로 참조만 한다(원본 복제 금지 — Claude_Manager/CLAUDE.md 원칙 5).

## 표준 항목

- [작업 규칙](./working-agreement.md) — Claude 행동 표준 (범위 준수·추측 금지·되돌릴 수 없는 일)
- [기술 스택 표준](./tech-stack.md) — Front: Next.js/React, Back: Java 8 + Spring Boot
- [UI 표준](./ui/index.md) — Tailwind + shadcn/ui 기반 (토큰·컴포넌트 규칙)
- [포트 점유 표준](./ports.md) — 프로젝트별 포트 배정표 (서버 띄우기 전 반드시 확인)

아래 `@import`로 핵심 표준을 항상 컨텍스트에 싣는다. (양식별 세부 문서는 UI 인덱스에서 링크로
연결되며, 해당 UI 작업 시 그 문서를 열어 참고한다.)

@./working-agreement.md
@./tech-stack.md
@./ui/index.md
@./ports.md

## 참고자료

- 참고 문서(UI 참고자료 등)는 [`../references/`](../references/README.md) 에 둔다.
