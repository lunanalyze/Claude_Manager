"""
extract_template.py — 임의의 .hwp 양식 → 템플릿(template.json) 추론

hwp-report의 build_hwp.py가 그대로 먹는 형태로 뽑아낸다. 계약서는
`hwp-report/schema/template.schema.json` 하나뿐이며, 이 스크립트가 그 계약을 채운다.

사용:
    python extract_template.py 양식.hwp -o templates/새양식.json [--name 새양식] [--json]

출력:
  - template.json  (page/font/palette/headings/ladder/special/table/cover)
  - confidence     항목별 신뢰도. low인 항목은 사람 확인을 받아야 한다.
  - unsupported    원본이 쓰지만 렌더러가 재현 못 하는 요소
  - evidence       각 추론의 근거(관측 횟수·실측값) — 확인 요청 시 근거로 제시한다
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from hwp5.xmlmodel import Hwp5File
from lxml import etree

HWPUNIT_PER_MM = 7200 / 25.4
ROMAN = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ"
HANGUL_ORD = "가나다라마바사아자차카타파하"
# 본문 머리기호 후보 (제목 번호와 구분한다)
BULLET_CHARS = "□▢■∎❑∙·•○●◦◇◆-–—▸▹▪▫※☞⇒→↳↦"
# 기호형 제목 후보 — 굵고 크게, 문서 최상위에서 반복 사용되면 제목으로 본다
SYMBOL_HEAD_CHARS = "❒❑■□◆▣◉●∎"
CONCLUSION_CHARS = "☞⇒▶"
NOTE_CHARS = "*※"
ENUM_CHARS = "①②③④⑤⑥⑦⑧⑨⑩"


def mm(v):
    return round(float(v) / HWPUNIT_PER_MM, 1)


def pt(v):
    return round(float(v) / 100, 1)


class Extractor:
    def __init__(self, hwp_path: Path, workdir: Path):
        self.path = hwp_path
        xml = workdir / f"_{hwp_path.stem}.xml"
        if not xml.exists():
            with open(xml, "wb") as f:
                Hwp5File(str(hwp_path)).xmlevents(embedbin=False).dump(f)
        self.root = etree.parse(str(xml)).getroot()
        self.charshapes = list(self.root.iter("CharShape"))
        self.parashapes = list(self.root.iter("ParaShape"))
        self.facenames = [e.get("name") for e in self.root.iter("FaceName")]
        self.borderfills = list(self.root.iter("BorderFill"))
        self.evidence: dict = {}
        self.confidence: dict = {}
        self.unsupported: list[str] = []
        self._collect()

    # ── 원시 수집 ─────────────────────────────────────────────────────
    def _cs(self, idx):
        if idx is None or int(idx) >= len(self.charshapes):
            return {}
        e = self.charshapes[int(idx)]
        ff = e.find("FontFace")
        face = ff.get("ko") if ff is not None else None
        if face is not None and str(face).isdigit() and int(face) < len(self.facenames):
            face = self.facenames[int(face)]
        return {"size": pt(e.get("basesize", 0)), "bold": e.get("bold") == "1",
                "color": e.get("text-color"), "face": face}

    def _ps(self, idx):
        if idx is None or int(idx) >= len(self.parashapes):
            return {}
        a = self.parashapes[int(idx)].attrib
        return {"indent": int(a.get("indent", 0) or 0),
                "left": int(a.get("doubled-margin-left", a.get("left-margin", 0)) or 0),
                "align": a.get("align-horizontal")}

    # ── 셀 장식 ───────────────────────────────────────────────────────
    BORDER_WIDTHS = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]
    STROKE_MAP = {"solid": "solid", "dot": "dot", "dotted": "dot", "dash": "dash",
                  "dashed": "dash", "dash_dot": "dashdot", "double": "double", "thick": "solid"}

    @classmethod
    def _snap_width(cls, mm):
        return min(cls.BORDER_WIDTHS, key=lambda w: abs(w - mm))

    def _deco(self, bf_id):
        """borderfill-id(1-based) → {fill, sides{4면: 'none'|{type,width_mm,color}}}"""
        if not bf_id:
            return None
        i = int(bf_id) - 1
        if not (0 <= i < len(self.borderfills)):
            return None
        e = self.borderfills[i]
        fc = e.find("FillColorPattern")
        fill = fc.get("background-color") if fc is not None else None
        if fill in (None, "#ffffff", "none"):
            fill = None
        sides = {}
        for b in e.findall("Border"):
            name = b.get("attribute-name")
            if name not in ("left", "right", "top", "bottom"):
                continue
            stroke = (b.get("stroke-type") or "none").lower()
            if stroke in ("none", ""):
                sides[name] = "none"
                continue
            wm = b.get("width") or "0.12mm"
            try:
                mm = float(str(wm).replace("mm", ""))
            except ValueError:
                mm = 0.12
            sides[name] = {"type": self.STROKE_MAP.get(stroke, "solid"),
                           "width_mm": self._snap_width(mm),
                           "color": b.get("color") or "#000000"}
        for name in ("left", "right", "top", "bottom"):
            sides.setdefault(name, "none")
        return {"fill": fill, "sides": sides}

    @staticmethod
    def _modal(values):
        """None이 아닌 값들의 최빈값. 비교를 위해 dict는 문자열로 직렬화한다."""
        import json as _json
        from collections import Counter as _C
        keys = _C()
        rep_ = {}
        for v in values:
            if v is None:
                continue
            k = _json.dumps(v, sort_keys=True, ensure_ascii=False)
            keys[k] += 1
            rep_[k] = v
        if not keys:
            return None
        return rep_[keys.most_common(1)[0][0]]

    RULE_ROW_MAX_H = 700      # 2.5mm 이하 = 밑줄로 본다

    def _is_rule_row(self, t, ri):
        h = t["heights"][ri] if ri < len(t["heights"]) else 0
        return 0 < h <= self.RULE_ROW_MAX_H

    def _rule_of(self, t, ri):
        """행 ri를 선으로 환산한다 (채운 색 → 그 색의 실선, 두께는 행 높이)."""
        out = {}
        h = t["heights"][ri] if ri < len(t["heights"]) else 0
        for ci, bid in enumerate(t["bfids"][ri]):
            d = self._deco(bid)
            if d and d["fill"]:
                out[ci] = {"type": "solid",
                           "width_mm": self._snap_width(max(h, 100) / HWPUNIT_PER_MM),
                           "color": d["fill"]}
            elif d and d["sides"].get("bottom") != "none":
                out[ci] = d["sides"]["bottom"]
            elif d and d["sides"].get("top") != "none":
                out[ci] = d["sides"]["top"]
        return out

    def _rule_rows(self, t):
        """(B) 얇은 색 채운 행 = 선. 텍스트 행 index와 열별 아래/위 테두리 override를 준다.
        행 높이가 선 수준이면 잔여 텍스트(1pt 공백 등)가 있어도 선으로 취급한다."""
        text_rows = [i for i, row in enumerate(t["texts"])
                     if any(x for x in row) and not self._is_rule_row(t, i)]
        main = text_rows[0] if text_rows else 0
        below, above = {}, {}
        for ri in range(main + 1, len(t["texts"])):        # 아래쪽 → 밑줄
            if not self._is_rule_row(t, ri):
                if any(x for x in t["texts"][ri]):
                    break
                continue
            for ci, spec in self._rule_of(t, ri).items():
                below.setdefault(ci, spec)
        for ri in range(main - 1, -1, -1):                 # 위쪽 → 윗줄
            if not self._is_rule_row(t, ri):
                break
            for ci, spec in self._rule_of(t, ri).items():
                above.setdefault(ci, spec)
        return main, below, above

    NO_FILL = "__none__"

    def _cell_style_from(self, decos, override_bottom=None, override_top=None, text_colors=None):
        """여러 셀의 장식에서 대표 스타일(fill + borders + 글자색)을 만든다."""
        if not decos:
            return None
        fill = self._modal([(d["fill"] or self.NO_FILL) for d in decos if d])
        if fill == self.NO_FILL:
            fill = None
        borders = {}
        for side in ("top", "bottom", "left", "right"):
            borders[side] = self._modal([d["sides"][side] for d in decos if d]) or "none"
        if override_bottom is not None:
            borders["bottom"] = override_bottom
        if override_top is not None:
            borders["top"] = override_top
        # 4면이 모두 같으면 all로 접는다
        vals = list(borders.values())
        if all(v == vals[0] for v in vals):
            borders = {"all": vals[0]}
        out = {"fill": fill, "borders": borders}
        tc = self._modal([c for c in (text_colors or []) if c])
        if tc:
            out["text_color"] = tc
        return out

    def cell_styles(self):
        """역할별 셀 장식을 원본에서 추출한다."""
        out = {}
        banners = self._banner_tables()
        by_kind = {}
        for kind, t in banners:
            by_kind.setdefault(kind, []).append(t)
        # 배너를 크기 순으로 h1, h2에 배정 (headings()와 같은 기준)
        ranked = sorted(by_kind.items(),
                        key=lambda kv: -max(c.get("size", 0) for t in kv[1]
                                            for row in t["cell_cs"] for c in row))
        for lvl, (kind, ts) in zip(("h1", "h2"), ranked[:2]):
            t = max(ts, key=lambda x: x["rows"])
            main, ov, ovt = self._rule_rows(t)
            row_bf = t["bfids"][main] if main < len(t["bfids"]) else []
            row_cs = t["cell_cs"][main] if main < len(t["cell_cs"]) else []
            for ci, key in ((0, f"banner_{lvl}_num"), (1, f"banner_{lvl}_title")):
                if ci >= len(row_bf):
                    continue
                d = self._deco(row_bf[ci])
                tcol = [row_cs[ci].get("color")] if ci < len(row_cs) else []
                st = self._cell_style_from([d], override_bottom=ov.get(ci),
                                           override_top=ovt.get(ci), text_colors=tcol)
                if st:
                    out[key] = st
            self.evidence[f"cell_styles.banner_{lvl}"] = (
                f"텍스트 행 {main} · 밑줄로 정규화한 열 {sorted(ov)} "
                f"({', '.join(f'{c}:{v["color"]}@{v["width_mm"]}mm' for c, v in sorted(ov.items()))})"
                if ov else f"텍스트 행 {main} · 밑줄 채운 행 없음")

        data = [t for t in self.tables if t["cols"] >= 3 and not t["nested"]]
        if data:
            hdr, body, iv, ih = [], [], [], []
            for t in data:
                for ci, bid in enumerate(t["bfids"][0]):
                    hdr.append(self._deco(bid))
                for ri in range(1, len(t["bfids"])):
                    for ci, bid in enumerate(t["bfids"][ri]):
                        d = self._deco(bid)
                        body.append(d)
                        if d and ci < len(t["bfids"][ri]) - 1:
                            iv.append(d["sides"]["right"])
                        if d and ri < len(t["bfids"]) - 1:
                            ih.append(d["sides"]["bottom"])
            hdr_tc = [c.get("color") for t in data for c in (t["cell_cs"][0] if t["cell_cs"] else [])]
            st = self._cell_style_from(hdr, text_colors=hdr_tc)
            if st:
                out["table_header"] = st
            st = self._cell_style_from(body)
            if st:
                mv, mh = self._modal(iv), self._modal(ih)
                if mv:
                    st["borders"] = dict(st["borders"], inner_vert=mv)
                if mh:
                    st["borders"] = dict(st["borders"], inner_horz=mh)
                out["table_body"] = st
            self.evidence["cell_styles.table"] = (
                f"데이터표 {len(data)}개에서 헤더 {len(hdr)}셀·본문 {len(body)}셀 집계 "
                f"(내부 세로선 {self._modal(iv)}, 가로선 {self._modal(ih)})")

        # 박스: 후보 표 전체에서 최빈값을 취한다. 한 표만 보면 그 표의 우연한 배경색이
        # 양식 전체의 규칙으로 굳어버린다.
        first = self.tables[0] if self.tables else None
        boxes = [t for t in self.tables
                 if t["cols"] == 1 and not t["nested"] and t["rows"] <= 4 and t is not first]
        if boxes:
            decos, tops, bots = [], [], []
            for t in boxes:
                main, ov, ovt = self._rule_rows(t)
                if not t["bfids"] or main >= len(t["bfids"]) or not t["bfids"][main]:
                    continue
                decos.append(self._deco(t["bfids"][main][0]))
                tops.append(ovt.get(0))
                bots.append(ov.get(0))
            st = self._cell_style_from(decos, override_bottom=self._modal(bots),
                                       override_top=self._modal(tops))
            if st:
                out["box"] = st
            self.evidence["cell_styles.box"] = f"박스 후보 {len(boxes)}개에서 최빈 장식 채택"
        # 표지 제목: 문서 첫 표를 별도로 본다
        if first and first["cols"] == 1:
            m2, ov2, ovt2 = self._rule_rows(first)
            d2 = self._deco(first["bfids"][m2][0]) if first["bfids"] and first["bfids"][m2] else None
            st2 = self._cell_style_from([d2], override_bottom=ov2.get(0), override_top=ovt2.get(0))
            if st2:
                out["cover_title"] = st2
        self.confidence["cell_styles"] = "high" if out else "low"
        return out

    def _bf_fill(self, bf_id):
        """borderfill-id는 1-based (0-based로 읽으면 색이 한 칸씩 밀린다)."""
        if not bf_id:
            return None
        i = int(bf_id) - 1
        if not (0 <= i < len(self.borderfills)):
            return None
        fc = self.borderfills[i].find("FillColorPattern")
        return fc.get("background-color") if fc is not None else None

    @staticmethod
    def _depth(el):
        d, p = 0, el.getparent()
        while p is not None:
            if p.tag == "TableCell":
                d += 1
            p = p.getparent()
        return d

    def _collect(self):
        self.paras = []
        for el in self.root.iter("Paragraph"):
            txt = "".join(t.text or "" for t in el.iter("Text")).strip()
            if not txt:
                continue
            cid = next((t.get("charshape-id") for t in el.iter("Text")), None)
            self.paras.append({"text": txt, "depth": self._depth(el),
                               "cs": self._cs(cid), "ps": self._ps(el.get("parashape-id"))})

        self.tables = []
        for tb in self.root.iter("TableControl"):
            body = tb.find("TableBody")
            if body is None:
                continue
            rows = body.findall("TableRow")
            grid = [rw.findall("TableCell") for rw in rows]
            texts = [["".join(t.text or "" for t in c.iter("Text")).strip() for c in rw] for rw in grid]
            bfids = [[c.get("borderfill-id") for c in rw] for rw in grid]
            heights = [min((int(c.get("height", 0)) for c in rw), default=0) for rw in grid]
            self.tables.append({
                "w": int(tb.get("width", 0)),
                "rows": len(rows), "cols": int(body.get("cols", 0)),
                "cols_per_row": [len(r) for r in grid],
                "cell_w": [int(c.get("width", 0)) for c in grid[0]] if grid else [],
                "fills": [self._bf_fill(c.get("borderfill-id")) for c in grid[0]] if grid else [],
                "cell_cs": [[self._cs(next((t.get("charshape-id") for t in c.iter("Text")), None))
                             for c in rw] for rw in grid],
                "texts": texts,
                "pad_tb": max(int(body.get("padding-top", 0)), int(body.get("padding-bottom", 0))),
                "bfids": bfids,
                "heights": heights,
                "pad_lr": int(body.get("padding-left", 0)) + int(body.get("padding-right", 0)),
                "nested": self._depth(tb) > 0,
                "merged": len(set(len(r) for r in grid)) > 1,
            })

    # ── 추론 ──────────────────────────────────────────────────────────
    def page(self):
        pd = next(self.root.iter("PageDef"))
        g = {k: int(pd.get(v)) for k, v in [
            ("paper_w", "width"), ("paper_h", "height"),
            ("margin_left", "left-offset"), ("margin_right", "right-offset"),
            ("margin_top", "top-offset"), ("margin_bottom", "bottom-offset"),
            ("header_len", "header-offset"), ("footer_len", "footer-offset")]}
        g["body_width"] = g["paper_w"] - g["margin_left"] - g["margin_right"]
        g["table_safety"] = 500
        pos = next(self.root.iter("PageNumberPosition"), None)
        g["page_number"] = (pos.get("position") if pos is not None else "none") or "none"
        if g["page_number"] not in ("bottom_center", "bottom_right", "top_right", "none"):
            g["page_number"] = "bottom_center"
        g["para_right_pad"] = 800
        g["line_spacing"] = 160
        g["break_word_unit"] = True
        self.confidence["page"] = "high"
        self.evidence["page"] = (f"용지 {mm(g['paper_w'])}×{mm(g['paper_h'])}mm, "
                                 f"여백 좌우 {mm(g['margin_left'])}/{mm(g['margin_right'])}mm, "
                                 f"본문 폭 {mm(g['body_width'])}mm, 쪽번호 {g['page_number']}")
        return g

    def font(self):
        c = Counter(p["cs"].get("face") for p in self.paras if p["cs"].get("face"))
        top = [f for f, _ in c.most_common(3)]
        primary = top[0] if top else "맑은 고딕"
        fb = [f for f in ["맑은 고딕", "함초롬돋움", "굴림"] if f != primary]
        self.confidence["font"] = "high" if c and c.most_common(1)[0][1] > sum(c.values()) * 0.6 else "medium"
        self.evidence["font"] = f"글꼴 사용 분포 {dict(c.most_common(3))} → 주 글꼴 '{primary}'"
        if len(c) > 1:
            self.unsupported_note(f"원본이 글꼴 {len(c)}종 혼용 (주 글꼴 1종으로 통일해 생성)")
        return {"primary": primary, "fallback": fb}

    def unsupported_note(self, s):
        if s not in self.unsupported:
            self.unsupported.append(s)

    def _banner_tables(self):
        """제목 배너로 보이는 표: 2칸, 1~3행, 첫 칸이 좁고 그 안이 번호."""
        out = []
        for t in self.tables:
            if t["cols"] != 2 or t["rows"] > 3 or not t["cell_w"]:
                continue
            if t["cell_w"][0] > 6000:
                continue
            head = (t["texts"][0][0] if t["texts"] and t["texts"][0] else "").strip()
            kind = None
            if head and head[0] in ROMAN:
                kind = "roman"
            elif re.fullmatch(r"\d{1,2}", head):
                kind = "arabic"
            elif re.fullmatch(r"\d{1,2}\.", head):
                kind = "arabic_dot"
            elif head and head[0] in HANGUL_ORD and head.endswith("."):
                kind = "hangul_dot"
            if kind:
                out.append((kind, t))
        return out

    def headings(self, page):
        banners = self._banner_tables()
        by_kind = defaultdict(list)
        for kind, t in banners:
            by_kind[kind].append(t)

        # 문단으로 된 제목 후보: 'n.' 또는 '가.' 로 시작하고 굵은 편
        para_titles = defaultdict(list)
        for p in self.paras:
            if p["depth"] > 0:
                continue
            m = re.match(r"^(\d{1,2}\.|[가-하]\.)\s+\S", p["text"])
            if m:
                kind = "arabic_dot" if m.group(1)[0].isdigit() else "hangul_dot"
                para_titles[kind].append(p)

        # 기호형 제목 후보: 최상위 문단에서 같은 기호로 2회 이상, 본문보다 크고 굵게 시작
        body_size = Counter(p["cs"].get("size") for p in self.paras
                            if p["cs"].get("size")).most_common(1)
        body_size = body_size[0][0] if body_size else 10.0
        sym_heads = defaultdict(list)
        top_paras = [p for p in self.paras if p["depth"] == 0]
        for p in top_paras:
            t = p["text"]
            if t and t[0] in SYMBOL_HEAD_CHARS and len(t) > 2:
                if p["cs"].get("size", 0) >= body_size + 0.5 and p["cs"].get("bold"):
                    sym_heads[t[0]].append(p)
        sym_heads = {k: v for k, v in sym_heads.items() if len(v) >= 2}
        # 제목 기호와 본문 불릿 기호를 가른다: 불릿은 뒤에 하위 불릿이 따라오고(□ 뒤 ∙),
        # 제목은 표나 일반 문단이 따라온다(❒ 뒤 표). 최상위 문단 순서로 후속을 센다.
        idx_of = {id(p): i for i, p in enumerate(top_paras)}
        confirmed = {}
        for sym, ps in sym_heads.items():
            # 판별 1 — 제목은 표 셀 안에 살지 않는다. 같은 기호가 셀 안에서도
            # 반복되면(강조박스 속 □ 등) 그것은 본문 불릿이다.
            inside = sum(1 for p in self.paras
                         if p["depth"] > 0 and p["text"][:1] == sym)
            if inside >= 2:
                self.evidence[f"symbol.{sym}"] = (
                    f"'{sym}' 는 표/박스 안에서 {inside}회 사용 → 제목이 아니라 본문 불릿으로 판정")
                continue
            # 판별 2 — 불릿은 뒤에 하위 불릿이 따라온다
            followed_by_bullet = 0
            occurrences = [p for p in top_paras if p["text"][:1] == sym]
            for p in occurrences:
                i = idx_of[id(p)]
                if i + 1 < len(top_paras):
                    nt = top_paras[i + 1]["text"]
                    if nt and nt[0] in BULLET_CHARS and nt[0] != sym:
                        followed_by_bullet += 1
            ratio = followed_by_bullet / max(len(occurrences), 1)
            if ratio < 0.4:            # 뒤에 하위 불릿이 거의 없으면 제목
                confirmed[sym] = ps
            else:
                self.evidence[f"symbol.{sym}"] = (
                    f"'{sym}' 는 후속의 {ratio:.0%}가 하위 불릿 → 제목이 아니라 본문 불릿으로 판정")
        sym_heads = confirmed
        self.heading_symbols = set(sym_heads)   # 사다리에서 제외할 기호

        levels = {}
        # 배너 종류를 크기 내림차순으로 h1, h2에 배정
        ranked = sorted(by_kind.items(),
                        key=lambda kv: -max(c.get("size", 0) for t in kv[1] for row in t["cell_cs"] for c in row))
        order = ["h1", "h2", "h3"]
        used = 0
        for kind, ts in ranked[:2]:
            t = max(ts, key=lambda x: x["rows"])
            sizes = [c["size"] for row in t["cell_cs"] for c in row if c.get("size")]
            bolds = [c["bold"] for row in t["cell_cs"] for c in row if c.get("size")]
            lvl = order[used]
            levels[lvl] = {
                "impl": "banner_table",
                "marker": kind,
                "size": max(sizes) if sizes else 12.0,
                "bold": bool(bolds and sum(bolds) / len(bolds) > 0.5),
                "num_cell_w": t["cell_w"][0],
                "width": "body" if abs(t["w"] - page["body_width"]) < 2500 else t["w"],
                "space_above": 11.0 if lvl == "h1" else 9.0,
            }
            self.evidence[f"headings.{lvl}"] = (
                f"배너표 {len(ts)}개 · 번호칸 {mm(t['cell_w'][0])}mm · 표폭 {mm(t['w'])}mm · "
                f"{levels[lvl]['size']}pt · 번호형식 {kind}")
            used += 1

        # 기호형 제목을 크기 순으로 남는 레벨에 배정
        for sym, ps in sorted(sym_heads.items(),
                              key=lambda kv: -max(p["cs"].get("size", 0) for p in kv[1])):
            if used >= 3:
                break
            lvl = order[used]
            sizes = Counter(p["cs"]["size"] for p in ps if p["cs"].get("size"))
            levels[lvl] = {
                "impl": "paragraph",
                "marker": "symbol",
                "symbol": sym,
                "size": sizes.most_common(1)[0][0] if sizes else 12.0,
                "bold": True,
                "left": 0, "indent": 0, "space_above": 9.0,
            }
            self.confidence[f"headings.{lvl}"] = "high"
            self.evidence[f"headings.{lvl}"] = (
                f"기호형 제목 '{sym}' {len(ps)}회 · {levels[lvl]['size']}pt · 굵게 "
                f"(본문 {body_size}pt보다 큼)")
            used += 1

        # 남은 레벨은 문단 제목으로 채운다
        for kind, ps in sorted(para_titles.items(), key=lambda kv: -len(kv[1])):
            if used >= 3:
                break
            lvl = order[used]
            sizes = Counter(p["cs"]["size"] for p in ps if p["cs"].get("size"))
            bolds = [p["cs"]["bold"] for p in ps]
            levels[lvl] = {
                "impl": "paragraph",
                "marker": kind,
                "size": sizes.most_common(1)[0][0] if sizes else 11.5,
                "bold": bool(bolds and sum(bolds) / len(bolds) > 0.5),
                "left": 0, "indent": 0, "space_above": 0,
            }
            self.evidence[f"headings.{lvl}"] = f"문단 제목 {len(ps)}회 · {levels[lvl]['size']}pt · 형식 {kind}"
            used += 1

        # 부족하면 합리적 기본값으로 메운다 (신뢰도 낮음)
        defaults = {
            "h1": {"impl": "paragraph", "marker": "roman", "size": 14.0, "bold": True,
                   "left": 0, "indent": 0, "space_above": 11.0},
            "h2": {"impl": "paragraph", "marker": "arabic_dot", "size": 12.0, "bold": True,
                   "left": 0, "indent": 0, "space_above": 9.0},
            "h3": {"impl": "paragraph", "marker": "arabic_paren", "size": 11.0, "bold": True,
                   "left": 0, "indent": 0, "space_above": 0},
        }
        for lvl in order:
            if lvl not in levels:
                levels[lvl] = defaults[lvl]
                self.confidence[f"headings.{lvl}"] = "low"
                self.evidence[f"headings.{lvl}"] = "원본에서 이 레벨의 제목을 찾지 못해 기본값 사용 — 확인 필요"
            else:
                self.confidence.setdefault(f"headings.{lvl}", "medium" if levels[lvl]["impl"] == "paragraph" else "high")
        return levels

    def ladder(self):
        """본문 머리기호를 빈도·크기·들여쓰기로 레벨 정렬한다."""
        stat = defaultdict(lambda: {"n": 0, "sizes": Counter(), "bold": Counter(),
                                    "left": Counter(), "indent": Counter()})
        head_syms = getattr(self, "heading_symbols", set())
        for p in self.paras:
            t = p["text"]
            if not t or t[0] not in BULLET_CHARS:
                continue
            if t[0] in CONCLUSION_CHARS or t[0] in NOTE_CHARS or t[0] in head_syms:
                continue
            s = stat[t[0]]
            s["n"] += 1
            s["sizes"][p["cs"].get("size")] += 1
            s["bold"][p["cs"].get("bold")] += 1
            s["left"][p["ps"].get("left", 0)] += 1
            s["indent"][p["ps"].get("indent", 0)] += 1

        total_n = sum(v["n"] for v in stat.values())
        floor = max(3, int(total_n * 0.05))       # 전체의 5% 미만은 편집 노이즈로 본다
        cands = [kv for kv in sorted(stat.items(), key=lambda kv: -kv[1]["n"])
                 if kv[1]["n"] >= floor][:5]
        if not cands:
            cands = sorted(stat.items(), key=lambda kv: -kv[1]["n"])[:4]
        if not cands:
            self.confidence["ladder"] = "low"
            self.evidence["ladder"] = "본문 머리기호를 찾지 못해 기본 사다리(□ ∙ → -) 사용 — 확인 필요"
            return [
                {"marker": "□", "size": 11.0, "bold": True, "left": 0, "indent": -3300},
                {"marker": "∙", "size": 11.0, "bold": False, "left": 3300, "indent": -3300},
                {"marker": "→", "size": 11.0, "bold": False, "left": 6600, "indent": -3300},
                {"marker": "-", "size": 9.5, "bold": False, "left": 9900, "indent": -2850},
            ]

        # 레벨 순서는 **부모 추정 트리**로 복원한다.
        #  - 자식은 부모 바로 뒤에 오므로 '바로 앞에 가장 자주 오는 기호'가 부모다.
        #  - 다만 하위 항목 뒤에 새 블록이 상위 기호로 시작하는 전이가 순환을 만들기 때문에,
        #    루트는 인접이 아니라 '가장 크고 굵은 기호'로 정하고 거기서부터 트리를 내려간다.
        #  - 들여쓰기는 편집 흔적이 섞여 신뢰하지 않는다.
        marks = [mk for mk, _ in cands]
        stat_of = dict(cands)
        sizes_of = {mk: (stat_of[mk]["sizes"].most_common(1)[0][0] or 0) for mk in marks}
        bold_of = {mk: stat_of[mk]["bold"][True] / max(stat_of[mk]["n"], 1) for mk in marks}
        seq = [p["text"][0] for p in self.paras if p["text"] and p["text"][0] in set(marks)]
        prev_of = {mk: Counter() for mk in marks}
        for a, b in zip(seq, seq[1:]):
            if a != b:
                prev_of[b][a] += 1

        root = max(marks, key=lambda m: (sizes_of[m], bold_of[m], stat_of[m]["n"]))
        level = {root: 1}
        parents = {}
        for _ in range(len(marks)):
            for mk in marks:
                if mk in level:
                    continue
                placed = [(n, a) for a, n in prev_of[mk].items() if a in level]
                if placed:
                    n, par = max(placed)
                    level[mk] = level[par] + 1
                    parents[mk] = par
        for mk in sorted((m for m in marks if m not in level),
                         key=lambda m: (-sizes_of[m], -stat_of[m]["n"])):
            level[mk] = max(level.values(), default=0) + 1
        # 같은 레벨이 겹치면 작은 글자를 아래 레벨로 밀어 1레벨 1기호를 유지한다
        ordered = []
        for mk in sorted(marks, key=lambda m: (level[m], -sizes_of[m], -stat_of[m]["n"])):
            ordered.append((mk, stat_of[mk]))
        self.evidence["ladder_order"] = (
            f"루트 {root}(가장 크고 굵음) · 부모 추정 " +
            ", ".join(f"{c}←{p}" for c, p in parents.items()) +
            " · 레벨 " + ", ".join(f"{m}:{level[m]}" for m in marks))
        out, ev = [], []
        for i, (mk, s) in enumerate(ordered):
            size = s["sizes"].most_common(1)[0][0] or 11.0
            hang = int(round(size * 100 * 1.5 / 100) * 100) * 2  # 기호폭 ≈ 1.5자 → 2배 스케일
            hang = max(hang, 2000)
            out.append({
                "marker": mk, "size": size,
                "bold": s["bold"][True] / max(s["n"], 1) > 0.5,
                "left": i * hang, "indent": -hang,
            })
            ev.append(f"{mk} {s['n']}회 {size}pt")
        self.confidence["ladder"] = "medium"
        self.evidence["ladder"] = " · ".join(ev) + \
            f"  (빈도 {floor}회 미만 제외, 크기·굵기·빈도로 레벨 정렬 — 순서 확인 필요)"
        return out

    def special(self):
        out = {}
        for p in self.paras:
            t = p["text"]
            if t and t[0] in CONCLUSION_CHARS and "conclusion" not in out:
                out["conclusion"] = {
                    "marker": t[0], "size": p["cs"].get("size", 11.0),
                    "bold": bool(p["cs"].get("bold")),
                    "color": "emphasis" if p["cs"].get("color") not in (None, "#000000") else "text",
                    "left": 3300, "indent": -3300, "max_chars": 44,
                }
            if t and t[0] in NOTE_CHARS and "note" not in out:
                out["note"] = {"marker": t[0], "size": p["cs"].get("size", 9.0),
                               "left": 3300, "indent": -2700}
        if any(t["text"][0] in ENUM_CHARS for t in self.paras if t["text"]):
            out["enum_markers"] = ENUM_CHARS[:9]
        self.confidence["special"] = "medium" if out else "low"
        self.evidence["special"] = ("결론 기호 " + out.get("conclusion", {}).get("marker", "없음") +
                                    " · 각주 기호 " + out.get("note", {}).get("marker", "없음"))
        return out

    def palette(self, styles):
        """색은 cell_styles에서 이미 역할별로 뽑았다. palette는 그 요약 + 강조색만 담는다."""
        pal = {}
        for key, role in (("banner_num_bg", "banner_h2_num"), ("banner_num_fg", "banner_h2_num"),
                          ("banner_title_fg", "banner_h1_title"),
                          ("table_header_bg", "table_header")):
            st = styles.get(role) or {}
            if key.endswith("_bg") and st.get("fill"):
                pal[key] = st["fill"]
            if key.endswith("_fg") and st.get("text_color"):
                pal[key] = st["text_color"]
        cols = Counter(p["cs"].get("color") for p in self.paras
                       if p["cs"].get("color") not in (None, "#000000", "#ffffff"))
        pal["emphasis"] = cols.most_common(1)[0][0] if cols else "#0000ff"
        self.confidence["palette"] = "high" if pal.get("table_header_bg") else "medium"
        self.evidence["palette"] = (f"배너 번호칸 배경 {pal.get('banner_num_bg', '없음')} · "
                                    f"번호칸 글자색 {pal.get('banner_num_fg', '없음')} · "
                                    f"표 헤더 음영 {pal.get('table_header_bg', '없음')} · "
                                    f"강조색 {pal['emphasis']} ({dict(cols.most_common(2))})")
        return pal

    def table_style(self):
        data = [t for t in self.tables if t["cols"] >= 3 and not t["nested"]]
        hsize = Counter()
        bsize = Counter()
        for t in data:
            for c in (t["cell_cs"][0] if t["cell_cs"] else []):
                if c.get("size"):
                    hsize[c["size"]] += 1
            for row in t["cell_cs"][1:]:
                for c in row:
                    if c.get("size"):
                        bsize[c["size"]] += 1
        pads = Counter(t["pad_lr"] for t in data) or Counter({1020: 1})
        maxcols = max((t["cols"] for t in data), default=8)
        cap = self._caption_pos()
        if any(t["merged"] for t in data):
            self.unsupported_note(f"셀 병합 (데이터표 {sum(1 for t in data if t['merged'])}개가 사용) — 렌더러 미지원")
        if any(t["nested"] for t in self.tables):
            self.unsupported_note("중첩표 — 재현하지 않는다(R2)")
        if next(self.root.iter("ShapeComponent"), None) is not None:
            self.unsupported_note("그림·도형 삽입 — 렌더러 미지원")
        if next(self.root.iter("ColumnsDef"), None) is not None:
            cd = next(self.root.iter("ColumnsDef"))
            if int(cd.get("count", 1)) > 1:
                self.unsupported_note(f"다단({cd.get('count')}단) — 렌더러 미지원")
        self.confidence["table"] = "high" if data else "low"
        self.evidence["table"] = (f"데이터표 {len(data)}개 · 헤더 {hsize.most_common(1)}"
                                  f" · 본문 {bsize.most_common(1)} · 셀여백 {pads.most_common(1)}"
                                  f" · 최대 {maxcols}열")
        return {
            "header_size": hsize.most_common(1)[0][0] if hsize else 9.5,
            "header_bold": True,
            "header_align": "center",
            "header_repeat": True,
            "body_size": bsize.most_common(1)[0][0] if bsize else 9.5,
            "padding_lr": pads.most_common(1)[0][0],
            "padding_tb": self._padding_tb(),
            "vert_align": "center",
            "max_cols": min(max(maxcols, 4), 8),
            "caption_pos": cap,
            "caption_size": 10.0,
            "note_size": 9.0,
            "title_marker": "◇",
            "box": {"width": "body"},
        }

    def _padding_tb(self):
        """원본의 셀 위·아래 여백. 한글 기본 141은 9~10pt 글자에서 글자가 괘선에 붙으므로
        원본이 기본값이면 최소 여유(240)까지 올린다."""
        from collections import Counter as _C
        c = _C(t["pad_tb"] for t in self.tables if t["cols"] >= 3)
        v = c.most_common(1)[0][0] if c else 141
        if v <= 150:
            self.evidence["padding_tb"] = f"원본 {v}(한글 기본값) → 가독을 위해 240으로 올림"
            return 240
        self.evidence["padding_tb"] = f"원본 실측 {v}"
        return v

    def _caption_pos(self):
        for p in self.paras:
            if re.match(r"^\[?단위\s*[:：]", p["text"]):
                al = p["ps"].get("align")
                return "above_left" if al in ("left", "justify", None) else "above_right"
        return "above_right"

    def cover(self):
        """문서 앞부분(첫 표/제목 블록)에서 표지 구성을 읽는다."""
        head = self.paras[:8]
        biggest = max((p for p in head if p["cs"].get("size")),
                      key=lambda p: p["cs"]["size"], default=None)
        title_boxed = False
        if self.tables:
            t0 = self.tables[0]
            has_text = any(x for row in t0["texts"] for x in row)
            if t0["cols"] == 1 and has_text:
                title_boxed = True
        order, date_fmt = [], "( {date} )"
        for p in head:
            t = p["text"]
            if re.match(r"^\(?\s*\d{4}[.\-]\s?\d{1,2}", t):
                order.append("date")
                date_fmt = "( {date} )" if t.strip().startswith("(") else "{date}"
            elif re.search(r"(부|팀|실|과|본부|센터)$", t) and len(t) <= 20:
                order.append("dept")
        order = ["title"] + [o for o in order if o]
        if "date" not in order:
            order.append("date")
        if "dept" not in order:
            order.append("dept")
        self.confidence["cover"] = "medium"
        self.evidence["cover"] = (f"제목 {'표 안' if title_boxed else '문단'} · "
                                  f"{biggest['cs']['size'] if biggest else '?'}pt · 순서 {order}")
        return {
            "title": {"impl": "boxed" if title_boxed else "paragraph",
                      "size": biggest["cs"]["size"] if biggest else 16.0,
                      "bold": bool(biggest and biggest["cs"].get("bold")),
                      "align": "center", "width": "body"},
            "date": {"size": 11.0, "bold": False, "align": "center"},
            "dept": {"size": 11.0, "bold": True, "align": "center"},
            "order": order,
            "date_format": date_fmt,
        }

    # ── 조립 ──────────────────────────────────────────────────────────
    def build(self, name):
        page = self.page()
        headings = self.headings(page)
        styles = self.cell_styles()
        tpl = {
            "name": name,
            "source": str(self.path),
            "page": page,
            "font": self.font(),
            "palette": self.palette(styles),
            "headings": headings,
            "ladder": self.ladder(),
            "special": self.special(),
            "table": self.table_style(),
            "cover": self.cover(),
            "cell_styles": styles,
        }
        tpl["confidence"] = self.confidence
        tpl["unsupported"] = self.unsupported
        return tpl, self.evidence


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hwp")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--name")
    ap.add_argument("--json", action="store_true", help="템플릿 전문을 stdout에도 출력")
    a = ap.parse_args()

    src = Path(a.hwp)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    ex = Extractor(src, out.parent)
    tpl, ev = ex.build(a.name or out.stem)
    out.write_text(json.dumps(tpl, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"양식 추출: {src.name} → {out}")
    print(f"\n[추론 근거]")
    for k, v in ev.items():
        print(f"  {k:16s} {v}")
    print(f"\n[신뢰도]  (low = 사람 확인 필요)")
    for k, v in sorted(tpl["confidence"].items(), key=lambda kv: kv[1]):
        print(f"  {v:8s} {k}")
    low = [k for k, v in tpl["confidence"].items() if v == "low"]
    if tpl["unsupported"]:
        print(f"\n[미지원 요소]")
        for u in tpl["unsupported"]:
            print(f"  - {u}")
    if low:
        print(f"\n⚠ 확인이 필요한 항목: {', '.join(low)}")
    if a.json:
        print("\n" + json.dumps(tpl, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
