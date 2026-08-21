---
name: hwp-report
description: 어떤 조직의 양식이든, 추출된 양식 템플릿(template.json)대로 한글 문서(.hwp)를 생성하고 검수한다. 마크다운이 아니라 '문서 모델(doc.json)'을 작성하면 렌더러가 그 양식의 계층 기호·배너·강조박스·데이터표·여백을 템플릿대로 그린다. 양식 자체는 hwp-template-extractor 스킬이 원본 hwp에서 추출한다. 생성 후에는 구조 규칙·PDF 좌표 실측·페이지 이미지 육안 검증을 거친다. "hwp로 만들어줘", "한글 보고서 작성", "업무보고서 hwp", "hwp 검수/양식 확인" 등에 사용. (한글 프로그램 + win32com COM이 필요해 **Windows 전용** — WSL에서는 호출하지 않는다.)
---

# hwp-report

한글 문서를 **손으로 그리지 않고 규약으로 생성**한다. 마크다운을 hwp로 바꾸는 일이 아니다 —
마크다운에는 "이건 강조 박스", "이건 대제목 배너" 같은 **양식의 의미**가 없기 때문이다.

```
내용 판단(LLM)  →  doc.json  →  build_hwp.py  →  .hwp + .pdf  →  verify + 서브에이전트 검수
   무엇을 쓸지        의미 단위      형식 규칙          산출물            구조·레이아웃·육안
```

## 전제 확인 (처음 한 번)

```bash
python -c "import win32com.client.dynamic as d; d.Dispatch('HWPFrame.HwpObject'); print('한글 COM OK')"
python -c "import fitz, hwp5, lxml; print('PyMuPDF/pyhwp/lxml OK')"
```
없으면: `pip install pywin32 PyMuPDF pyhwp lxml` + 한글(한컴오피스) 설치. **한글 미설치 시 이 skill은 쓸 수 없다.**

## 작업 순서

### 1. 규약을 먼저 읽는다

[`references/HWP_SCHEME.md`](./references/HWP_SCHEME.md) — 절대 규칙 R1~R12, 계층 사다리,
표 3종(배너/강조박스/데이터표), **표로 뺄지 문장으로 쓸지 판단 규칙**, COM 함정 20가지.
문서를 만들기 전에 §0·§2·§3을 읽어라. 이 규칙이 "사람이 쓴 것처럼" 보이게 하는 실체다.

### 2. doc.json 을 쓴다

스키마: [`schema/doc.schema.json`](./schema/doc.schema.json).
블록 타입: `h1` `h2` `h3` `bullet`(level 1~4) `enum` `conclusion` `note` `box` `table` `pagebreak` `spacer`

```jsonc
{
  "meta": { "title": "전기통신금융사기 업무보고", "date": "2026.07.31.", "dept": "금융소비자보호부" },
  "blocks": [
    { "type": "h1", "num": "Ⅰ.", "text": "검토 배경" },
    { "type": "bullet", "level": 1, "text": "…" },
    { "type": "table", "caption": "[단위 : 건, %]",
      "widths": [0.28, 0.18, 0.18, 0.18, 0.18],
      "align": ["center", "right", "right", "right", "left"],
      "header": [["구 분", "당월", "전월", "증감", "비고"]],
      "rows": [["지급정지 등록", "15", "21", "-6", "2060"]],
      "total_row": false, "note": "집계 기준: 지급정지 등록일자" },
    { "type": "conclusion", "text": "…" }
  ]
}
```

**쓸 때 반드시 지킬 것**
- 표는 **열 8개 이하**, 빈 셀 금지(`-`로 채움), 폭은 비율로 주고 합이 1이 되게 한다
- 숫자 열은 `align: right`, 라벨 열은 `center`/`left`
- `conclusion`(☞ 파랑)은 섹션당 1~2개, **44자 이내 1줄**(R9). 남발하면 강조가 죽는다
- `pagebreak`는 절 경계에서 **제목·헤더만 남을 때만**(R10·R11). 습관적으로 넣지 마라
- 3개 이상 항목 비교 → 표 / 2개 이하 → 문장 / 결론 3줄 → `box` (§3-4 판단 규칙)
- 긴 서술을 표 셀에 넣지 마라. 셀은 2줄 이내가 원칙이다

### 3. 생성한다

```bash
python <this>/scripts/build_hwp.py doc.json out.hwp --template <양식이름> --pdf out.pdf
```
양식 템플릿은 `templates/<양식이름>.json` — **손으로 쓰지 않고** `hwp-template-extractor`
스킬이 원본 hwp에서 추출한다. 새 양식이 오면 그 스킬부터 실행한다.

