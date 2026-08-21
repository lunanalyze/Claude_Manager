---
title: 한글 docx 최종 폰트가 지정(맑은 고딕)과 달리 Times New Roman·함초롬바탕으로 나옴
date: 2026-07-07
type: 실패→해결
status: resolved
stack: Python, python-docx, 한글 docx 폰트, OOXML(w:rFonts)
tags: [python-docx, 한글 폰트, eastAsia, w:rFonts, 맑은 고딕, 함초롬바탕, Times New Roman, 폰트 미적용]
---

# 한글 docx 최종 폰트가 지정(맑은 고딕)과 달리 Times New Roman·함초롬바탕으로 나옴

## 언제 참고
python-docx로 만든 `.docx`에서 **한글 텍스트의 폰트를 바꿨는데 반영이 안 될 때**.
`run.font.name = "맑은 고딕"` 만 줬는데 한글은 여전히 함초롬바탕/바탕으로, 제목은 Times New Roman으로
나오는 상황. 한/영 폰트가 따로 노는 모든 docx 폰트 작업.

## 무엇을 하려 했나
보고서 표의 제목·본문 폰트를 전부 **맑은 고딕**으로 통일. (사용자 요청 U13·U25)

## 무슨 일이 있었나
표 첫 row 제목 셀의 최종 폰트가 **Times New Roman**, table[0] 제외 본문이 **함초롬바탕**으로
설정돼 나왔다. 코드/템플릿에서 폰트를 지정했다고 생각했는데 한글에 먹지 않았다.

```text
증상: run.font.name / ascii 폰트만 지정 → 한글 글리프는 무시하고 문서 기본 동아시아 폰트로 렌더
```

## 원인
OOXML은 폰트를 **스크립트별로 분리**해서 본다. `w:rFonts`의 `w:ascii`(라틴)와
`w:eastAsia`(한글·CJK)가 별개다. python-docx의 `run.font.name` 은 사실상 ascii/hAnsi만 건드리므로,
**`w:eastAsia`를 안 주면 한글은 문서 기본 동아시아 폰트(함초롬바탕 등)로 렌더**된다.

## 해결 (실제로 통한 것)
run의 `rPr > w:rFonts` 에 **ascii·eastAsia·hAnsi·cs 4속성을 모두** 대상 폰트로 직접 설정.

```python
# app.py:4609-4631
MALGUN_FONT = "맑은 고딕"

def set_run_font_malgun(run) -> None:
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    for attr in ("w:ascii", "w:eastAsia", "w:hAnsi", "w:cs"):
        rFonts.set(qn(attr), MALGUN_FONT)

def apply_malgun_to_table(table) -> None:      # 병합셀은 id(cell._tc)로 1회만
    for row in table.rows:
        seen = set()
        for cell in row.cells:
            if id(cell._tc) in seen: continue
            seen.add(id(cell._tc))
            for para in cell.paragraphs:
                for run in para.runs:
                    set_run_font_malgun(run)
```

`qn`, `OxmlElement` 는 `docx.oxml.ns` / `docx.oxml` 에서 import.

## 다음엔 이렇게 (재발 방지 규칙)
- 한글 docx 폰트는 **`run.font.name` 만으로 끝나지 않는다.** 반드시 `w:rFonts` 의
  **`w:eastAsia`** 를 함께 설정하라(안전하게 ascii/eastAsia/hAnsi/cs 4개 다).
- 폰트도 bold와 같이 **run 단위 + 치환 후 명시 적용**. 표는 모든 셀·모든 para·모든 run 순회.
- 병합 셀 중복은 `id(cell._tc)` 로 스킵.
- 증상이 "한글만 폰트 안 먹음"이면 십중팔구 eastAsia 미설정이다 — 여기부터 의심하라.

## 검증 방법
생성 docx를 워드에서 열어 한글 텍스트 클릭 → 폰트가 "맑은 고딕"인지 확인. 또는 압축 해제한
`word/document.xml` 에서 해당 run의 `<w:rFonts ... w:eastAsia="맑은 고딕"/>` 존재 확인.

## 출처
프로젝트 `조사연구 자동화` / app.py:4180, 4609-4631 / 과거 세션 2026-07 이전. 환경: Windows.
