"""
selftest.py — 렌더러·템플릿의 **양식 무관 불변식**을 검사한다.

이 스크립트의 목적은 "이 문서가 예쁜가"가 아니라 **"어떤 양식을 넣어도 렌더러가
사람이 읽을 수 있는 문서를 만드는가"**를 확인하는 것이다. 그래서 검사 항목은 전부
특정 양식의 값이 아니라 보편적 성질이다.

    python selftest.py --template <양식이름> [--template 다른양식 ...] [--keep]

각 템플릿마다 고정 샘플 문서를 렌더해 아래를 검사한다.

  INV1  글자가 보이는가        — 셀 글자색이 그 셀 배경색과 같으면 글자가 사라진다
  INV2  셀 글자가 괘선에 붙지 않는가 — 위·아래 여유 ≥ 1.5pt
  INV3  표가 본문 폭 안에 있는가
  INV4  머리기호 사다리가 계단인가 — 레벨이 깊어질수록 왼쪽 좌표가 커져야 한다
  INV5  둘째 줄이 텍스트 시작선에 맞는가 (내어쓰기)
  INV6  제목 번호가 실제로 그려졌는가 — 배너 번호칸이 비어 보이지 않아야 한다
  INV7  넣은 내용이 빠지지 않았는가
  INV8  쪽 끝에 제목·헤더만 남지 않았는가

실패는 템플릿 값을 손으로 고쳐 넘기지 말고 **추출기 또는 렌더러를 고쳐** 해결한다.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PT_PER_MM = 72 / 25.4

# 모든 블록 타입과 4단 사다리를 한 번씩 쓰는 고정 샘플.
# 어떤 양식으로 렌더해도 같은 의미가 나와야 한다.
SAMPLE = {
    "meta": {"title": "양식 자기검증 문서", "date": "2026.01.01.", "dept": "검증부"},
    "blocks": [
        {"type": "h1", "text": "첫 번째 대제목"},
        {"type": "bullet", "level": 1, "text": "1단계 항목 — 둘째 줄이 텍스트 시작선에 맞는지 보려고 일부러 길게 쓴 문장이며 줄을 넘겨야 한다"},
        {"type": "bullet", "level": 2, "text": "2단계 항목 — 이 문장도 한 줄을 넘겨서 내어쓰기가 유지되는지 확인하기 위한 길이로 작성한다"},
        {"type": "bullet", "level": 3, "text": "3단계 항목"},
        {"type": "bullet", "level": 4, "text": "4단계 항목"},
        {"type": "conclusion", "text": "결론 한 줄"},
        {"type": "h2", "text": "첫 번째 중제목"},
        {"type": "box", "items": [{"level": 1, "text": "박스 첫 줄"}, {"level": 2, "text": "박스 둘째 줄"}]},
        {"type": "table", "caption": "[단위 : 건]",
         "widths": [0.28, 0.18, 0.18, 0.36],
         "align": ["center", "right", "right", "left"],
         "header": [["구 분", "당월", "전월", "비 고"]],
         "rows": [["항목 가", "15", "21", "비고 내용"],
                  ["항목 나", "1,234", "2,345", "-"],
                  ["합 계", "1,249", "2,366", "-"]],
         "total_row": True,
         "note": "집계 기준 : 자기검증"},
        {"type": "h3", "text": "소제목"},
        {"type": "enum", "index": 1, "text": "열거 항목"},
        {"type": "note", "text": "각주 한 줄"},
        {"type": "h1", "text": "두 번째 대제목"},
        {"type": "bullet", "level": 1, "text": "번호가 자동으로 2번이 되어야 한다"},
    ],
}


class Result:
    def __init__(self):
        self.rows = []

    def add(self, inv, ok, detail):
        self.rows.append((inv, ok, detail))

    @property
    def failed(self):
        return [r for r in self.rows if not r[1]]


def near(a, b, tol=1.0):
    return abs(a - b) <= tol


def hexrgb(h):
    h = (h or "#000000").lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def luminance(rgb):
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def check_template_static(tpl, res):
    """렌더 전에 템플릿만 보고 잡을 수 있는 것 — 글자색/배경색 충돌(INV1)."""
    styles = tpl.get("cell_styles") or {}
    for role, st in styles.items():
        fg = st.get("text_color")
        bg = st.get("fill")
        if not fg:
            continue
        fg_l = luminance(hexrgb(fg))
        bg_l = luminance(hexrgb(bg)) if bg else 1.0      # 배경 없음 = 흰 종이
        if abs(fg_l - bg_l) < 0.25:
            res.add("INV1", False,
                    f"{role}: 글자색 {fg} 이 배경 {bg or '없음(흰 종이)'} 과 구분되지 않아 글자가 사라진다")
    if not res.failed:
        res.add("INV1", True, f"역할 {len(styles)}개 전부 글자/배경 대비 확보")


def check_pdf(pdf: Path, tpl: dict, res: Result):
    import fitz

    doc = fitz.open(str(pdf))
    body_w = tpl["page"]["body_width"]
    margin_l = tpl["page"]["margin_left"] / 7200 * 72
    right_edge = margin_l + body_w / 7200 * 72

    # ── INV3 표 폭 ──
    over = []
    for pno in range(doc.page_count):
        for d in doc[pno].get_drawings():
            r = d["rect"]
            if r.width > 50 and r.x1 > right_edge + 2:
                over.append(f"p{pno+1} x1={r.x1:.1f}>{right_edge:.1f}")
    res.add("INV3", not over, f"표/선이 본문 폭 초과: {over[:3]}" if over else "표 전부 본문 폭 이내")

    # ── INV2 셀 글자와 괘선 간격 ──
    tight = []
    for pno in range(doc.page_count):
        p = doc[pno]
        hl = sorted({round(d["rect"].y0, 1) for d in p.get_drawings()
                     if d["rect"].height < 1.6 and d["rect"].width > 40})
        for blk in p.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                for sp in ln["spans"]:
                    if sp["size"] > 10.6 or not sp["text"].strip():
                        continue
                    y0, y1 = sp["bbox"][1], sp["bbox"][3]
                    above = [y for y in hl if y <= y0]
                    below = [y for y in hl if y >= y1]
                    if not above or not below:
                        continue
                    top_gap = y0 - above[-1]
                    bot_gap = below[0] - y1
                    # 아래는 글꼴 디센더가 bbox에 포함되어 시각 여백이 bbox보다 크다.
                    # 실측상 위 1.5pt·아래 0.7pt(bbox) 미만이면 눈에 띄게 붙어 보인다.
                    if top_gap < 1.5 or bot_gap < 0.7:
                        tight.append(f"p{pno+1} '{sp['text'][:10]}' 위{top_gap:.1f}/아래{bot_gap:.1f}pt")
    res.add("INV2", not tight,
            f"셀 글자가 괘선에 붙음 {len(tight)}건: {tight[:3]}" if tight
            else "셀 글자 상하 여유 확보(위≥1.5, 아래≥0.7pt)")

    # ── INV4·INV5 사다리 계단 + 내어쓰기 ──
    ladder = [l["marker"] for l in tpl["ladder"]]
    firstx, wrapx = {}, {}
    for pno in range(doc.page_count):
        for blk in doc[pno].get_text("dict")["blocks"]:
            for li, ln in enumerate(blk.get("lines", [])):
                if not ln["spans"]:
                    continue
                txt = "".join(s["text"] for s in ln["spans"]).strip()
                x0 = min(s["bbox"][0] for s in ln["spans"])
                import re as _re
                if _re.fullmatch(r"-\s*\d+\s*-", txt):   # 쪽번호 '- 1 -' 오인 방지
                    continue
                if txt[:1] in ladder and len(txt) > 2 and txt[1] == " ":
                    mk = txt[:1]
                    firstx.setdefault(mk, x0)
                    # 다음 줄이 같은 블록의 이어짐이면 그 x를 내어쓰기 확인에 쓴다
                    nxt = blk["lines"][li + 1] if li + 1 < len(blk["lines"]) else None
                    if nxt and nxt["spans"]:
                        ntxt = "".join(s["text"] for s in nxt["spans"]).strip()
                        nx0 = min(s["bbox"][0] for s in nxt["spans"])
                        # 이어진 줄이려면: 다른 종류의 머리기호로 시작하지 않고,
                        # 시작 x가 기호보다 오른쪽이어야 한다. 왼쪽이면 새 문단이다.
                        other_marks = set(ladder) | set("☞⇒▶*※①②③④⑤⑥⑦⑧⑨◇")
                        if ntxt[:1] not in other_marks and nx0 > x0:
                            wrapx.setdefault(mk, nx0)
    seen = [(mk, firstx[mk]) for mk in ladder if mk in firstx]
    stair_ok = all(seen[i][1] < seen[i + 1][1] - 1 for i in range(len(seen) - 1))
    res.add("INV4", stair_ok,
            "사다리 좌표 " + ", ".join(f"{m}:{x:.0f}" for m, x in seen) +
            ("" if stair_ok else "  ← 레벨이 깊어질수록 커져야 한다"))

    bad_hang = []
    for mk, wx in wrapx.items():
        # 둘째 줄은 기호 다음 텍스트 시작선(≈ 기호 x + 기호폭)과 맞아야 한다.
        expect = firstx.get(mk, wx)
        if wx <= expect + 2:
            bad_hang.append(f"{mk}: 둘째 줄 x={wx:.0f} ≤ 기호 x={expect:.0f}")
    res.add("INV5", not bad_hang,
            "둘째 줄이 기호 아래로 흐름: " + "; ".join(bad_hang) if bad_hang
            else f"내어쓰기 정상({len(wrapx)}개 확인)")

    # ── INV6 배너 번호가 그려졌는가 ──
    txt_all = "".join(doc[i].get_text() for i in range(doc.page_count))
    h1_marker = tpl["headings"]["h1"].get("marker")
    expect_num = {"roman": "Ⅰ", "arabic": "1", "arabic_dot": "1.",
                  "arabic_paren": "1)", "hangul_dot": "가."}.get(h1_marker, "")
    # 글자색이 배경과 같으면 PDF 텍스트로는 잡히지만 눈에는 안 보인다 → 색으로 판정
    invisible = []
    for pno in range(doc.page_count):
        p = doc[pno]
        for blk in p.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                for sp in ln["spans"]:
                    if sp["text"].strip() not in (expect_num, "1", "2"):
                        continue
                    col = sp.get("color", 0)
                    rgb = ((col >> 16) & 255, (col >> 8) & 255, col & 255)
                    # 배경 사각형 찾기
                    bg = None
                    for d in p.get_drawings():
                        r = d["rect"]
                        if d.get("fill") and r.x0 <= sp["bbox"][0] and r.x1 >= sp["bbox"][2] \
                                and r.y0 <= sp["bbox"][1] + 1 and r.y1 >= sp["bbox"][3] - 1:
                            bg = tuple(int(c * 255) for c in d["fill"])
                    bg_l = luminance(bg) if bg else 1.0
                    if abs(luminance(rgb) - bg_l) < 0.25:
                        invisible.append(f"p{pno+1} '{sp['text']}' 글자{rgb} 배경{bg or '없음'}")
    res.add("INV6", not invisible,
            "번호가 배경과 같은 색이라 보이지 않음: " + "; ".join(invisible[:3]) if invisible
            else "제목 번호 가시성 확인")

    # ── INV7 내용 누락 ──
    import re
    flat = re.sub(r"\s+", "", "".join(
        "".join(b[4] for b in doc[i].get_text("blocks", sort=True)) for i in range(doc.page_count)))
    missing = []
    for b in SAMPLE["blocks"]:
        for t in ([b["text"]] if b.get("text") else []) + \
                 ([i["text"] for i in b.get("items", [])] if b.get("items") else []) + \
                 ([c for row in (b.get("header", []) + b.get("rows", [])) for c in row]):
            if re.sub(r"\s+", "", t) not in flat:
                missing.append(t[:22])
    res.add("INV7", not missing, f"누락 {len(missing)}건: {missing[:3]}" if missing else "내용 전량 존재")

    # ── INV8 쪽 끝 잔여 ──
    orphan = []
    bottom = doc[0].rect.height - (tpl["page"]["margin_bottom"] + tpl["page"].get("footer_len", 0)) / 7200 * 72
    for pno in range(doc.page_count - 1):
        p = doc[pno]
        groups = [d["rect"] for d in p.get_drawings() if d["rect"].width > 50]
        if not groups:
            continue
        last = max(groups, key=lambda r: r.y1)
        if last.y1 > bottom - 60 and (last.y1 - last.y0) < 46:
            orphan.append(f"p{pno+1} 높이 {last.y1 - last.y0:.0f}pt")
    res.add("INV8", not orphan, f"쪽 끝에 제목/헤더만 남음: {orphan}" if orphan else "쪽 끝 잔여 없음")
    doc.close()


def run(template: str, keep: bool) -> Result:
    sys.path.insert(0, str(HERE))
    from build_hwp import load_template

    tpl = load_template(template)
    res = Result()
    check_template_static(tpl, res)

    work = Path(tempfile.mkdtemp(prefix="hwpselftest_"))
    doc_p = work / "sample.doc.json"
    doc_p.write_text(json.dumps(SAMPLE, ensure_ascii=False, indent=2), encoding="utf-8")
    hwp_p, pdf_p = work / "out.hwp", work / "out.pdf"
    cmd = [sys.executable, str(HERE / "build_hwp.py"), str(doc_p), str(hwp_p),
           "-t", template, "--pdf", str(pdf_p), "--kill-stale"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900,
                       encoding="utf-8", errors="replace")
    if not pdf_p.exists():
        res.add("BUILD", False, f"렌더 실패: {r.stdout[-300:]} {r.stderr[-300:]}")
        return res
    res.add("BUILD", True, f"렌더 성공 → {pdf_p}")
    check_pdf(pdf_p, tpl, res)
    if keep:
        print(f"  산출물 보존: {work}")
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", "-t", action="append", required=True,
                    help="검사할 양식 이름 (여러 번 지정 가능)")
    ap.add_argument("--keep", action="store_true", help="렌더 산출물을 지우지 않는다")
    a = ap.parse_args()

    all_ok = True
    for t in a.template:
        print(f"\n=== 양식 '{t}' 자기검증 ===")
        res = run(t, a.keep)
        for inv, ok, detail in res.rows:
            print(f"  {'PASS' if ok else 'FAIL'}  {inv:6s} {detail}")
        ok = not res.failed
        all_ok &= ok
        print(f"  → {'PASS' if ok else 'FAIL'} ({len(res.failed)}건 실패)")
    print(f"\n전체: {'PASS' if all_ok else 'FAIL'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
