"""
verify_hwp.py — 생성된 .hwp / .pdf 를 규칙과 좌표로 검사한다.

HWP_SCHEME.md §8의 1~2·4단계(구조 규칙 · 레이아웃 실측 · 내용 정합)를 자동 판정하고,
3단계(육안 검증)를 위해 페이지 PNG를 떨군다. 육안 판정은 hwp-doc-reviewer 서브에이전트가 한다.

사용:
    python verify_hwp.py out.hwp --pdf out.pdf --doc doc.json --png-dir _verify --json report.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HWPUNIT_PER_MM = 7200 / 25.4
PT_PER_MM = 72 / 25.4
TOL = 2.0                          # 좌표 허용 오차(pt)

# 페이지 기하 — 양식 템플릿(--template)에서 읽는다. 특정 양식의 값을 여기 박지 않는다.
# 템플릿이 없으면 A4·여백 15/7mm 가정으로 검사하고 경고한다.
_GEOM = {"body_width": 51026, "margin_lr_pt": 15 * PT_PER_MM,
         "margin_top_pt": 14 * PT_PER_MM, "margin_bot_pt": 14 * PT_PER_MM}


def load_geometry(template_ref):
    if not template_ref:
        return dict(_GEOM), False
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from build_hwp import load_template
    g = load_template(template_ref)["page"]
    hp = 1 / 7200 * 72   # HWPUNIT → pt
    return {
        "body_width": g["body_width"],
        "margin_lr_pt": g["margin_left"] * hp,
        "margin_top_pt": (g["margin_top"] + g.get("header_len", 0)) * hp,
        "margin_bot_pt": (g["margin_bottom"] + g.get("footer_len", 0)) * hp,
    }, True

ROMAN = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ"
# 꼬리말의 쪽 번호(- 1 -, 1 등)는 아래 여백에 있는 것이 정상이므로 침범 검사에서 제외한다
PAGENO_RE = re.compile(r"[-\s]*\d{1,3}[-\s]*")


class Report:
    def __init__(self):
        self.findings: list[dict] = []
        self.info: dict = {}

    def add(self, level, rule, msg, where=None):
        self.findings.append({"level": level, "rule": rule, "message": msg, "where": where})

    @property
    def errors(self):
        return [f for f in self.findings if f["level"] == "error"]

    @property
    def warns(self):
        return [f for f in self.findings if f["level"] == "warn"]


# ══════════════════════════════════════════════════════════════════════
# 1. 구조 규칙 (hwp 파싱)
# ══════════════════════════════════════════════════════════════════════
def check_structure(hwp_path: Path, rep: Report, workdir: Path, geom=None):
    geom = geom or _GEOM
    from hwp5.xmlmodel import Hwp5File
    from lxml import etree

    xml_path = workdir / "_verify.xml"
    with open(xml_path, "wb") as f:
        Hwp5File(str(hwp_path)).xmlevents(embedbin=False).dump(f)
    root = etree.parse(str(xml_path)).getroot()

    charshapes = list(root.iter("CharShape"))
    facenames = [e.get("name") for e in root.iter("FaceName")]

    def face_of(cs_id):
        if cs_id is None or int(cs_id) >= len(charshapes):
            return None
        ff = charshapes[int(cs_id)].find("FontFace")
        if ff is None:
            return None
        v = ff.get("ko")
        return facenames[int(v)] if v is not None and v.isdigit() and int(v) < len(facenames) else v

    def depth(el):
        d, p = 0, el.getparent()
        while p is not None:
            if p.tag == "TableCell":
                d += 1
            p = p.getparent()
        return d

    # ── 표 ──
    tables = []
    for tb in root.iter("TableControl"):
        body = tb.find("TableBody")
        if body is None:
            continue
        rows = body.findall("TableRow")
        grid = [rw.findall("TableCell") for rw in rows]
        cell_texts = [["".join(t.text or "" for t in c.iter("Text")).strip() for c in rw] for rw in grid]
        tables.append(
            {
                "width": int(tb.get("width", 0)),
                "rows": len(rows),
                "cols": int(body.get("cols", 0)),
                "cols_per_row": [len(r) for r in grid],
                "split_page": body.get("split-page"),
                "repeat_header": body.get("repeat-header"),
                "nested": depth(tb) > 0,
                "texts": cell_texts,
            }
        )
    rep.info["tables"] = len(tables)
    rep.info["table_widths"] = [t["width"] for t in tables]

    for i, t in enumerate(tables):
        where = f"table[{i}]"
        if t["nested"]:
            rep.add("error", "R2", "중첩표(표 안의 표)가 있습니다 — 레이아웃 붕괴 위험", where)
        if t["width"] > geom["body_width"]:
            rep.add("error", "R1",
                    f"표 폭 {t['width']} > 본문 폭 {geom['body_width']} — 오른쪽이 잘립니다", where)
        if t["split_page"] != "split":
            rep.add("warn", "R3", f"쪽 경계 나눔 설정이 '{t['split_page']}'", where)
        if t["repeat_header"] != "1":
            rep.add("warn", "R3", "제목 줄 반복이 꺼져 있습니다", where)
        if t["cols"] > 8:
            rep.add("error", "R4", f"열 수 {t['cols']}개 > 8개 — 셀 폭 부족", where)
        # 데이터표(3열 이상)만 행별 셀 수 일치 검사
        if t["cols"] >= 3:
            uniq = set(t["cols_per_row"])
            if len(uniq) > 1:
                rep.add("warn", "STRUCT",
                        f"행마다 셀 수가 다릅니다 {sorted(uniq)} — 의도한 병합인지 확인", where)
        for ri, row in enumerate(t["texts"]):
            for ci, v in enumerate(row):
                if v == "":
                    rep.add("warn", "R8", f"빈 셀 (행{ri + 1}, 열{ci + 1}) — '-'를 넣으세요", where)

    # ── 글꼴 / 색 / 크기 ──
    faces, sizes, colors = set(), set(), set()
    paragraphs = []
    for p in root.iter("Paragraph"):
        txt = "".join(t.text or "" for t in p.iter("Text")).strip()
        if not txt:
            continue
        cid = next((t.get("charshape-id") for t in p.iter("Text")), None)
        cs = charshapes[int(cid)] if cid and int(cid) < len(charshapes) else None
        if cs is not None:
            faces.add(face_of(cid))
            sizes.add(round(int(cs.get("basesize", 0)) / 100, 1))
            colors.add(cs.get("text-color"))
        paragraphs.append({"text": txt, "depth": depth(p)})

    faces = {f for f in faces if f}
    rep.info["fonts"] = sorted(faces)
    rep.info["sizes_pt"] = sorted(sizes)
    rep.info["colors"] = sorted(c for c in colors if c)
    if len(faces) > 1:
        rep.add("warn", "R6", f"글꼴이 {len(faces)}종 혼용됨: {sorted(faces)}")
    for c in colors:
        if c and c not in ("#000000", "#0000ff", "#ffffff"):
            rep.add("warn", "R7", f"허용되지 않은 글자색 {c} (검정/파랑/흰색만)")

    # ── 계층 순서 (R5) ──
    seq = []
    for p in paragraphs:
        if p["depth"] > 0:
            t = p["text"]
            if t and t[0] in ROMAN:
                seq.append(("h1", t[:20]))
            elif re.fullmatch(r"\d{1,2}", t.strip()):
                seq.append(("h2", t.strip()))
            continue
        t = p["text"]
        if re.match(r"^\d{1,2}\.\s", t):
            seq.append(("h3", t[:20]))
        elif t.startswith("□"):
            seq.append(("b1", t[:20]))
        elif t.startswith("∙"):
            seq.append(("b2", t[:20]))
        elif t.startswith(("→", "↳")):
            seq.append(("b3", t[:20]))

    # 제목(h*) 다음에 바로 b1(□)이 오는 것은 정상 흐름이다. 불릿끼리의 건너뜀만 본다.
    bullet_order = {"b1": 1, "b2": 2, "b3": 3}
    head_order = {"h1": 1, "h2": 2, "h3": 3}
    prev_b = None
    prev_h = None
    for kind, sample in seq:
        if kind in head_order:
            if prev_h and head_order[kind] - head_order[prev_h] > 1:
                rep.add("warn", "R5", f"제목 계층 건너뜀: {prev_h} → {kind} ('{sample}')")
            prev_h, prev_b = kind, None
        else:
            if prev_b and bullet_order[kind] - bullet_order[prev_b] > 1:
                rep.add("warn", "R5", f"불릿 계층 건너뜀: {prev_b} → {kind} ('{sample}')")
            prev_b = kind
    rep.info["outline"] = [f"{k}:{s}" for k, s in seq[:40]]
    joined = "\n".join(t.text or "" for t in root.iter("Text"))
    rep.info["_hwp_flat"] = re.sub(r"\s+", "", joined)
    rep.info["_hwp_joined"] = joined          # 숫자 융합 방지용(구분자 유지)
    # 표 셀 안 문단 텍스트의 multiset — 셀 값은 문단 하나로 정확히 남으므로
    # '몇 번 나와야 하는지'까지 대조할 수 있다 (입력 오염 검출의 핵심)
    from collections import Counter as _C
    cellparas = _C()
    for p in root.iter("Paragraph"):
        if depth(p) == 0:
            continue
        t = re.sub(r"\s+", "", "".join(x.text or "" for x in p.iter("Text")))
        if t:
            cellparas[t] += 1
    rep.info["_hwp_cellparas"] = cellparas
    return root


# ══════════════════════════════════════════════════════════════════════
# 2. 레이아웃 실측 (PDF 좌표)
# ══════════════════════════════════════════════════════════════════════
def cluster_lines(page, tol=3.0):
    """표 선(drawing)을 모아 표 단위 bbox로 묶는다."""
    import fitz  # noqa: F401

    segs = []
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 0.1 and r.height < 0.1:
            continue
        segs.append(r)
    if not segs:
        return []
    segs.sort(key=lambda r: (r.y0, r.x0))
    groups = []
    for r in segs:
        placed = False
        for g in groups:
            if r.y0 <= g["y1"] + 6 and r.y1 >= g["y0"] - 6 and r.x0 <= g["x1"] + 6 and r.x1 >= g["x0"] - 6:
                g["x0"], g["y0"] = min(g["x0"], r.x0), min(g["y0"], r.y0)
                g["x1"], g["y1"] = max(g["x1"], r.x1), max(g["y1"], r.y1)
                g["segs"].append(r)
                placed = True
                break
        if not placed:
            groups.append({"x0": r.x0, "y0": r.y0, "x1": r.x1, "y1": r.y1, "segs": [r]})
    # 선이 4개 미만이면 표로 보지 않음(밑줄 등)
    return [g for g in groups if len(g["segs"]) >= 4]


def check_layout(pdf_path: Path, rep: Report, png_dir: Path | None, dpi=110,
                 doc_json: Path | None = None, geom=None):
    geom = geom or _GEOM
    """doc_json을 주면 페이지 상단 표의 첫 줄을 헤더 텍스트와 대조해
    '헤더 없이 잘린 표'(R3 위반)를 정확히 판정한다."""
    header_sets = set()
    if doc_json and doc_json.exists():
        model = json.loads(doc_json.read_text(encoding="utf-8"))
        for b in model.get("blocks", []):
            if b.get("type") == "table":
                for hrow in b["header"]:
                    header_sets.add(re.sub(r"\s+", "", "".join(hrow)))
    import fitz

    doc = fitz.open(str(pdf_path))
    rep.info["pages"] = doc.page_count
    pngs = []
    prev_table_touched_bottom = False

    for pno in range(doc.page_count):
        page = doc[pno]
        W, H = page.rect.width, page.rect.height
        left, right = geom["margin_lr_pt"], W - geom["margin_lr_pt"]
        top, bottom = geom["margin_top_pt"], H - geom["margin_bot_pt"]
        where = f"p{pno + 1}"

        # 2-1. 텍스트가 본문 영역을 벗어나는지
        for blk in page.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                for sp in ln["spans"]:
                    x0, y0, x1, y1 = sp["bbox"]
                    if x1 > right + TOL:
                        rep.add("error", "LAYOUT",
                                f"텍스트가 오른쪽 여백을 침범 (x={x1:.1f} > {right:.1f}): '{sp['text'][:24]}'", where)
                    if x0 < left - TOL:
                        rep.add("error", "LAYOUT",
                                f"텍스트가 왼쪽 여백을 침범 (x={x0:.1f} < {left:.1f}): '{sp['text'][:24]}'", where)
                    if y1 > bottom + TOL and not PAGENO_RE.fullmatch(sp["text"].strip()):
                        rep.add("warn", "LAYOUT",
                                f"텍스트가 아래 여백을 침범 (y={y1:.1f} > {bottom:.1f}): '{sp['text'][:24]}'", where)

        # 2-2. 표 bbox
        groups = cluster_lines(page)
        for gi, g in enumerate(groups):
            if g["x1"] > right + TOL:
                rep.add("error", "LAYOUT",
                        f"표가 본문 폭을 벗어남 (x={g['x1']:.1f} > {right:.1f})", f"{where}/table{gi}")
            if g["y1"] > bottom + TOL:
                rep.add("warn", "LAYOUT", f"표가 아래 여백까지 내려옴 (y={g['y1']:.1f})", f"{where}/table{gi}")

        # 2-3. 페이지 경계 분할 — 이어지는 표의 첫 줄이 헤더인지로 판정한다
        touched = any(g["y1"] > bottom - 6 for g in groups)
        top_groups = [g for g in groups if abs(g["y0"] - top) < 24]
        if prev_table_touched_bottom and top_groups:
            g = min(top_groups, key=lambda x: x["y0"])
            band = fitz.Rect(g["x0"] - 2, g["y0"] - 2, g["x1"] + 2, g["y0"] + 16)
            first_line = re.sub(r"\s+", "", page.get_textbox(band))
            if header_sets and any(first_line and (first_line in h or h in first_line)
                                   for h in header_sets):
                rep.add("warn", "SPLIT",
                        "표가 페이지 경계에서 나뉘었으나 제목 줄이 반복됨 (정상)", where)
            else:
                rep.add("error", "R3",
                        f"표가 헤더 없이 페이지 경계에서 잘렸습니다 — 이어지는 첫 줄 '{first_line[:24]}'",
                        where)
        prev_table_touched_bottom = touched

        # 2-3b. R11 — 쪽 끝에 제목 배너나 표 헤더 띠만 남았는지
        if groups and pno < doc.page_count - 1:
            last = max(groups, key=lambda g: g["y1"])
            height = last["y1"] - last["y0"]
            if last["y1"] > bottom - 60 and height < 46:
                rep.add("warn", "R11",
                        f"쪽 끝에 높이 {height:.0f}pt짜리 표만 남았습니다 — 제목 배너 또는 "
                        f"데이터 없는 헤더 띠일 수 있으니 절 경계에 pagebreak를 검토하세요", where)

        # 2-4. 셀 텍스트 넘침 (텍스트 span이 세로 괘선을 가로지름)
        vlines = []
        for g in groups:
            for r in g["segs"]:
                if r.width < 1.5 and r.height > 4:
                    vlines.append((r.x0, r.y0, r.y1))
        for blk in page.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                for sp in ln["spans"]:
                    if not sp["text"].strip():
                        continue          # 공백은 잉크가 없어 괘선을 '넘침'으로 보지 않는다
                    x0, y0, x1, y1 = sp["bbox"]
                    for vx, vy0, vy1 in vlines:
                        if x0 + 0.8 < vx < x1 - 0.8 and vy0 - 1 <= y0 and y1 <= vy1 + 1:
                            rep.add("error", "OVERFLOW",
                                    f"셀 텍스트가 괘선을 넘침: '{sp['text'][:24]}' (x {x0:.1f}~{x1:.1f}, 선 {vx:.1f})",
                                    where)
                            break

        if png_dir:
            png_dir.mkdir(parents=True, exist_ok=True)
            p = png_dir / f"page{pno + 1:02d}.png"
            page.get_pixmap(dpi=dpi).save(str(p))
            pngs.append(str(p))

    rep.info["png"] = pngs
    return doc


# ══════════════════════════════════════════════════════════════════════
# 3. 내용 정합 (doc.json ↔ PDF 텍스트)
# ══════════════════════════════════════════════════════════════════════
def check_content(doc_json: Path, pdf_path: Path, rep: Report):
    """문서 모델 ↔ 생성된 hwp 내부 텍스트를 대조한다.
    PDF가 아니라 hwp 텍스트(입력 순서 그대로)와 비교하는 이유:
      - PDF 읽기 순서는 표 열끼리 섞여 어절 단위 fallback이 필요했고,
      - 그 fallback은 같은 어절이 다른 곳에 있으면 입력 중 오염(함정 #21 —
        자동화 중 키 입력이 새어 들어 셀 텍스트가 변조되는 것)을 통과시킨다.
    hwp 텍스트는 문단 순서가 입력 순서와 같아 정확 부분일치로 검사할 수 있다."""
    import fitz

    doc = json.loads(doc_json.read_text(encoding="utf-8"))
    flat = rep.info.get("_hwp_flat")
    if flat is None:
        pdf = fitz.open(str(pdf_path))
        flat = re.sub(r"\s+", "", "".join(
            "".join(b[4] for b in pdf[i].get_text("blocks", sort=True))
            for i in range(pdf.page_count)))

    cellparas = rep.info.get("_hwp_cellparas")

    def want(s, where):
        if not s:
            return
        if re.sub(r"\s+", "", str(s)) in flat:
            return
        rep.add("error", "CONTENT", f"문서 모델의 내용이 결과물에 없습니다(오염 또는 누락): '{str(s)[:40]}'", where)

    def want_cell(s, where):
        """표 셀은 문단 정확일치 + 필요 횟수만큼 존재해야 한다. 같은 문구가 다른 곳에
        있어도 오염된 셀을 잡아낸다(함정 #21)."""
        if s in ("", None):
            return
        if cellparas is None:
            want(s, where)
            return
        for line in str(s).split("\n"):
            key = re.sub(r"\s+", "", line) or "-"
            if cellparas[key] > 0:
                cellparas[key] -= 1
            else:
                rep.add("error", "CONTENT",
                        f"표 셀 내용이 결과물과 불일치(오염 또는 누락): '{line[:40]}'", where)

    m = doc.get("meta", {})
    want(m.get("title"), "meta.title")
    want(m.get("dept"), "meta.dept")
    for i, b in enumerate(doc.get("blocks", [])):
        w = f"blocks[{i}].{b['type']}"
        if b["type"] in ("h1", "h2", "h3", "bullet", "enum", "conclusion", "note"):
            want(b.get("text"), w)
        elif b["type"] == "box":
            for it in b["items"]:
                want(it["text"], w)
        elif b["type"] == "table":
            for row in b["header"] + b["rows"]:
                for cell in row:
                    want_cell(cell, w)

    # 숫자 손실 검사: 모델의 모든 숫자 토큰이 결과물에 있는지
    def nums(s):
        return set(re.findall(r"\d[\d,\.]*", str(s)))

    # 숫자는 '내용' 필드에서만 모은다 (widths 같은 서식 값은 제외)
    model_nums = set()

    def collect(b):
        if b["type"] in ("h1", "h2", "h3", "bullet", "enum", "conclusion", "note"):
            model_nums.update(nums(b.get("text", "")))
        elif b["type"] == "box":
            for it in b["items"]:
                model_nums.update(nums(it["text"]))
        elif b["type"] == "table":
            for row in b["header"] + b["rows"]:
                for cell in row:
                    model_nums.update(nums(cell))
            model_nums.update(nums(b.get("note", "")))

    for b in doc.get("blocks", []):
        collect(b)
    pdf_nums = nums(rep.info.get("_hwp_joined", flat))
    missing = {n for n in model_nums if len(n) >= 3 and n not in pdf_nums and n.replace(",", "") not in flat}
    if missing:
        rep.add("error", "CONTENT", f"결과물에서 누락된 수치: {sorted(missing)[:12]}")


# ══════════════════════════════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hwp")
    ap.add_argument("--pdf")
    ap.add_argument("--doc")
    ap.add_argument("--png-dir")
    ap.add_argument("--json")
    ap.add_argument("--template", "-t", help="양식 템플릿 이름/경로 — 페이지 기하 기준")
    a = ap.parse_args()

    hwp_path = Path(a.hwp)
    rep = Report()
    workdir = hwp_path.parent

    geom, from_tpl = load_geometry(a.template)
    if not from_tpl:
        rep.add("warn", "SETUP", "양식 템플릿 미지정 — 기본 페이지 기하(A4·여백 15/7mm)로 검사")
    check_structure(hwp_path, rep, workdir, geom=geom)
    if a.pdf and Path(a.pdf).exists():
        check_layout(Path(a.pdf), rep, Path(a.png_dir) if a.png_dir else None,
                     doc_json=Path(a.doc) if a.doc else None, geom=geom)
        if a.doc:
            check_content(Path(a.doc), Path(a.pdf), rep)
    else:
        rep.add("warn", "SETUP", "PDF가 없어 레이아웃·내용 검증을 건너뜀")

    verdict = "FAIL" if rep.errors else ("WARN" if rep.warns else "PASS")
    out = {
        "verdict": verdict,
        "errors": len(rep.errors),
        "warnings": len(rep.warns),
        "info": rep.info,
        "findings": rep.findings,
    }
    if a.json:
        Path(a.json).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"판정: {verdict}  (error {len(rep.errors)} / warn {len(rep.warns)})")
    print(f"페이지 {rep.info.get('pages')} · 표 {rep.info.get('tables')} · "
          f"글꼴 {rep.info.get('fonts')} · 크기 {rep.info.get('sizes_pt')}")
    for f in rep.findings[:60]:
        mark = "✗" if f["level"] == "error" else "!"
        print(f"  {mark} [{f['rule']}] {f['message']}" + (f"  ({f['where']})" if f["where"] else ""))
    if len(rep.findings) > 60:
        print(f"  … 외 {len(rep.findings) - 60}건")
    if rep.info.get("png"):
        print(f"페이지 이미지: {len(rep.info['png'])}장 → {Path(rep.info['png'][0]).parent}")
    return 1 if verdict == "FAIL" else 0


if __name__ == "__main__":
    sys.exit(main())
