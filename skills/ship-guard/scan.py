#!/usr/bin/env python3
"""ship-guard/scan.py — 커밋·푸시·배포 전 위험물 스캔 (표준 라이브러리만, jq 불필요)

  scan.py                 # staged: 커밋 직전 (기본)
  scan.py --mode worktree # 아직 커밋 안 한 변경 + untracked 전부
  scan.py --mode tracked  # HEAD에 추적 중인 파일 전체 (공개 직전 점검)
  scan.py --repo PATH --mode staged

종료 코드: 0 = 통과 / 1 = BLOCK 있음 / 2 = 실행 오류
REVIEW 항목은 종료 코드를 올리지 않는다(사람이 판단할 몫).

오탐 억제:
  - 줄 끝에 `# ship-guard: allow` 가 있으면 그 줄은 건너뛴다.
  - `*.example*`, `docs/issues/`, `docs/references/`, 이 스킬 자신은 기본 제외
    (문서와 스캐너 본체는 예시 문자열을 일부러 담고 있다 — 자기 자신을 잡는 사고 방지).
"""

import argparse
import os
import re
import subprocess
import sys

# ─────────────────────────────────────────────────────────── 패턴

# (이름, 정규식, 심각도, 설명)
SECRET_PATTERNS = [
    ("openai-key",     r"\bsk-[A-Za-z0-9_-]{20,}",                    "BLOCK", "OpenAI API 키"),
    ("anthropic-key",  r"\bsk-ant-[A-Za-z0-9_-]{20,}",                "BLOCK", "Anthropic API 키"),
    ("github-token",   r"\b(ghp|gho|ghu|ghs)_[A-Za-z0-9]{30,}",       "BLOCK", "GitHub 토큰"),
    ("github-pat",     r"\bgithub_pat_[A-Za-z0-9_]{50,}",             "BLOCK", "GitHub fine-grained PAT"),
    ("slack-token",    r"\bxox[baprs]-[A-Za-z0-9-]{10,}",             "BLOCK", "Slack 토큰"),
    ("aws-key",        r"\bAKIA[0-9A-Z]{16}\b",                       "BLOCK", "AWS 액세스 키"),
    ("google-key",     r"\bAIza[0-9A-Za-z_-]{30,}",                   "BLOCK", "Google API 키"),
    ("private-key",    r"-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----", "BLOCK", "개인키"),
    ("url-credential", r"https?://[^/\s:@]+:[^/\s@]+@",               "BLOCK", "URL에 박힌 인증정보"),
    # 대입문 형태 — 값이 플레이스홀더면 통과
    ("assigned-secret",
     r"(?i)\b(api[_-]?key|secret|token|passwd|password|비밀번호)\b\s*[:=]\s*[\"']([^\"']{8,})[\"']",
     "BLOCK", "코드에 하드코딩된 비밀값"),
    ("cf-token",       r"\bCLOUDFLARE_API_TOKEN\s*[:=]\s*[\"']?[A-Za-z0-9_-]{30,}", "BLOCK", "Cloudflare 토큰"),
]

# 값이 이런 모양이면 진짜 비밀이 아니다
PLACEHOLDER = re.compile(
    r"(?i)^(your|my|the)?[_-]?(api|key|secret|token|pass\w*|xxx+|todo|change[_-]?me|"
    r"placeholder|example|sample|dummy|<[^>]*>|\$\{[^}]*\}|\*+|\.\.\.|없음|여기에)",
)

PII_PATTERNS = [
    ("rrn",       r"\b\d{6}\s*-\s*[1-4]\d{6}\b",                  "BLOCK",  "주민등록번호"),
    # phone 이 account 보다 먼저여야 한다 — 전화번호가 계좌 패턴에도 걸리므로 중복 억제 순서가 중요
    ("phone",     r"\b01[016-9][-\s]?\d{3,4}[-\s]?\d{4}\b",       "REVIEW", "휴대전화번호"),
    ("account",   r"\b\d{3,6}-\d{2,6}-\d{4,8}\b",                 "REVIEW", "계좌번호로 보이는 숫자"),
    ("resident",  r"\b[가-힣]{2,4}\s*(부장|차장|과장|대리|팀장|상무|전무|이사|대표|행장|본부장)\b",
                  "REVIEW", "실명+직위로 보이는 문자열"),
    ("email",     r"\b[A-Za-z0-9._%+-]+@(?!example\.|test\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
                  "REVIEW", "이메일 주소"),
]

