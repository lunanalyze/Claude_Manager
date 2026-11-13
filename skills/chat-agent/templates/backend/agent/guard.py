"""숫자 가드 — 답의 숫자가 도구 결과(또는 사용자 발화)에서 나왔는지 대조한다.

정책: 막거나 다시 쓰지 않는다. 확인 안 된 숫자 뒤에 ⚠ 를 붙이고 목록을 남긴다.
(검열형 가드는 오탐이 잦아 폐기됨 — 재생성·표 대체 없음. '원인' 서술 가드도 오탐뿐이라 제거.)

허용(오탐 방지, 전부 실제 사고에서 나온 규칙)
- 소수 ↔ 백분율: 0.50 ↔ 50%, 40% ↔ 0.4  (가정표 0.50 을 답에서 50% 로 씀)
- 억 ↔ 조 환산, 1억 이상 원 단위 수는 억·조로 바꿔 비교
- 부호 반전(−3.2%p ↔ 3.2 하락)
- 날짜: 2026.09 / 26.09 / 2026-09 / 2026년 9월 / 단독 연도 → 대조하지 않음
- 쉼표 없는 작은 정수(기본 ≤31: 순번·개월·일자)는 대조하지 않음
- 코드 블록·인라인 코드 안 숫자는 제외(산식 계수가 오탐을 냄)
- 한글 조사: "802.8의" — \\b 는 한글 앞에서 실패하므로 lookahead 로 끊는다
알려진 한계: 결과에 있는 숫자를 '다른 항목'에 붙여 쓰는 오류는 못 잡는다.
"""
from __future__ import annotations

import re
from typing import Iterable

NUM = re.compile(r"(?<![\w.])[-+−]?\d[\d,]*(?:\.\d+)?(?![\d,]|\.\d)")
DATE = re.compile(
    r"(?:19|20)\d\d\s?[.\-/]\s?(?:0?[1-9]|1[0-2])(?!\d)"
    r"|(?:19|20)\d\d년(?:\s?(?:0?[1-9]|1[0-2])월)?"
    r"|(?<!\d)\d\d\.(?:0[1-9]|1[0-2])(?!\d)"
)
CODE = re.compile(r"```.*?```|`[^`\n]+`", re.S)
UNITS = ("%p", "bp", "%", "조원", "억원", "만원", "조", "억", "원", "건", "배", "개월")


def _num(tok: str) -> tuple[float, int]:
    s = tok.replace(",", "").replace("−", "-")
    d = len(s.split(".")[1]) if "." in s else 0
    return float(s), d


def _spans(rx, text):
    return [m.span() for m in rx.finditer(text)]


def _inside(pos, spans):
    return any(a <= pos < b for a, b in spans)


def evidence(numbers: Iterable[float] = (), texts: Iterable[str] = ()) -> set[float]:
    """허용 집합. numbers = 도구가 낸 원값, texts = payload 문자열·사용자 발화·첨부 등."""
    vals = {abs(float(x)) for x in numbers if x is not None}
    for s in texts:
        for m in NUM.finditer(s or ""):
            v, _ = _num(m.group(0))
            v = abs(v)
            vals.add(v)
            tail = s[m.end():m.end() + 2]
            if tail.startswith("억"):
                vals.add(v / 1e4)
            if tail.startswith("조"):
                vals.add(v * 1e4)
            if tail.startswith("%"):
                vals.add(v / 100)
    return vals


def _matches(v: float, d: int, allowed: set[float]) -> bool:
    tol = 0.5 * 10 ** (-d) + 1e-9
    for e in allowed:
        for c in (e, e * 100, e / 100):
            if abs(round(c, d) - v) <= tol:
                return True
    if v >= 1e8:
        return any(abs(v / k - e) <= 0.5 for e in allowed for k in (1e8, 1e12))
    return False


def check(answer: str, allowed: set[float], small_int_max: int = 31) -> dict:
    """→ {"text": ⚠ 표시된 답, "checked": 대조한 숫자 수, "unverified": [토큰]}"""
    skip = _spans(CODE, answer) + _spans(DATE, answer)
    out, last, checked, flagged = [], 0, 0, []
    for m in NUM.finditer(answer):
        s, e = m.span()
        if _inside(s, skip):
            continue
        tok = m.group(0)
        v, d = _num(tok)
        v = abs(v)
        if d == 0 and v <= small_int_max and "," not in tok:
            continue
        checked += 1
        if _matches(v, d, allowed):
            continue
        flagged.append(tok)
        for unit in UNITS:
            if answer.startswith(unit, e):
                e += len(unit)
                break
        out.append(answer[last:e])
        out.append("⚠")
        last = e
    out.append(answer[last:])
    return {"text": "".join(out), "checked": checked, "unverified": flagged}


BOLD = re.compile(r"\*\*(.+?)\*\*")


def limit_bold(text: str, per_paragraph: int = 1, total: int = 3) -> str:
    """굵게가 많으면 아무것도 강조되지 않는다 — 문단당 1개·전체 3개만 남긴다(코드 안은 손대지 않음).
    한 줄 전체가 굵은 소제목인 줄은 세지 않는다."""
    code = _spans(CODE, text)
    used, out = 0, []
    for para in re.split(r"(\n\s*\n)", text):
        if re.fullmatch(r"\n\s*\n", para):
            out.append(para)
            continue
        here = 0
        base = sum(len(x) for x in out)

        def rep(m):
            nonlocal used, here
            line_start = para.rfind("\n", 0, m.start()) + 1
            line_end = para.find("\n", m.end())
            line = para[line_start:line_end if line_end >= 0 else None].strip()
            if _inside(base + m.start(), code) or line == m.group(0):
                return m.group(0)
            if here < per_paragraph and used < total:
                here += 1
                used += 1
                return m.group(0)
            return m.group(1)

        out.append(BOLD.sub(rep, para))
    return "".join(out)
