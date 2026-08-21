---
title: LLM이 항목당 객체를 bullet별로 쪼개 반환 → 병합 덮어쓰기로 요약 bullet이 1개로 붕괴
date: 2026-07-14
type: 실패→해결
status: resolved
stack: Python, OpenAI Responses API(gpt-5.6-luna), 보고서 생성(app.py)
tags: [LLM, JSON 스키마 변형, 병합 덮어쓰기, bullet 유실, ITEM_ID 중복, 보고서 생성, 방어적 파싱, 모델 교체]
---

# LLM이 항목당 객체를 bullet별로 쪼개 반환 → 병합 덮어쓰기로 요약 bullet이 1개로 붕괴

## 언제 참고
LLM에 "항목당 bullet N개"를 JSON으로 요청해 표에 채우는데, **일부 표(특정 배치)만** bullet이
1개씩만 나올 때. "모델이 게을러서 1개만 썼나?" 싶지만 실제로는 모델이 3개 다 썼는데
**병합 코드가 버린** 경우다. 모델을 새 버전으로 교체한 직후 증상이 나타나면 특히 의심.

## 무엇을 하려 했나
주간 보고서 생성 시, 수집 항목마다 `SUMMARY_BULLET_1/2/3` 3개를 LLM(gpt-5.6-luna)으로 생성해
상세 표에 채운다. 요청은 항목을 batch_size=6으로 나눠 `/responses` API에 보낸다(app.py:3930).

## 무슨 일이 있었나
보고서 아래쪽 표(2. 국가기관, 3. 금융연구소 섹션)의 각 항목이 bullet **1개씩만** 렌더됐다.
`report_data.json`을 보니 해당 항목들은 B1·B2가 비고 **B3만** 채워진 상태.

```text
idx24~29 (batch5, 6건 전부) bullets=1  ← 국가기관/금융연구소 표
그 외 batch(0~4,6) 항목        bullets=3  ← 정상
```

`llm_output.txt`(응답 원본 로그)를 배치별로 파싱하니 원인이 드러났다 — batch5 응답만 구조가 달랐다:

```text
# 정상 배치: 항목 1개 = 객체 1개 (bullet 3키)
{"ITEM_ID":"agency_1","SUMMARY_BULLET_1":"…","SUMMARY_BULLET_2":"…","SUMMARY_BULLET_3":"…"}

# 문제의 batch5: 같은 ITEM_ID를 bullet마다 별도 객체로 쪼갬
{"ITEM_ID":"agency_1","SUMMARY_BULLET_1":"…"},
{"ITEM_ID":"agency_1","SUMMARY_BULLET_2":"…"},
{"ITEM_ID":"agency_1","SUMMARY_BULLET_3":"…"}
```

즉 **모델은 bullet 3개를 다 생성**했다. 문제는 파싱/병합이었다.

## 원인
병합 코드가 같은 `ITEM_ID`가 다시 오면 **누적이 아니라 덮어쓰기**를 했다.

- 배치 누적: `collected[item_id] = raw` (app.py:3964) → 3개 조각 중 **마지막(B3)만** 남음.
- 최종 병합: `merge_bullets_into_report`가 `target[key] = clean_cell_value(raw.get(key))`로
  각 키를 **무조건 덮어씀**(없는 키는 ""로) → B1 객체가 B2·B3를 ""로 지우고, 다음 객체가 다시 지움.

결과적으로 마지막 조각(B3)만 살아 표에 1개만 출력. 근본 방아쇠는 **새 모델(gpt-5.6-luna)의
스키마 변형**(한 배치에서만 객체를 쪼갬)이지만, 유실의 직접 원인은 **덮어쓰기 병합**이다.

## 해결 (실제로 통한 것)
병합을 **덮어쓰기 → "빈 슬롯만 채움"**으로 바꿔, 같은 ITEM_ID로 조각이 여러 개 와도 합치게 함.
(app.py — `merge_bullet_object` 헬퍼 추가, 두 병합 지점 교체)

```python
BULLET_KEYS = ["SUMMARY_BULLET_1", "SUMMARY_BULLET_2", "SUMMARY_BULLET_3"]

def merge_bullet_object(dst, src):  # 빈 슬롯만 채워 병합(기존 값 보존)
    if dst is None: dst = {}
    for key, value in src.items():
        if key in BULLET_KEYS:
            if clean_cell_value(value) and not clean_cell_value(dst.get(key)):
                dst[key] = value
        elif not clean_cell_value(dst.get(key)) and clean_cell_value(value):
            dst[key] = value
    return dst

# 배치 누적: collected[item_id] = merge_bullet_object(collected.get(item_id), raw)   # app.py:3964
# 최종 병합: value 있고 target[key] 비었을 때만 채움                                  # merge_bullets_into_report
```

**검증**: 실제 batch5 응답(쪼개진 데이터)에 새 로직을 재현 적용 → 6개 항목 모두 bullet 3개로
복원 확인. 정상 배치는 빈 슬롯만 채우므로 결과 불변. Claude가 원인 규명·수정·검증까지 수행.

## 다음엔 이렇게 (재발 방지 규칙)
- **LLM JSON 병합은 "덮어쓰기" 금지 → "빈 슬롯만 채움".** 같은 키(ITEM_ID)로 부분 객체가
  중복해 올 수 있다고 가정하라. `dict[id] = raw`는 조용히 데이터를 버린다.
- **"모델이 게을러서 1개만 썼다"고 단정 말 것.** 표/셀에 값이 적게 나오면 먼저 **응답 원본
  로그(`llm_output.txt` 등)를 배치별로 파싱**해 모델이 실제 뭘 냈는지 확인하라. 균일하게
  한 슬롯(예: 전부 B3)만 남았다면 모델이 아니라 **병합 코드 신호**다.
- **모델 교체 직후의 회귀를 의심하라.** 새 모델은 스키마를 미묘하게 다르게(객체 분할, 키 순서,
  래핑) 낼 수 있다. 파서/병합을 스키마 변형에 방어적으로 짜 두면 프롬프트만으론 못 막는 걸 막는다.
- 프롬프트 강화("항목당 객체 1개")는 보조책일 뿐, **코드 방어가 1차 방어선**이다.

## 검증 방법
- 생성 후 `report_data.json`에서 각 항목 `SUMMARY_BULLET_1/2/3` 채움 개수를 배치 인덱스별로 집계.
  특정 배치만 1개면 병합 회귀 의심.
- 문제 재현 데이터가 있으면(예전 run의 `llm_output.txt`) 병합 함수만 떼어 적용해 3개 복원되는지 확인.

## 출처
프로젝트 `조사연구 자동화` / app.py:3964, `merge_bullet_object`·`merge_bullets_into_report` /
run `260710_1123`의 `llm_output.txt`·`report_data.json` / 2026-07-14 세션.
환경: Windows, PyInstaller 빌드. 모델: gpt-5.4-mini → gpt-5.6-luna 교체 직후 발생.
