#!/usr/bin/env bash
# Claude_Manager 동기화 (WSL)
# repo를 최신화(git pull)하고, skills 심링크를 ~/.claude/skills 에 보장한다.
# WSL은 심링크로 설치한다(원본이 바로 반영). settings.json hook 배선은 건드리지 않는다(원칙 1).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$HOME/.claude/skills"

echo "→ git pull ($REPO)"
git -C "$REPO" pull --ff-only

mkdir -p "$DST"
for d in "$REPO"/skills/*/; do
  name="$(basename "$d")"
  ln -sfn "$REPO/skills/$name" "$DST/$name"
  echo "  ✓ skill 심링크: $name"
done

echo "완료. 설치된 skills: $(ls "$DST" | tr '\n' ' ')"
