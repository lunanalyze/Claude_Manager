#!/usr/bin/env python3
"""transcript_to_md — Claude Code 세션 transcript(JSONL)를 사람이 읽기 쉬운 markdown으로 변환.

설계: Claude_Manager/CLAUDE.md 의 "핵심 설계 원칙" 참고.
- 환경 중립(표준 라이브러리만, jq 불필요) — WSL/Windows 양쪽이 같은 파서를 호출.
- user/assistant 본문만 추리고 메타 라인(mode, permission-mode, file-history-snapshot,
  ai-title, last-prompt, system, attachment)은 스킵.
- tool 호출은 "도구명 + 한 줄 요약", thinking은 <details>로 접음.

사용법:
  transcript_to_md.py <transcript.jsonl> [--out DIR]
  transcript_to_md.py --latest [--cwd DIR] [--out DIR]
  transcript_to_md.py --session <id> [--out DIR]
"""
import argparse
import json
import os
import sys
from pathlib import Path

PROJECTS_DIR = Path.home() / ".claude" / "projects"
# 본문이 아닌 메타 라인 타입 — 스킵
META_TYPES = {
    "system", "attachment", "mode", "permission-mode",
    "file-history-snapshot", "ai-title", "last-prompt", "custom-title",
}
MAX_TOOL_SUMMARY = 200   # tool 입력 한 줄 요약 최대 길이
MAX_RESULT_INLINE = 800  # tool 결과 인라인 표시 최대 길이(넘으면 details로 접음)

# 도구별로 한 줄 요약에 쓸 대표 필드
TOOL_SUMMARY_FIELDS = {
    "Bash": "command", "Read": "file_path", "Write": "file_path",
    "Edit": "file_path", "NotebookEdit": "notebook_path",
    "Grep": "pattern", "Glob": "pattern", "WebFetch": "url",
    "WebSearch": "query", "Task": "description", "Agent": "description",
}


def slugify_cwd(cwd: str) -> str:
    """cwd 경로를 ~/.claude/projects 의 폴더 slug로 변환 (영숫자 외 → '-')."""
    return "".join(c if c.isalnum() else "-" for c in cwd)


