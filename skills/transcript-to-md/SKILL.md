---
name: transcript-to-md
description: 현재(또는 지정한) Claude Code 세션 transcript를 사람이 읽기 쉬운 markdown으로 변환해 Claude_Manager/local/transcripts/ 에 저장한다. 세션 기록을 보기 좋게 남기거나 WebUI로 렌더링할 자료를 만들 때 사용.
---

# transcript-to-md

Claude Code 세션 transcript(JSONL)를 사람이 읽기 쉬운 markdown으로 변환한다.
변환 로직은 함께 있는 `transcript_to_md.py`(표준 라이브러리만 사용, `jq` 불필요)가 담당한다.

## 언제 쓰나
- 사용자가 "이 세션 기록을 md로 저장/정리", "transcript 변환", "/transcript-to-md" 등을 요청할 때.

## 실행 방법

이 skill 디렉터리의 파서를 Python3로 실행한다. 인자에 따라 대상이 달라진다.

- **현재 세션(기본)** — 지금 작업 중인 프로젝트의 최신 transcript:
  ```bash
  python3 "<이 skill 폴더>/transcript_to_md.py" --latest --cwd "$(pwd)"
  ```
- **특정 세션 id**:
  ```bash
  python3 "<이 skill 폴더>/transcript_to_md.py" --session <session-id>
  ```
- **명시한 파일 경로**:
  ```bash
  python3 "<이 skill 폴더>/transcript_to_md.py" /path/to/<session>.jsonl
  ```

`<이 skill 폴더>`는 이 SKILL.md가 있는 디렉터리다. 출력 디렉터리는 기본적으로
`Claude_Manager/local/transcripts/`(repo의 local, git 미포함)이며, `--out <DIR>`로 바꿀 수 있다.

## 동작
- transcript의 `user`/`assistant` 본문만 추려 markdown으로 렌더한다.
- tool 호출은 "🔧 도구명 + 한 줄 요약", tool 결과는 코드블록(길면 `<details>`로 접음).
- `thinking` 블록은 `<details>`로 접는다.
- 메타 라인(mode, permission-mode, file-history-snapshot, ai-title, last-prompt 등)은 스킵한다.
- 출력 파일명: `<YYYY-MM-DD>_<session-id>.md` (날짜는 transcript 첫 timestamp 기준).

## 사용자에게 보고
실행 후 파서가 출력한 입력/출력 경로와 턴 수를 그대로 사용자에게 전달한다.

## 설계 메모
- 이 skill의 단일 원본은 `Claude_Manager/skills/transcript-to-md/` 이며, 각 환경의
  `~/.claude/skills/` 에는 심링크/복사로 설치한다 (Claude_Manager/CLAUDE.md 원칙 2·3 참조).
