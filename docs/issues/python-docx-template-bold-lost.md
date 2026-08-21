---
title: python-docx 템플릿 치환 후 지정한 bold가 특정 셀·첫 row에서 사라짐
date: 2026-07-07
type: 실패→해결
status: resolved
stack: Python, python-docx, docx 템플릿(report_template.docx)
tags: [python-docx, bold, run, placeholder 치환, docx 표, 서식 손실, 보고서 생성]
---

# python-docx 템플릿 치환 후 지정한 bold가 특정 셀·첫 row에서 사라짐

## 언제 참고
python-docx로 `.docx` 템플릿의 `{PLACEHOLDER}`를 실제 값으로 치환해 보고서를 생성할 때,
템플릿(워드)에서 분명히 **굵게** 지정해 둔 표의 첫 row·특정 셀이 결과물에서 bold가 풀려 나올 때.
"템플릿엔 bold 해놨는데 왜 안 나와?" 상황.

## 무엇을 하려 했나
`report_template.docx`의 표(은행/지주사·국가기관·금융연구소·주요 이슈 표 등) 첫 row 제목과
특정 셀 내용을 굵게 유지한 채 보고서를 생성.

## 무슨 일이 있었나
템플릿에서 셀을 bold 처리해 뒀는데 생성된 보고서에서 해당 서식이 사라졌다. 요구가
"어느 표/어느 셀"인지 계속 어긋나 여러 번 되돌리고(“다시 되돌려”) 다시 하는 삽질이 반복됐다.
(과거 세션 사용자 메시지 U17·U19·U21·U26·U28·U30·U37·U39·U40)

```text
증상: 템플릿의 bold 지정 셀 → 생성물에서 일반 굵기로 렌더
원인 계열: placeholder 텍스트를 새 run으로 갈아끼우면서 원래 run의 서식(bold/font)이 유실
```

## 원인
placeholder 치환·셀 텍스트 재작성 과정에서 **run이 새로 생성/교체**되면서 원래 run에 있던
서식이 따라오지 않는다. python-docx에서 서식은 paragraph가 아니라 **run 단위**라, 텍스트만
바꾸면 bold가 날아간다. 또 표 인덱스/셀 좌표(`table[2]` vs `bank_summary` 등)를 코드와 서로
다르게 세고 있어 "적용은 됐는데 엉뚱한 셀"이 반복됐다.

## 해결 (실제로 통한 것)
템플릿의 서식에 의존하지 말고, 치환 후 **코드에서 대상 셀의 모든 run에 `run.bold = True`를 명시 적용**.
표/셀은 인덱스로 명확히 특정한다.

```python
# 주요 이슈 표(doc.tables[1])의 첫 row, 세번째 셀만 bold — app.py:4181-4186
if len(doc.tables) > 1:
    issue_row = doc.tables[1].rows[0]
    if len(issue_row.cells) > 2:
        for para in issue_row.cells[2].paragraphs:
            for run in para.runs:
                run.bold = True

# 그외 요약 표: 전체 셀 bold — app.py:4442-4445 (fill_other_summary_table)
for cell in row.cells:
    for para in cell.paragraphs:
        for run in para.runs:
            run.bold = True
```

Claude가 스스로 원인을 잡되, "어느 표/셀"은 사용자가 `table[n]`·의미명(bank_summary 등)으로
정정해 주며 확정했다.

## 다음엔 이렇게 (재발 방지 규칙)
- **템플릿 서식을 믿지 말 것.** placeholder를 치환하거나 셀 텍스트를 재작성하면 run 서식은
  유실된다고 가정하고, 치환 **후** 코드에서 `run.bold`/폰트를 다시 명시하라.
- bold/폰트는 paragraph가 아니라 **run 단위**. `for para in cell.paragraphs: for run in para.runs:` 로 순회.
- "몇 번 표/몇 번 셀"은 **먼저 인덱스로 합의**하라. 사용자의 의미명(bank_summary=table[2] 등)과
  코드 인덱스를 매핑해 확인한 뒤 손대야 되돌리기 삽질을 막는다.
- 병합 셀은 같은 `_tc`가 여러 번 나오므로 `id(cell._tc)` 로 중복 처리 회피(app.py:4622 참고).

## 검증 방법
보고서 생성 후 `generated_report.docx`를 열어 대상 셀이 굵게 나오는지 육안 확인, 또는
`python-docx`로 `cell.paragraphs[*].runs[*].bold` 값이 `True`인지 점검.

## 출처
프로젝트 `조사연구 자동화` / app.py:4179-4186, 4435-4445 / 과거 세션 2026-07 이전.
환경: Windows, 한글 워드 템플릿.