def resolve_input(args) -> Path:
    """인자로부터 대상 transcript JSONL 경로를 결정."""
    if args.transcript:
        p = Path(args.transcript).expanduser()
        if not p.is_file():
            sys.exit(f"transcript 파일을 찾을 수 없음: {p}")
        return p
    if args.session:
        hits = list(PROJECTS_DIR.glob(f"*/{args.session}.jsonl"))
        if not hits:
            sys.exit(f"세션 id에 해당하는 transcript 없음: {args.session}")
        return hits[0]
    # --latest (기본): 현재 cwd 프로젝트의 가장 최근 jsonl
    cwd = args.cwd or os.getcwd()
    proj = PROJECTS_DIR / slugify_cwd(cwd)
    if not proj.is_dir():
        sys.exit(f"이 cwd에 대한 프로젝트 transcript 폴더 없음: {proj}")
    files = sorted(proj.glob("*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not files:
        sys.exit(f"transcript jsonl 없음: {proj}")
    return files[0]


def load_lines(path: Path):
    out = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def text_of(content) -> str:
    """content(str 또는 블록 리스트)에서 사람이 읽을 텍스트만 추출."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text":
                parts.append(b.get("text", ""))
        return "\n".join(parts).strip()
    return ""


def tool_summary(tool_input: dict) -> str:
    """tool 입력을 한 줄로 요약."""
    if not isinstance(tool_input, dict):
        s = str(tool_input)
    else:
        s = json.dumps(tool_input, ensure_ascii=False)
    s = " ".join(s.split())
    if len(s) > MAX_TOOL_SUMMARY:
        s = s[:MAX_TOOL_SUMMARY] + "…"
    return s


def result_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict):
                parts.append(b.get("text", "") if b.get("type") == "text" else "")
            else:
                parts.append(str(b))
        return "\n".join(p for p in parts if p)
    return str(content)


def render(lines) -> tuple[str, dict]:
    """라인들을 markdown 문자열 + 메타(dict)로 렌더."""
    meta = {"session_id": None, "title": None, "cwd": None,
            "first_ts": None, "last_ts": None, "users": 0, "assistants": 0}
    body = []

    for o in lines:
        t = o.get("type")
        meta["session_id"] = meta["session_id"] or o.get("sessionId")
        meta["cwd"] = meta["cwd"] or o.get("cwd")
        ts = o.get("timestamp")
        if ts:
            meta["first_ts"] = meta["first_ts"] or ts
            meta["last_ts"] = ts
        if t == "ai-title":
            meta["title"] = o.get("aiTitle") or meta["title"]
            continue
        if t in META_TYPES:
            continue

        msg = o.get("message", {})
        content = msg.get("content")

        if t == "user":
            # tool_result 블록은 도구 결과, text/str 은 사람 발화
            if isinstance(content, list) and any(
                isinstance(b, dict) and b.get("type") == "tool_result" for b in content
            ):
                for b in content:
                    if isinstance(b, dict) and b.get("type") == "tool_result":
                        rt = result_text(b.get("content", "")).rstrip()
                        if not rt:
                            continue
                        if len(rt) > MAX_RESULT_INLINE:
                            body.append(
                                "> 🧪 **도구 결과**\n>\n"
                                "<details><summary>출력 보기</summary>\n\n```\n"
                                + rt[:4000] + ("\n…(생략)…" if len(rt) > 4000 else "")
                                + "\n```\n\n</details>\n"
                            )
                        else:
                            body.append("> 🧪 **도구 결과**\n>\n```\n" + rt + "\n```\n")
                continue
            txt = text_of(content)
            if txt:
                meta["users"] += 1
                body.append(f"## 🧑 사용자\n\n{txt}\n")

        elif t == "assistant":
            if not isinstance(content, list):
                continue
            chunks = []
            for b in content:
                if not isinstance(b, dict):
                    continue
                bt = b.get("type")
                if bt == "text":
                    txt = b.get("text", "").strip()
                    if txt:
                        chunks.append(txt)
                elif bt == "thinking":
                    th = b.get("thinking", "").strip()
                    if th:
                        chunks.append(
                            "<details><summary>💭 thinking</summary>\n\n"
                            + th + "\n\n</details>"
                        )
                elif bt == "tool_use":
                    name = b.get("name", "?")
                    field = TOOL_SUMMARY_FIELDS.get(name)
                    inp = b.get("input", {})
                    if field and isinstance(inp, dict) and field in inp:
                        summ = tool_summary({field: inp[field]})
                    else:
                        summ = tool_summary(inp)
                    chunks.append(f"🔧 **{name}** — `{summ}`")
            if chunks:
                meta["assistants"] += 1
                body.append("## 🤖 Claude\n\n" + "\n\n".join(chunks) + "\n")

    return "\n".join(body), meta


def build_header(meta) -> str:
    date = (meta["first_ts"] or "")[:10] or "unknown-date"
    h = [f"# 세션 transcript — {meta['title'] or '(제목 없음)'}", ""]
    h.append(f"- **세션 id**: `{meta['session_id']}`")
    h.append(f"- **일시**: {meta['first_ts'] or '?'} → {meta['last_ts'] or '?'}")
    h.append(f"- **cwd**: `{meta['cwd'] or '?'}`")
    h.append(f"- **턴 수**: 사용자 {meta['users']} · Claude {meta['assistants']}")
    h.append("")
    h.append("---")
    h.append("")
    h.append("")
    return "\n".join(h), date


def main():
    ap = argparse.ArgumentParser(description="Claude Code transcript → 읽기 쉬운 markdown")
    ap.add_argument("transcript", nargs="?", help="transcript JSONL 경로")
    ap.add_argument("--latest", action="store_true", help="현재 cwd 프로젝트의 최신 세션")
    ap.add_argument("--cwd", help="--latest 기준 cwd (기본: 현재 디렉터리)")
    ap.add_argument("--session", help="세션 id로 검색")
    # 기본 출력: 이 스크립트(심링크 해제) 기준 repo의 local/transcripts
    default_out = Path(os.path.realpath(__file__)).parents[2] / "local" / "transcripts"
    ap.add_argument("--out", default=str(default_out), help="출력 디렉터리")
    args = ap.parse_args()

    src = resolve_input(args)
    lines = load_lines(src)
    if not lines:
        sys.exit(f"빈 transcript: {src}")

    body, meta = render(lines)
    header, date = build_header(meta)

    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    sid = meta["session_id"] or src.stem
    out_path = out_dir / f"{date}_{sid}.md"
    out_path.write_text(header + body + "\n", encoding="utf-8")

    print(f"✅ 변환 완료\n  입력: {src}\n  출력: {out_path}\n"
          f"  턴: 사용자 {meta['users']} · Claude {meta['assistants']}")


if __name__ == "__main__":
    main()
