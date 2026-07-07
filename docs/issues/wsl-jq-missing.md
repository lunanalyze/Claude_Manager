---
title: WSL에 jq 미설치 — command not found (exit 127), JSON은 python3로 파싱
date: 2026-07-07
type: 실패→해결
status: resolved
stack: WSL Ubuntu, bash, jq(미설치), python3
tags: [wsl, jq, command not found, exit 127, json 파싱, python3, node]
---

# WSL에 jq 미설치 — command not found (exit 127), JSON은 python3로 파싱

## 언제 참고
- WSL에서 셸로 **JSON을 파싱**하려 할 때(API 응답, `selections.json`, 설정 파일 등).
- `jq`를 쓰는 명령이 `command not found` 로 실패할 때.

## 무엇을 하려 했나
`curl … | jq …` 처럼 셸에서 JSON 필드를 뽑아 확인.

## 무슨 일이 있었나
```text
/bin/bash: line 1: jq: command not found     # exit 127
```

## 원인
이 WSL 환경엔 **jq가 설치돼 있지 않다.** (Claude_Manager 프로젝트 전제 — `CLAUDE.md`:
"WSL에 `jq` 미설치. 파서·스크립트는 Python3(또는 Node)로 작성한다.")

## 해결 (실제로 통한 것)
JSON 파싱은 `python3 -c`(또는 node)로 대체.

```bash
curl -s http://localhost:4321/api/ui-standard \
 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['confirmed'],'/',d['total'])"
```

## 다음엔 이렇게 (재발 방지 규칙)
- **WSL에서 jq를 쓰지 말 것.** JSON은 `python3 -c "import json…"` 또는 node로 파싱한다.
- 새 스크립트/파서도 처음부터 python3(또는 node)로 작성한다(설치 의존 최소화).
- 굳이 jq가 필요하면 먼저 `command -v jq` 로 존재를 확인하고 폴백을 준비한다.

## 검증 방법
`python3 -c` 한 줄이 기대한 필드 값을 출력하면 정상. (`command -v jq` 는 이 환경에서 빈 결과.)

## 출처
이 repo 여러 검증 명령에서 반복 확인(2026-07-07). `CLAUDE.md` 환경 전제와 동일 — 검색 편의를 위해 이슈로도 기록.
