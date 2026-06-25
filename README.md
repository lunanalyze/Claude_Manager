# Claude_Manager

Claude 설정·표준·세션 로그를 한곳에 모으는 **관리 허브**. WSL Ubuntu와 Windows 네이티브
Claude Code를 둘 다 사용하는 환경에서, **콘텐츠(문서)는 git으로 공유하고 실행 배선은
환경별로 분리**한다.

운영 지침·설계 원칙·구축 순서는 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 구성

| 경로 | 역할 | git |
|------|------|-----|
| `docs/standards/` | 공유 표준 (CLAUDE.md가 import) | ✅ |
| `docs/references/` | 참고자료 (UI 참고 등) | ✅ |
| `skills/transcript-to-md/` | 세션 transcript → 읽기 쉬운 md 변환 skill | ✅ |
| `webui/` | (예정) Next.js 읽기 전용 대시보드 | ✅ |
| `local/` | 변환된 transcript 등 환경 로컬 생성물 | ❌ |

## skill 설치 (환경별)

repo가 단일 원본이고, 각 환경의 `~/.claude/skills/`에 심링크로 설치한다.

```bash
# WSL
ln -sfn "$(pwd)/skills/transcript-to-md" ~/.claude/skills/transcript-to-md
```

## 사용 — transcript 변환

```bash
# 현재 프로젝트의 최신 세션을 읽기 쉬운 md로 (local/transcripts/ 에 저장)
python3 ~/.claude/skills/transcript-to-md/transcript_to_md.py --latest --cwd "$(pwd)"
```