# 추적되면 안 되는 파일
FORBIDDEN_TRACKED = [
    (r"(^|/)api_keys?[^/]*\.txt$",       "BLOCK",  "API 키 파일"),
    (r"(^|/)\.env(\.|$)(?!.*example)",   "BLOCK",  ".env 파일"),
    (r"\.(pem|key|p12|pfx|jks)$",        "BLOCK",  "인증서/키 파일"),
    (r"(^|/)id_(rsa|ed25519)$",          "BLOCK",  "SSH 개인키"),
    (r"\.(sqlite3?|db)$",                "REVIEW", "로컬 DB 파일"),
    (r"\.(exe|msi|dmg|zip|7z)$",         "REVIEW", "배포 바이너리"),
]

SKIP_PATH = re.compile(
    r"(^|/)(node_modules|\.next|\.venv|venv|dist|build|out|__pycache__|\.git)/"
    r"|\.example|\.lock$|(^|/)package-lock\.json$"
    r"|(^|/)docs/(issues|references)/"
    r"|(^|/)skills/ship-guard/"          # 스캐너 자신은 제외 (자기 매칭 방지)
)

BINARY_EXT = re.compile(r"\.(png|jpg|jpeg|gif|ico|svg|pdf|woff2?|ttf|zip|exe|jar|class|so|dll)$", re.I)

LARGE_FILE_BYTES = 5 * 1024 * 1024
ALLOW_MARK = "ship-guard: allow"


# ─────────────────────────────────────────────────────────── 유틸

def git(repo, *args, check=True):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if check and r.returncode != 0 and r.stderr.strip():
        pass  # 호출부가 판단
    return r


class Finding:
    def __init__(self, sev, kind, path, line, desc, snippet=""):
        self.sev, self.kind, self.path, self.line = sev, kind, path, line
        self.desc, self.snippet = desc, snippet


def redact(s, max_len=90):
    s = s.strip()
    if len(s) > max_len:
        s = s[:max_len] + "…"
    # 긴 토큰처럼 보이는 부분은 가린다 (로그에 비밀을 다시 흘리지 않기 위해)
    return re.sub(r"[A-Za-z0-9_\-]{24,}", lambda m: m.group(0)[:6] + "…[가림]", s)


def scan_text(path, text, findings):
    for i, line in enumerate(text.splitlines(), 1):
        if ALLOW_MARK in line:
            continue
        if len(line) > 2000:      # 압축/번들 한 줄 — 스캔 무의미
            continue
        hit_kinds = set()
        for kind, pat, sev, desc in SECRET_PATTERNS:
            m = re.search(pat, line)
            if not m:
                continue
            if kind == "assigned-secret":
                val = m.group(2)
                if PLACEHOLDER.match(val) or len(set(val)) <= 3:
                    continue
            hit_kinds.add(kind)
            findings.append(Finding(sev, kind, path, i, desc, redact(line)))
        for kind, pat, sev, desc in PII_PATTERNS:
            # URL에 박힌 인증정보를 이미 잡았으면 그 줄의 'user@host' 를 이메일로 또 세지 않는다
            if kind == "email" and "url-credential" in hit_kinds:
                continue
            # 휴대전화번호는 계좌번호 패턴에도 걸린다 — 한 줄에 둘 다 세지 않는다
            if kind == "account" and "phone" in hit_kinds:
                continue
            if re.search(pat, line):
                hit_kinds.add(kind)
                findings.append(Finding(sev, kind, path, i, desc, redact(line)))


def check_paths(paths, findings):
    for p in paths:
        for pat, sev, desc in FORBIDDEN_TRACKED:
            if re.search(pat, p):
                findings.append(Finding(sev, "tracked-file", p, 0, f"{desc} — 저장소에 추적되고 있다"))


def check_git_config(repo, findings):
    cfg = os.path.join(repo, ".git", "config")
    if not os.path.exists(cfg):
        return
    with open(cfg, encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f, 1):
            if re.search(r"https?://[^/\s:@]+:[^/\s@]+@", line):
                findings.append(Finding("BLOCK", "git-config-token", ".git/config", i,
                                        "remote URL에 토큰/비밀번호가 남아 있다", redact(line)))


def check_large(repo, paths, findings):
    for p in paths:
        full = os.path.join(repo, p)
        try:
            sz = os.path.getsize(full)
        except OSError:
            continue
        if sz > LARGE_FILE_BYTES:
            findings.append(Finding("REVIEW", "large-file", p, 0,
                                    f"큰 파일 ({sz / 1024 / 1024:.1f} MB) — 정말 저장소에 넣을 것인가"))


