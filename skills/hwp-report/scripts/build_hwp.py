"""
build_hwp.py — 문서 모델(doc.json) + 양식 템플릿(template.json) → 한글 문서(.hwp)

이 렌더러는 **양식을 모른다.** 계층 기호·크기·색·배너 치수·여백은 전부 템플릿이 정한다.
따라서 같은 doc.json을 다른 템플릿으로 렌더하면 다른 양식의 문서가 나온다.

  doc.json      : 무엇을 쓸지 (의미)      ← LLM이 작성
  template.json : 어떻게 그릴지 (형식)    ← hwp-template-extractor가 추출
  build_hwp.py  : 둘을 합쳐 한글로 그림

사용:
    python build_hwp.py doc.json out.hwp --template <양식이름> [--pdf out.pdf] [--kill-stale]

전제: 이 PC에 한글(HWPFrame.HwpObject COM)이 설치돼 있어야 한다.
구현 함정은 references/HWP_SCHEME.md §6 참조 — 이 파일은 그 대응을 그대로 담고 있다.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import win32com.client.dynamic as dyn

PT = 100                     # 글자 크기 1pt = 100
# 표 생성 시 한글이 ColWidth에 더하는 셀 좌우 여백(기본 510×2).
# 템플릿의 padding_lr(원본 문서의 셀 여백)과는 무관한 **생성 시점 상수**다 — 함정 #2.
CELL_PAD_AT_CREATE = 1020
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
ALIGN = {"justify": 0, "left": 1, "right": 2, "center": 3}
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

ROMAN = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ"
# 한글 테두리 굵기 열거값 (mm)
BORDER_WIDTHS = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]
LINE_TYPES = {"none": "None", "solid": "Solid", "dot": "Dot", "dash": "Dash",
              "dashdot": "DashDot", "double": "Double", "thick": "Solid"}
HANGUL = "가나다라마바사아자차카타파하"


# ── 템플릿 ────────────────────────────────────────────────────────────
def load_template(ref: str) -> dict:
    p = Path(ref)
    if not p.exists():
        p = TEMPLATE_DIR / (ref if ref.endswith(".json") else f"{ref}.json")
    if not p.exists():
        avail = ", ".join(sorted(x.stem for x in TEMPLATE_DIR.glob("*.json"))) or "(없음)"
        raise SystemExit(f"양식 템플릿을 찾을 수 없습니다: {ref}\n사용 가능: {avail}")
    return json.loads(p.read_text(encoding="utf-8"))


def hexrgb(h, default=BLACK):
    if not h:
        return default
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def fmt_num(kind: str, n: int) -> str:
    """번호 표기 방식은 양식이 정한다. n은 1부터."""
    if kind == "roman":
        return f"{ROMAN[min(n, 10) - 1]}."
    if kind == "arabic":
        return str(n)
    if kind == "arabic_dot":
        return f"{n}."
    if kind == "arabic_paren":
        return f"{n})"
    if kind == "hangul_dot":
        return f"{HANGUL[min(n, 14) - 1]}."
    return ""


def stale_hwp_pids():
    """이미 떠 있는 한글 프로세스. Dispatch는 새 인스턴스를 만들지 않고 기존 것에 붙기 때문에
    앞선 실행이 남긴 인스턴스가 있으면 빈 문서 상태로 멈춘다(함정 #12)."""
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq Hwp.exe", "/NH"],
                             capture_output=True, text=True, timeout=20).stdout
        return [ln.split()[1] for ln in out.splitlines() if ln.strip().lower().startswith("hwp.exe")]
    except Exception:  # noqa: BLE001
        return []