> ⚠️ `templates/` 는 **git 추적 대상이 아니다**(`.gitignore`). 추출한 템플릿에는 조직의
> 부서명·보고서 제목이 `source` 로 남기 때문이다. 그래서 **clone 직후 `templates/` 는 비어 있다** —
> 없다고 놀라지 말고 원본 hwp에서 재추출한다. 템플릿은 그 기기 로컬 자산이다.
출력 JSON의 `warnings`를 반드시 확인한다. 특히 **글꼴 대체 경고** — 배포 대상 PC에 원본 글꼴이
있어야 의도한 모양이 나온다.

### 3.5 렌더러·템플릿을 고쳤다면 자기검증부터

```bash
python <this>/scripts/selftest.py -t <양식이름> [-t 다른양식 ...]
```
특정 문서가 아니라 **양식 무관 불변식**(INV1 글자 가시성 · INV2 셀 여백 · INV3 표 폭 ·
INV4 사다리 계단 · INV5 내어쓰기 · INV6 제목 번호 · INV7 내용 무결 · INV8 쪽 끝 잔여)을
검사한다. 실패하면 **템플릿 값을 손으로 고치지 말고 추출기/렌더러를 고친 뒤 재실행**한다.
양식이 늘 때마다 `-t`를 추가해 전 양식을 한 번에 돌린다 — 한 양식을 고치다 다른 양식을
깨뜨리는 것을 여기서 잡는다.

### 4. 검수한다 (건너뛰지 말 것)

```bash
python <this>/scripts/verify_hwp.py out.hwp --pdf out.pdf --doc doc.json \
       --png-dir _verify --json _verify/report.json
```

그리고 **`hwp-doc-reviewer` 서브에이전트**를 띄워 페이지 이미지를 눈으로 확인하게 한다
(정의: [`agents/hwp-doc-reviewer.md`](./agents/hwp-doc-reviewer.md) → `~/.claude/agents/`에 설치).
자동 검사가 PASS여도 육안 검증은 한다 — 열 폭 불균형·숫자 줄바꿈·페이지 끝 걸침은 규칙으로 안 잡힌다.

### 5. 고칠 때는 doc.json 을 고친다

**hwp 파일을 직접 손대지 마라.** 다음 생성 때 되돌아간다. 검수 지적 → doc.json 수정 → 3~4 반복.

## 양식이 바뀌거나 새 양식이 오면

이 스킬은 특정 조직의 양식을 모른다. 새 양식(어느 회사·은행·기관이든)이 오면
**`hwp-template-extractor` 스킬**로 템플릿을 추출해 `templates/<양식이름>.json`으로 넣고,
`selftest.py -t <양식이름>`이 통과하는지 확인한 뒤 사용한다.

## 구성

| 파일 | 내용 |
|---|---|
| `references/HWP_SCHEME.md` | **구현 노트** — 양식 무관 규칙(R)·COM 함정·검증 방법. 양식별 수치는 templates/가 원본 |
| `schema/doc.schema.json` | 문서 모델 JSON 스키마 |
| `scripts/build_hwp.py` | doc.json → .hwp/.pdf (한글 COM) |
| `scripts/verify_hwp.py` | 구조 규칙 + PDF 좌표 실측 + 내용 정합 + 페이지 PNG |
| `agents/hwp-doc-reviewer.md` | 육안 검증 서브에이전트 정의 |

## 실행상 주의

- **느리다.** 셀마다 COM 호출이 3~4회라 표 30개·5쪽 기준 **8~10분** 걸린다. 백그라운드로 돌리고
  `2> build.log` 로 진행을 남겨라(파이프로 `tail`을 걸면 끝날 때까지 아무것도 안 보인다).
- **앞선 실행이 남긴 한글 프로세스가 있으면 멈춘다.** `Dispatch`가 그 인스턴스에 붙기 때문이다.
  `--kill-stale` 옵션으로 정리할 수 있으나, 사용자가 열어 둔 문서가 있으면 함께 닫히니 확인하고 쓴다.
- 멈춘 것 같으면 한글 프로세스의 CPU가 증가하는지 보라. 증가가 0이면 보이지 않는 대화상자에
  걸린 것이다(`Get-Process Hwp | Select CPU` 를 두 번 찍어 비교).

## 알려진 한계

- **한글 설치 PC에서만** 동작한다(COM 자동화). 서버·WSL에서는 못 쓴다.
- 표 셀 **병합은 지원하지 않는다**(그룹 헤더 포함). 필요하면 표를 나눠라.
- 그림·차트 삽입은 미지원. 차트가 필요하면 이미지로 만들어 별도 삽입한다.
- 매크로(Script)가 들어 있는 hwp는 COM으로 열 때 프롬프트가 떠 멈춘다 — 레퍼런스 분석은
  `extract_profile.py`(파일 직접 파싱)로 하고 한글로 열지 마라.