def read_file(repo, path):
    if BINARY_EXT.search(path):
        return None
    full = os.path.join(repo, path)
    try:
        if os.path.getsize(full) > 2 * 1024 * 1024:
            return None
        with open(full, encoding="utf-8", errors="replace") as f:
            return f.read()
    except (OSError, UnicodeError):
        return None


# ─────────────────────────────────────────────────────────── 모드

def added_lines_from_diff(diff):
    """git diff -U0 출력에서 (파일, 줄번호, 내용) 추가분만 뽑는다."""
    path, lineno = None, 0
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            path, lineno = line[6:], 0
        elif line.startswith("@@"):
            m = re.search(r"\+(\d+)", line)
            lineno = int(m.group(1)) if m else 0
        elif line.startswith("+") and not line.startswith("+++"):
            if path:
                yield path, lineno, line[1:]
            lineno += 1


def collect(repo, mode):
    """(스캔할 (path, text) 목록, 경로 목록) 반환"""
    if mode == "staged":
        paths = [p for p in git(repo, "diff", "--cached", "--name-only").stdout.split("\n") if p]
        diff = git(repo, "diff", "--cached", "-U0").stdout
        chunks = {}
        for p, n, content in added_lines_from_diff(diff):
            chunks.setdefault(p, []).append((n, content))
        return chunks, paths

    if mode == "worktree":
        paths = [p for p in git(repo, "diff", "HEAD", "--name-only").stdout.split("\n") if p]
        paths += [p for p in git(repo, "ls-files", "--others", "--exclude-standard").stdout.split("\n") if p]
        return None, paths

    # tracked
    paths = [p for p in git(repo, "ls-files").stdout.split("\n") if p]
    return None, paths


def main():
    ap = argparse.ArgumentParser(description="커밋·푸시·배포 전 위험물 스캔")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--mode", choices=["staged", "worktree", "tracked"], default="staged")
    args = ap.parse_args()

    repo = os.path.abspath(args.repo)
    if git(repo, "rev-parse", "--git-dir").returncode != 0:
        print(f"ERROR: git 저장소가 아니다: {repo}", file=sys.stderr)
        return 2

    chunks, paths = collect(repo, args.mode)
    paths = [p for p in paths if not SKIP_PATH.search(p)]

    findings = []
    check_paths(paths, findings)
    check_git_config(repo, findings)
    check_large(repo, paths, findings)

    if chunks is not None:                       # staged — 추가된 줄만
        for p, lines in chunks.items():
            if SKIP_PATH.search(p) or BINARY_EXT.search(p):
                continue
            for n, content in lines:
                sub = []
                scan_text(p, content, sub)
                for f in sub:
                    f.line = n
                findings.extend(sub)
    else:                                        # worktree / tracked — 파일 전체
        for p in paths:
            if BINARY_EXT.search(p):
                continue
            text = read_file(repo, p)
            if text is not None:
                scan_text(p, text, findings)

    # ── 출력
    blocks = [f for f in findings if f.sev == "BLOCK"]
    reviews = [f for f in findings if f.sev == "REVIEW"]

    label = {"staged": "커밋 예정분(staged)", "worktree": "미커밋 변경 + untracked", "tracked": "추적 중인 전체 파일"}
    print(f"ship-guard scan — {label[args.mode]} · 대상 {len(paths)}개 파일\n")

    if not findings:
        print("깨끗하다. BLOCK 0 · REVIEW 0")
        return 0

    for title, group in (("BLOCK — 이대로 올리면 안 된다", blocks),
                         ("REVIEW — 사람이 판단할 것", reviews)):
        if not group:
            continue
        print(f"■ {title}  ({len(group)}건)")
        for f in group:
            loc = f"{f.path}:{f.line}" if f.line else f.path
            print(f"  · [{f.kind}] {loc}")
            print(f"      {f.desc}")
            if f.snippet:
                print(f"      > {f.snippet}")
        print()

    print(f"합계: BLOCK {len(blocks)} · REVIEW {len(reviews)}")
    if blocks:
        print("\nBLOCK 이 남아 있으면 커밋·푸시·배포를 진행하지 않는다.")
        print("이미 커밋된 비밀이면 파일만 지우는 것으로 부족하다 — 히스토리에 남는다(SKILL.md 참고).")
    return 1 if blocks else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(2)