# ── 렌더러 ────────────────────────────────────────────────────────────
class HwpDoc:
    def __init__(self, tpl: dict, visible=False, font=None, kill_stale=False):
        self.tpl = tpl
        self.pg = tpl["page"]
        self.pal = tpl.get("palette", {})
        self.tb = tpl["table"]
        self.sp = tpl.get("special", {})
        self.ladder = tpl["ladder"]
        self.body_width = self.pg["body_width"]
        self.table_max = self.body_width - self.pg.get("table_safety", 500)
        self.cell_pad = self.tb.get("padding_lr", 1020)
        self.pad_tb = self.tb.get("padding_tb")
        # 셀 상하 여유(함정 #19, 실측 결론):
        #  - 셀 안 여백(MarginTop/Bottom)·문단 아래 간격·줄간격 종류·셀 높이·세로정렬은
        #    전부 행 높이에 반영되지 않는다.
        #  - 유일하게 동작하는 손잡이는 **문단 위 간격(PrevSpacing)** 이다.
        #  - 아래쪽 bbox 여백은 ~0.9pt로 고정되지만 글꼴 디센더 영역이라 시각적 여백은 더 크다.
        self.cell_space_above = max((self.pad_tb or 141) - 141, 0) * 2   # 2배 스케일
        self.vert_align = self.tb.get("vert_align", "center")
        self.right_pad = self.pg.get("para_right_pad", 0)
        self.spacing = self.pg.get("line_spacing", 160)
        self.emphasis = hexrgb(self.pal.get("emphasis"), (0, 0, 255))
        self.warnings: list[str] = []
        self.prev_block = None
        self.counters = {"h1": 0, "h2": 0, "h3": 0}

        stale = stale_hwp_pids()
        if stale and kill_stale:
            subprocess.run(["taskkill", "/IM", "Hwp.exe", "/F"], capture_output=True)
            stale = []
        self.hwp = dyn.Dispatch("HWPFrame.HwpObject")                    # 함정 #5
        self.hwp.RegisterModule("FilePathCheckDLL", "FilePathChecker")   # 함정 #6
        for mode in (0x00020000, 0x00000020):
            try:
                self.hwp.SetMessageBoxMode(mode)
                break
            except Exception:  # noqa: BLE001
                continue
        try:
            self.hwp.XHwpWindows.Item(0).Visible = bool(visible)
        except Exception:  # noqa: BLE001
            pass
        self.hwp.HAction.Run("FileNew")
        if stale:
            self.warnings.append(
                f"실행 전부터 한글 프로세스 {len(stale)}개가 떠 있었습니다 — 멈추면 종료 후 재시도"
                " (--kill-stale 제공)")
        self.font = self._resolve_font(font or tpl["font"]["primary"])
        self._page_setup()
        self._page_number()

    # ── 기반 ──────────────────────────────────────────────────────────
    def _run(self, action):
        return self.hwp.HAction.Run(action)

    def _rgb(self, t):
        return self.hwp.RGBColor(*t)

    def _resolve_font(self, preferred):
        """미설치 글꼴을 지정하면 CharShape 자체가 실패한다(함정 #4). 적용해 보고 고른다."""
        for face in [preferred] + list(self.tpl["font"].get("fallback", [])):
            c = self.hwp.HParameterSet.HCharShape
            self.hwp.HAction.GetDefault("CharShape", c.HSet)
            for k in ("FaceNameHangul", "FaceNameLatin", "FaceNameHanja",
                      "FaceNameJapanese", "FaceNameOther", "FaceNameSymbol", "FaceNameUser"):
                setattr(c, k, face)
            if self.hwp.HAction.Execute("CharShape", c.HSet):
                if face != preferred:
                    self.warnings.append(f"글꼴 '{preferred}' 미설치 → '{face}'로 대체 적용")
                return face
        self.warnings.append("지정 글꼴을 모두 적용하지 못해 기본 글꼴 사용")
        return None

    def _page_setup(self):
        """함정 #1: ApplyClass/ApplyTo 없이는 조용히 실패한다."""
        g = self.pg
        s = self.hwp.HParameterSet.HSecDef
        self.hwp.HAction.GetDefault("PageSetup", s.HSet)
        s.PageDef.PaperWidth, s.PageDef.PaperHeight = g["paper_w"], g["paper_h"]
        s.PageDef.LeftMargin = g["margin_left"]
        s.PageDef.RightMargin = g["margin_right"]
        s.PageDef.TopMargin = g["margin_top"]
        s.PageDef.BottomMargin = g["margin_bottom"]
        s.PageDef.HeaderLen = g.get("header_len", g["margin_top"])
        s.PageDef.FooterLen = g.get("footer_len", g["margin_bottom"])
        s.PageDef.GutterLen = 0
        s.HSet.SetItem("ApplyClass", 24)
        s.HSet.SetItem("ApplyTo", 3)
        if not self.hwp.HAction.Execute("PageSetup", s.HSet):
            self.warnings.append("PageSetup 실패 — 여백이 기본값일 수 있음")

    def _page_number(self):
        pos = self.pg.get("page_number", "none")
        if pos == "none":
            return
        name = {"bottom_center": "BottomCenter", "bottom_right": "BottomRight",
                "top_right": "TopRight"}.get(pos, "BottomCenter")
        try:
            n = self.hwp.HParameterSet.HPageNumPos
            self.hwp.HAction.GetDefault("PageNumPos", n.HSet)
            try:
                n.DrawPos = self.hwp.PageNumPosition(name)
            except Exception:  # noqa: BLE001
                n.DrawPos = 7
            try:
                n.NumberFormat = self.hwp.NumberFormat("Digit")
            except Exception:  # noqa: BLE001
                pass
            n.SideChar = ord("-")
            if not self.hwp.HAction.Execute("PageNumPos", n.HSet):
                self.warnings.append("쪽 번호 삽입 실패")
        except Exception as e:  # noqa: BLE001
            self.warnings.append(f"쪽 번호 삽입 실패: {e}")

    def char(self, size=11.0, bold=False, color=BLACK):
        c = self.hwp.HParameterSet.HCharShape
        self.hwp.HAction.GetDefault("CharShape", c.HSet)
        c.Height = int(size * PT)
        c.Bold = 1 if bold else 0
        c.Italic = 0
        c.UnderlineType = 0
        c.TextColor = self._rgb(color)
        if self.font:
            for k in ("FaceNameHangul", "FaceNameLatin", "FaceNameHanja",
                      "FaceNameJapanese", "FaceNameOther", "FaceNameSymbol", "FaceNameUser"):
                setattr(c, k, self.font)
            for k in ("FontTypeHangul", "FontTypeLatin", "FontTypeHanja",
                      "FontTypeJapanese", "FontTypeOther", "FontTypeSymbol", "FontTypeUser"):
                setattr(c, k, 1)
        self.hwp.HAction.Execute("CharShape", c.HSet)

    def para(self, left=0, indent=0, align="justify", spacing=None, space_below=0, right=0,
             space_above=0):
        """left/indent는 HWPUNIT의 2배 스케일이다 — 함정 #15."""
        p = self.hwp.HParameterSet.HParaShape
        self.hwp.HAction.GetDefault("ParagraphShape", p.HSet)
        p.LeftMargin = int(left)
        p.RightMargin = int(right)
        p.Indentation = int(indent)
        p.AlignType = ALIGN[align]
        p.LineSpacing = int(self.spacing if spacing is None else spacing)
        p.NextSpacing = int(space_below)
        if space_above:
            try:
                p.PrevSpacing = int(space_above)
            except Exception:  # noqa: BLE001
                pass
        if self.pg.get("break_word_unit", True):
            try:
                p.BreakNonLatinWord = 0     # 함정 #16: 기본값은 글자 단위
                p.BreakLatinWord = 0
            except Exception:  # noqa: BLE001
                pass
        self.hwp.HAction.Execute("ParagraphShape", p.HSet)

    def text(self, s):
        if not s:
            return
        p = self.hwp.HParameterSet.HInsertText
        self.hwp.HAction.GetDefault("InsertText", p.HSet)
        p.Text = s
        self.hwp.HAction.Execute("InsertText", p.HSet)

    def brk(self):
        self._run("BreakPara")

    def line(self, s, *, size=11.0, bold=False, color=BLACK, left=0, indent=0,
             align="justify", spacing=None, space_below=0, right=None):
        self.para(left=left, indent=indent, align=align, spacing=spacing,
                  space_below=space_below, right=self.right_pad if right is None else right)
        self.char(size=size, bold=bold, color=color)
        self.text(s)
        self.brk()

    def blank(self, size=9.0):
        self.line("", size=size, right=0)

    # ── 표 원시동작 ───────────────────────────────────────────────────
    def _goto_first_cell(self):
        self._run("TableColBegin")
        self._run("TableColPageUp")

    def _exit_table(self):
        """표 밖으로 나온다. 갇히면 이후 문단이 전부 표 속으로 들어간다(함정 #8)."""
        self._run("Cancel")
        try:
            self.hwp.MovePos(2)      # moveBottomOfFile
        except Exception:  # noqa: BLE001
            self._run("MoveDocEnd")

    def _apply_fill(self, color):
        cb = self.hwp.HParameterSet.HCellBorderFill
        self.hwp.HAction.GetDefault("CellFill", cb.HSet)
        try:
            cb.FillAttr.type = self.hwp.BrushType("NullBrush|WinBrush")
            cb.FillAttr.WinBrushFaceColor = self._rgb(color)
            cb.FillAttr.WinBrushHatchColor = self._rgb(BLACK)
            cb.FillAttr.WinBrushFaceStyle = -1
            cb.FillAttr.WindowsBrush = 1
        except Exception as e:  # noqa: BLE001
            self.warnings.append(f"셀 음영 지정 실패: {e}")
            self._run("Cancel")
            return
        self.hwp.HAction.Execute("CellFill", cb.HSet)
        self._run("Cancel")

    # ── 셀 장식 (배경 + 면별 테두리) ────────────────────────────────
    def _style(self, role):
        return (self.tpl.get("cell_styles") or {}).get(role)

    @staticmethod
    def _text_color(style, pal_value, fallback):
        """역할 스타일의 글자색 → palette → 기본값 순.
        palette를 먼저 보면 배경 없는 칸에 흰 글자를 써서 글자가 사라진다."""
        if style and style.get("text_color"):
            return hexrgb(style["text_color"], fallback)
        if pal_value:
            return hexrgb(pal_value, fallback)
        return fallback

    def _line_type(self, kind):
        name = LINE_TYPES.get(kind, "Solid")
        try:
            return self.hwp.HwpLineType(name)
        except Exception:  # noqa: BLE001
            return 0 if name == "None" else 1

    def _line_width(self, mm):
        if mm is None:
            mm = 0.12
        try:
            return self.hwp.HwpLineWidth(f"{mm}mm")
        except Exception:  # noqa: BLE001
            best = min(range(len(BORDER_WIDTHS)), key=lambda i: abs(BORDER_WIDTHS[i] - mm))
            return best

    def _apply_borders(self, sides):
        """현재 선택(셀 1개 권장)에 4면 테두리를 지정한다.
        sides = {"left": spec|"none", ...}. 블록 선택에 적용하면 바깥 면만 바뀌므로
        내부 괘선까지 정확히 맞추려면 셀 단위로 호출한다."""
        cb = self.hwp.HParameterSet.HCellBorderFill
        self.hwp.HAction.GetDefault("CellBorderFill", cb.HSet)
        for side in ("Left", "Right", "Top", "Bottom"):
            spec = sides.get(side.lower(), "none")
            if spec in (None, "none"):
                setattr(cb, f"BorderType{side}", self._line_type("none"))
                continue
            setattr(cb, f"BorderType{side}", self._line_type(spec.get("type", "solid")))
            try:
                setattr(cb, f"BorderWidth{side}", self._line_width(spec.get("width_mm")))
            except Exception:  # noqa: BLE001
                pass
            try:
                setattr(cb, f"BorderColor{side}", self._rgb(hexrgb(spec.get("color"), BLACK)))
            except Exception:  # noqa: BLE001
                pass
        if not self.hwp.HAction.Execute("CellBorderFill", cb.HSet):
            self.warnings.append("셀 테두리 지정 실패")

    @staticmethod
    def _sides_for(style, r, c, nrows, ncols):
        """역할 스타일 + 셀 위치 → 4면 스펙. 내부 면은 inner_vert/inner_horz를 쓴다."""
        b = (style or {}).get("borders") or {}
        dflt = b.get("all", {"type": "solid", "width_mm": 0.12, "color": "#000000"})
        iv = b.get("inner_vert", dflt)
        ih = b.get("inner_horz", dflt)
        # 면이 템플릿에 '명시'되어 있으면 위치와 무관하게 그 값을 쓴다.
        # (배너처럼 2칸짜리 표에서 안쪽 경계를 지정한 경우를 살리기 위함)
        def pick(name, is_edge, inner):
            if name in b:
                return b[name]
            return dflt if is_edge else inner
        return {
            "top": pick("top", r == 0, ih),
            "bottom": pick("bottom", r == nrows - 1, ih),
            "left": pick("left", c == 0, iv),
            "right": pick("right", c == ncols - 1, iv),
        }

    def _decorate_cell(self, style, r, c, nrows, ncols):
        """커서가 있는 셀에 배경과 테두리를 적용한다."""
        if not style:
            return
        self._run("TableCellBlock")
        if style.get("fill"):
            self._apply_fill(hexrgb(style["fill"]))
            self._run("TableCellBlock")
        self._apply_borders(self._sides_for(style, r, c, nrows, ncols))
        self._run("Cancel")

    def _fill_current_cell(self, color):
        self._run("TableCellBlock")
        self._apply_fill(color)

    def _select_header(self, nrows):
        self._goto_first_cell()
        self._run("TableCellBlock")
        self._run("TableCellBlockExtend")
        self._run("TableColEnd")
        for _ in range(nrows - 1):
            self._run("TableLowerCell")

    def _in_table(self):
        try:
            return self.hwp.CellShape is not None
        except Exception:  # noqa: BLE001
            return False

    def _mark_title_row(self):
        """R3 — 쪽을 넘길 때 제목 줄 반복. body의 repeat-header 플래그만으로는 동작하지 않고
        헤더 행을 '제목 셀'로 지정해야 한다(함정 #11)."""
        if not self._in_table():
            self.warnings.append("제목 줄 반복 지정 건너뜀 — 커서가 표 안이 아님")
            return
        try:
            hs = self.hwp.HParameterSet.HShapeObject
            self.hwp.HAction.GetDefault("TablePropertyDialog", hs.HSet)
            hs.ShapeTableCell.Header = 1
            if not self.hwp.HAction.Execute("TablePropertyDialog", hs.HSet):
                self.warnings.append("제목 줄 반복 지정 실패 — 쪽을 넘기면 헤더 없이 잘릴 수 있음")
        except Exception as e:  # noqa: BLE001
            self.warnings.append(f"제목 줄 반복 지정 실패: {e}")

    def _set_cell_margins(self, nrows):
        """셀 위·아래 여백과 세로 정렬을 표 전체에 적용한다.
        한글 기본 여백(141=1.4pt)은 9~10pt 글자에서 아래 괘선까지 1pt도 남지 않아
        글자가 선에 붙어 보인다. 표 단위 padding으로는 덮이지 않으므로 셀 단위로 지정한다."""
        if not self.pad_tb and self.vert_align == "top":
            return
        self._goto_first_cell()
        self._run("TableCellBlock")
        self._run("TableCellBlockExtend")
        self._run("TableColEnd")
        for _ in range(max(nrows - 1, 0)):
            self._run("TableLowerCell")
        try:
            hs = self.hwp.HParameterSet.HShapeObject
            self.hwp.HAction.GetDefault("TablePropertyDialog", hs.HSet)
            if self.pad_tb:
                hs.ShapeTableCell.MarginTop = int(self.pad_tb)
                hs.ShapeTableCell.MarginBottom = int(self.pad_tb)
                half = int(self.cell_pad // 2)
                hs.ShapeTableCell.MarginLeft = half
                hs.ShapeTableCell.MarginRight = half
            hs.ShapeTableCell.VertAlign = {"top": 0, "center": 1, "bottom": 2}[self.vert_align]
            if not self.hwp.HAction.Execute("TablePropertyDialog", hs.HSet):
                self.warnings.append("셀 여백·세로정렬 지정 실패")
        except Exception as e:  # noqa: BLE001
            self.warnings.append(f"셀 여백 지정 실패: {e}")
        self._run("Cancel")
        self._goto_first_cell()

    def create_table(self, nrows, ncols, widths):
        """widths: 셀 실폭(HWPUNIT). 합계가 표 폭이 된다."""
        total = sum(widths)
        ps = self.hwp.HParameterSet.HTableCreation
        self.hwp.HAction.GetDefault("TableCreate", ps.HSet)
        ps.Rows, ps.Cols = nrows, ncols
        ps.WidthType, ps.HeightType = 0, 0        # 함정 #3: 0 = 사용자 지정
        ps.WidthValue, ps.HeightValue = total, 0
        ps.CreateItemArray("ColWidth", ncols)
        for i, w in enumerate(widths):
            ps.ColWidth.SetItem(i, max(int(w) - CELL_PAD_AT_CREATE, 400))   # 함정 #2
        try:
            ps.TableProperties.Width = total
        except Exception:  # noqa: BLE001
            pass
        if not self.hwp.HAction.Execute("TableCreate", ps.HSet):
            self.warnings.append("표 생성 실패")
            return False
        self._goto_first_cell()
        return True

    def _resolve_width(self, spec):
        return self.table_max if spec in (None, "body") else int(spec)

    # ── 블록 렌더러 ───────────────────────────────────────────────────
    def block_cover(self, meta):
        cv = self.tpl["cover"]
        for part in cv.get("order", ["title", "date", "dept"]):
            if part == "title":
                t = cv.get("title", {})
                title = meta.get("title", "")
                if t.get("impl") == "boxed":
                    if self.create_table(1, 1, [self._resolve_width(t.get("width"))]):
                        self._decorate_cell(self._style("cover_title"), 0, 0, 1, 1)
                        self.para(align=t.get("align", "center"))
                        self.char(size=t.get("size", 16.0), bold=t.get("bold", True))
                        self.text(title)
                        self._exit_table()
                else:
                    self.line(title, size=t.get("size", 16.0), bold=t.get("bold", True),
                              align=t.get("align", "center"))
            elif part == "subtitle" and meta.get("subtitle"):
                self.line(meta["subtitle"], size=12.0, align="center")
            elif part == "date" and meta.get("date"):
                d = cv.get("date", {})
                fmt = cv.get("date_format", "( {date} )")
                self.line(fmt.format(date=meta["date"]), size=d.get("size", 11.0),
                          bold=d.get("bold", False), align=d.get("align", "center"))
            elif part == "dept" and meta.get("dept"):
                d = cv.get("dept", {})
                self.line(meta["dept"], size=d.get("size", 11.0), bold=d.get("bold", True),
                          align=d.get("align", "center"), space_below=600)

    def _banner(self, spec, num, text, fallback_size, level="h1"):
        total = self._resolve_width(spec.get("width"))
        num_w = int(spec.get("num_cell_w", 3000))
        size = spec.get("size", fallback_size)
        bold = spec.get("bold", True)
        if not self.create_table(1, 2, [num_w, total - num_w]):
            self.line(f"{num} {text}", size=size, bold=bold)
            return
        st_num = self._style(f"banner_{level}_num")
        st_ttl = self._style(f"banner_{level}_title")
        # 번호칸
        num_fg = self._text_color(st_num, self.pal.get("banner_num_fg"), BLACK)
        ttl_fg = self._text_color(st_ttl, self.pal.get("banner_title_fg"), BLACK)
        self._decorate_cell(st_num, 0, 0, 1, 2)
        self.para(align="center")
        self.char(size=size, bold=bold, color=num_fg)
        self.text(num)
        # 제목칸
        self._run("TableRightCell")
        self._decorate_cell(st_ttl, 0, 1, 1, 2)
        self.para(align="left")
        self.char(size=size, bold=bold, color=ttl_fg)
        self.text(text)
        self._exit_table()

    def block_heading(self, level, num, text):
        """num이 없으면 템플릿의 표기 방식으로 자동 채번한다 — 그래서 같은 doc.json이
        로마숫자 양식과 '가.' 양식 모두에 쓰인다."""
        spec = self.tpl["headings"][level]
        self.counters[level] += 1
        if level == "h1":
            self.counters["h2"] = self.counters["h3"] = 0
        elif level == "h2":
            self.counters["h3"] = 0
        if spec.get("marker") == "symbol":
            label = spec.get("symbol", "■")
        else:
            label = num or fmt_num(spec.get("marker", "arabic"), self.counters[level])

        above = spec.get("space_above", 0)
        if above and self.prev_block is not None:
            if level == "h1" or self.prev_block not in ("h1", "box", "table"):
                self.blank(size=above)

        if spec.get("impl") == "banner_table":
            self._banner(spec, label, text, 14.0 if level == "h1" else 12.0, level=level)
            if level == "h1":
                self.blank(size=9.0)
        else:
            self.line(f"{label} {text}".strip(), size=spec.get("size", 11.5),
                      bold=spec.get("bold", True), left=spec.get("left", 0),
                      indent=spec.get("indent", 0), space_below=100)

    def _ladder(self, level):
        return self.ladder[min(level, len(self.ladder)) - 1]

    def block_bullet(self, level, text, bold=None, color="text", marker=None):
        st = self._ladder(level)
        mk = marker or st["marker"]
        self.line(f"{mk} {text}",
                  size=st.get("size", 11.0),
                  bold=st.get("bold", False) if bold is None else bold,
                  color=self.emphasis if color in ("blue", "emphasis") else BLACK,
                  left=st.get("left", 0), indent=st.get("indent", 0))

    def block_enum(self, index, text, bold=False, color="text"):
        marks = self.sp.get("enum_markers", "①②③④⑤⑥⑦⑧⑨")
        st = self._ladder(2)
        mk = marks[min(index, len(marks)) - 1]
        self.line(f"{mk} {text}", size=st.get("size", 11.0), bold=bold,
                  color=self.emphasis if color in ("blue", "emphasis") else BLACK,
                  left=st.get("left", 0), indent=st.get("indent", 0))

    def block_conclusion(self, text):
        c = self.sp.get("conclusion", {})
        limit = c.get("max_chars")
        if limit and len(text) > limit:
            self.warnings.append(
                f"결론이 {len(text)}자로 한도({limit}자)를 넘어 두 줄이 될 수 있음: '{text[:20]}…'")
        col = self.emphasis if c.get("color", "emphasis") == "emphasis" else BLACK
        self.line(f"{c.get('marker', '☞')} {text}", size=c.get("size", 11.0),
                  bold=c.get("bold", True), color=col,
                  left=c.get("left", 3300), indent=c.get("indent", -3300))

    def block_note(self, text):
        n = self.sp.get("note", {})
        mk = n.get("marker", "*")
        t = text if text.startswith((mk, "※")) else f"{mk} {text}"
        self.line(t, size=n.get("size", 9.0), left=n.get("left", 3300),
                  indent=n.get("indent", -2700))

    def block_box(self, items, title=None):
        bx = self.tb.get("box", {})
        if not self.create_table(1, 1, [self._resolve_width(bx.get("width"))]):
            return
        self._decorate_cell(self._style("box"), 0, 0, 1, 1)
        self._set_cell_margins(1)
        if title:
            self.para(align="left")
            self.char(size=11.0, bold=True)
            self.text(title)
            self.brk()
        for i, it in enumerate(items):
            st = self._ladder(it["level"])
            self.para(left=st.get("left", 0), indent=st.get("indent", 0), align="left")
            self.char(size=st.get("size", 11.0), bold=it.get("bold", st.get("bold", False)),
                      color=self.emphasis if it.get("color") in ("blue", "emphasis") else BLACK)
            self.text(f"{st['marker']} {it['text']}")
            if i < len(items) - 1:
                self.brk()
        self._exit_table()
        self.blank()

    def block_table(self, spec):
        header, rows = spec["header"], spec["rows"]
        ncols = max(len(header[0]), max(len(r) for r in rows))
        if ncols > self.tb.get("max_cols", 8):
            self.warnings.append(f"열 {ncols}개 — 양식 상한({self.tb.get('max_cols')})을 넘었습니다")
        widths = self._resolve_widths(spec.get("widths"), ncols)
        aligns = spec.get("align") or (["center"] + ["right"] * (ncols - 1))
        aligns = (aligns + ["left"] * ncols)[:ncols]

        if spec.get("title"):
            self.blank(size=6.0)
            mk = self.tb.get("title_marker", "")
            st = self._ladder(1)
            self.line(f"{mk} {spec['title']}".strip(), size=11.0, bold=True,
                      left=st.get("left", 0), indent=st.get("indent", 0), space_below=60)
        cap_pos = self.tb.get("caption_pos", "above_right")
        if spec.get("caption") and cap_pos != "none":
            self.line(spec["caption"], size=self.tb.get("caption_size", 10.0), bold=True,
                      align="right" if cap_pos == "above_right" else "left", space_below=60)

        nrows_all = len(header) + len(rows)
        if not self.create_table(nrows_all, ncols, widths):
            return

        head_fg = self._text_color(self._style("table_header"), None, BLACK)
        body_fg = self._text_color(self._style("table_body"), None, BLACK)
        hsize = self.tb.get("header_size", 9.5)
        halign = self.tb.get("header_align", "center")
        hbold = self.tb.get("header_bold", True)
        bsize = self.tb.get("body_size", 9.5)
        cells = [[(hr[c] if c < len(hr) else "", halign, hbold, hsize) for c in range(ncols)]
                 for hr in header]
        last = len(rows) - 1
        for ri, row in enumerate(rows):
            tot = bool(spec.get("total_row")) and ri == last
            cells.append([(row[c] if c < len(row) else "", aligns[c], tot, bsize) for c in range(ncols)])

        st_head = self._style("table_header")
        st_body = self._style("table_body")
        n_all = len(cells) * ncols
        idx = 0
        for ri, crow in enumerate(cells):
            is_head = ri < len(header)
            for ci, (val, al, bold, size) in enumerate(crow):
                style = st_head if is_head else st_body
                if style:
                    self._decorate_cell(style, ri, ci, nrows_all, ncols)
                self.para(align=al, spacing=140, space_above=self.cell_space_above)
                self.char(size=size, bold=bold, color=head_fg if is_head else body_fg)
                sval = val if val not in ("", None) else "-"          # R8
                parts = str(sval).split("\n")
                for pi, part in enumerate(parts):
                    self.text(part)
                    if pi < len(parts) - 1:
                        self.brk()
                        self.para(align=al, spacing=140)
                        self.char(size=size, bold=bold, color=head_fg if is_head else body_fg)
                idx += 1
                if idx < n_all:
                    self._run("TableRightCell")

        if not st_head:      # 템플릿에 헤더 스타일이 없으면 팔레트 음영만
            self._select_header(len(header))
            self._apply_fill(hexrgb(self.pal.get("table_header_bg"), (0xd9, 0xd9, 0xd9)))
        if self.tb.get("header_repeat", True):
            self._select_header(len(header))
            self._mark_title_row()
            self._run("Cancel")
        self._set_cell_margins(nrows_all)     # 반드시 장식 적용 뒤 (함정 #19)
        self._exit_table()
        if spec.get("note"):
            self.block_note(spec["note"])
        self.blank()

    def _resolve_widths(self, widths, ncols):
        cap = self.table_max
        if not widths:
            return [cap // ncols] * ncols
        widths = list(widths)[:ncols]
        if len(widths) < ncols:
            widths += [widths[-1]] * (ncols - len(widths))
        total = sum(widths)
        if total <= 1.01:
            out = [int(cap * w / total) for w in widths]
        else:
            out = [int(w) for w in widths]
            if sum(out) > cap:                       # R1
                k = cap / sum(out)
                out = [int(w * k) for w in out]
        out[-1] += cap - sum(out)
        return out

    def block_pagebreak(self):
        self._run("BreakPage")

    def block_spacer(self, lines=1):
        for _ in range(lines):
            self.blank()

    # ── 저장 ──────────────────────────────────────────────────────────
    def save(self, path: Path, pdf: Path | None = None):
        """항상 새 임시 경로에 저장한 뒤 교체한다. 기존 파일을 직접 덮어쓰면 한글이
        보이지 않는 확인 대화상자를 띄워 영구 대기한다(함정 #14)."""
        tmpdir = Path(tempfile.mkdtemp(prefix="hwpbuild_"))
        tmp_hwp, tmp_pdf = tmpdir / "out.hwp", tmpdir / "out.pdf"
        print("[save] hwp", file=sys.stderr, flush=True)
        ok = self.hwp.SaveAs(str(tmp_hwp).replace("/", "\\"), "HWP", "")
        pages = self.hwp.PageCount
        pdf_ok = None
        if pdf:
            print("[save] pdf", file=sys.stderr, flush=True)
            pdf_ok = self.hwp.SaveAs(str(tmp_pdf).replace("/", "\\"), "PDF", "")
        print("[save] quit", file=sys.stderr, flush=True)
        self.hwp.Quit()
        if ok and tmp_hwp.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            os.replace(tmp_hwp, path)
        if pdf and pdf_ok and tmp_pdf.exists():
            os.replace(tmp_pdf, pdf)
        return {"saved": bool(ok), "pages": pages, "pdf": bool(pdf_ok) if pdf else None}


def render(doc: dict, tpl: dict, out: Path, pdf: Path | None = None,
           visible=False, kill_stale=False):
    meta = doc.get("meta", {})
    d = HwpDoc(tpl, visible=visible, font=meta.get("font"), kill_stale=kill_stale)
    d.block_cover(meta)

    dispatch = {
        "h1": lambda b: d.block_heading("h1", b.get("num"), b["text"]),
        "h2": lambda b: d.block_heading("h2", b.get("num"), b["text"]),
        "h3": lambda b: d.block_heading("h3", b.get("num"), b["text"]),
        "bullet": lambda b: d.block_bullet(b["level"], b["text"], b.get("bold"),
                                           b.get("color", "text"), b.get("marker")),
        "enum": lambda b: d.block_enum(b["index"], b["text"], b.get("bold", False),
                                       b.get("color", "text")),
        "conclusion": lambda b: d.block_conclusion(b["text"]),
        "note": lambda b: d.block_note(b["text"]),
        "box": lambda b: d.block_box(b["items"], b.get("title")),
        "table": lambda b: d.block_table(b),
        "pagebreak": lambda b: d.block_pagebreak(),
        "spacer": lambda b: d.block_spacer(b.get("lines", 1)),
    }
    total = len(doc["blocks"])
    for i, b in enumerate(doc["blocks"]):
        fn = dispatch.get(b["type"])
        if fn is None:
            d.warnings.append(f"blocks[{i}]: 알 수 없는 type '{b['type']}' — 건너뜀")
            continue
        label = b["type"]
        if b["type"] == "table":
            label += f" {len(b['rows'])}행×{len(b['header'][0])}열"
        elif b.get("text"):
            label += f" {b['text'][:28]}"
        print(f"[{i}/{total - 1}] {label}", file=sys.stderr, flush=True)
        fn(b)
        d.prev_block = b["type"]

    res = d.save(out, pdf)
    res["warnings"] = d.warnings
    res["font"] = d.font
    res["template"] = tpl.get("name")
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doc")
    ap.add_argument("out")
    ap.add_argument("--template", "-t", required=True,
                    help="양식 이름(templates/<이름>.json) 또는 template.json 경로 — 기본값 없음")
    ap.add_argument("--pdf")
    ap.add_argument("--visible", action="store_true")
    ap.add_argument("--kill-stale", action="store_true",
                    help="실행 전 남아 있는 한글 프로세스를 강제 종료 (열려 있는 문서가 있으면 주의)")
    a = ap.parse_args()
    doc = json.loads(Path(a.doc).read_text(encoding="utf-8"))
    tpl = load_template(a.template)
    res = render(doc, tpl, Path(a.out), Path(a.pdf) if a.pdf else None, a.visible, a.kill_stale)
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res["saved"] else 1


if __name__ == "__main__":
    sys.exit(main())
