# 사용자 키워드 필터(AND/OR) → 검색엔진 쿼리 문자열 생성

> 참고(reference) 문서 · 강제 표준 아님. "이런 요구를 이렇게 풀었고, 이렇게 검증한다"는 재사용 사례.

- **프로젝트**: 조사연구 도우미 (ResearchReportAutomation) / `collector.py`
- **스택/버전**: Python 3.10+ 표준 라이브러리만.
- **관련 파일**: `collector.py:817-868`(normalize/and/or/quote), `collector.py:1090-1104`(쿼리 조립·기간필터)
- **작성일**: 2026-07-07
- **키워드**: 키워드 필터, AND OR 검색, 그룹 쿼리, Google News query, 따옴표 이스케이프, per-filter limit, 방어적 파싱, normalize_keyword_filters

## 언제 참고
- UI에서 사용자가 만든 **`[A AND B] OR [C] OR [D AND E]`** 식 키워드 조합을 검색엔진 쿼리
  문자열로 변환할 때.
- **여러 포맷(레거시 flat 리스트 / 그룹 dict / 문자열)** 이 섞여 들어오는 입력을 하나의 정규형으로
  흡수해야 할 때.
- 필터마다 **수집 상한(limit)** 을 따로 두고 싶을 때.

## 문제 / 목표
README의 예시처럼 사용자는 `["전북은행" AND "리스크"] OR ["전북은행" AND "금리"] OR ["JB금융"]`
같은 조합을 만든다. 이걸 Google News가 이해하는 쿼리(`"A" "B"`=AND, ` OR `=OR)로 바꿔야 한다.
게다가 저장 포맷이 시대별로 달라(옛날엔 flat `["a","b"]`, 지금은 `{"groups":[...], "limit":N}`)
**어떤 모양이 와도** 안 깨지고 정규화해야 하며, 빈/중복/따옴표 포함 키워드도 안전해야 한다.

## 접근 방식 (핵심 아이디어)
`normalize_keyword_filters`가 **모든 입력 형태를 `[{"keywords":[...], "limit":N}, ...]`
정규형으로** 흡수하는 단일 관문이다. 그 위에:
- 한 그룹 내부는 **AND**(`google_news_and_query`: 공백 join, Google에선 공백=AND),
- 그룹 사이는 **OR**(`google_news_or_query`),
- 각 키워드는 `google_news_quote`로 따옴표 감싸 **정확 구문(exact phrase)** 강제.

## 핵심 코드

```python
# collector.py:817 — 만능 정규화 관문. dict/list/str 어떤 입력이든 흡수
def normalize_keyword_filters(value, default_limit: int = 3) -> list[dict]:
    if isinstance(value, dict):
        raw_groups = value.get("groups") if "groups" in value else [[x] for x in value.get("keywords", [])]
    else:
        raw_groups = value
    filters: list[dict] = []
    if not isinstance(raw_groups, list):
        return filters                               # 방어: 리스트 아니면 빈 결과(예외 안 냄)
    for raw_group in raw_groups:
        limit = default_limit
        if isinstance(raw_group, dict):
            raw_items = raw_group.get("keywords") or raw_group.get("items") or []
            try:
                limit = int(raw_group.get("limit") or raw_group.get("max") or default_limit)
            except Exception:
                limit = default_limit
        elif isinstance(raw_group, str):
            raw_items = [raw_group]                   # 홑 문자열도 1-그룹으로
        elif isinstance(raw_group, list):
            raw_items = raw_group
        else:
            continue                                  # 미지 타입은 조용히 스킵
        group, seen = [], set()
        for raw in raw_items:
            text = clean_text(str(raw or "")).strip().strip('"').strip("'").strip()
            if text and text not in seen:             # 빈값·중복 제거
                group.append(text); seen.add(text)
        if group:
            filters.append({"keywords": group, "limit": max(1, min(100, limit))})  # limit 클램프
    return filters
```

```python
# collector.py:851 — 그룹 사이 OR. 다중 키워드 그룹은 괄호로 묶어 AND 유지
def google_news_or_query(keyword_groups) -> str:
    parts = []
    for group in normalize_keyword_groups(keyword_groups):
        quoted = [google_news_quote(k) for k in group]
        if len(quoted) == 1:
            parts.append(quoted[0])
        elif quoted:
            parts.append("(" + " ".join(quoted) + ")")   # (…)로 OR 사이 우선순위 고정
    return " OR ".join(parts)

# collector.py:862 — 따옴표 이스케이프(내부 " → \") 후 정확구문 강제
def google_news_quote(keyword: str) -> str:
    return f'"{str(keyword).replace(chr(34), chr(92)+chr(34))}"'

# collector.py:867 — 그룹 내부 AND: 공백 join (Google에서 공백=AND)
def google_news_and_query(group: list[str]) -> str:
    return " ".join(google_news_quote(k) for k in group if str(k).strip())
```

```python
# collector.py:1096 — 조립 + 부정 site 필터 + 기간(when/after/before)
if news_kind == "other":
    query = f"{query} -site:fsc.go.kr -site:fss.or.kr -site:bok.or.kr"   # 국가기관 도메인 제외(중복 방지)
dated_query = (f"{query} when:{lookback_days}d "
    f"after:{start_date.isoformat()} before:{(end_date + dt.timedelta(days=1)).isoformat()}")
```

비자명한 점:
- `strip('"').strip("'")`로 사용자가 이미 감싼 따옴표를 벗긴 뒤 `google_news_quote`가 **한 번만**
  다시 감싼다 → 이중 따옴표 방지.
- `limit`은 `max(1, min(100, limit))`로 클램프해 악성/오타 값이 수집량 폭주로 이어지지 않게.
- `before:`는 **end_date + 1일** — Google의 `before:`가 exclusive라 마지막 날을 포함시키려는 보정.

## 동작 원리 / 흐름
- `collect_google_news`는 정규형 필터를 순회하며 필터별로 AND 쿼리를 만들고 기간 필터를 붙여 RSS를
  호출, `limit`만큼만 모은다(`collected_for_filter >= limit`이면 중단).
- `seen_links`로 필터 간 중복 링크 제거 → 여러 필터가 같은 기사를 잡아도 1건.
- 빈 입력/전부 무효면 `filters == []` → 빈 결과 반환(수집 0건, 예외 없음).

## 검증 방법 (How to verify)

```bash
cd "C:\Users\JBB\Desktop\조사연구 자동화"
# 다양한 입력 포맷이 같은 정규형/쿼리로 수렴하는지 (네트워크 불필요)
python -c "import collector as c; \
print('flat  :', c.normalize_keyword_filters(['A','B'])); \
print('groups:', c.normalize_keyword_filters({'groups':[['전북은행','리스크'],['JB금융']],'':0})); \
print('dup   :', c.normalize_keyword_filters([['A','A','']])); \
print('or    :', c.google_news_or_query([['전북은행','리스크'],['JB금융']])); \
print('and   :', c.google_news_and_query(['전북은행','리스크'])); \
print('quote :', c.google_news_quote('a\"b'))"
# 기대(요지):
#   flat  : [{'keywords': ['A'], 'limit': 3}, {'keywords': ['B'], 'limit': 3}]
#   groups: [{'keywords': ['전북은행','리스크'], 'limit': 3}, {'keywords': ['JB금융'], 'limit': 3}]
#   dup   : [{'keywords': ['A'], 'limit': 3}]          ← 중복·빈값 제거
#   or    : ("전북은행" "리스크") OR "JB금융"
#   and   : "전북은행" "리스크"
#   quote : "a\"b"                                       ← 내부 따옴표 이스케이프
```

- 정상 신호: flat 리스트의 각 항목이 **독립 OR 그룹**, dict `groups`는 **그룹 내부 AND**로 나뉨.
  중복/빈 키워드가 사라지고 따옴표가 정확히 한 겹.
- 흔한 오판: `or` 결과에서 홑 키워드 그룹에 괄호가 없음 → **정상**(불필요한 `("x")` 안 만듦).

## 결정과 함정 (왜 이렇게 했나)
- **단일 정규화 관문**: 파싱을 한 곳(`normalize_keyword_filters`)에 몰아, 신구 저장 포맷·UI 변경을
  이 함수 하나만 고쳐 흡수. OR/AND 빌더는 정규형만 신뢰.
- **방어적 파싱(예외 대신 스킵/빈값)**: 사용자 편집 데이터라 타입이 뭐든 올 수 있음 → 미지 타입은
  `continue`, 파싱 불가 limit는 기본값. 수집이 통째로 죽지 않게.
- **함정 — 공백=AND는 엔진 의존**: Google News/구글 검색은 공백이 AND지만, 다른 엔진은 AND 연산자를
  명시해야 할 수 있음. `google_news_and_query`의 join 구분자를 엔진에 맞게 교체.
- **함정 — before: 경계**: exclusive라 +1일 보정 없으면 마지막 날 기사 누락.

## 다른 프로젝트에 재사용하려면 (체크리스트)
- [ ] `clean_text`(공백 정리) 대체 필요 — 없으면 `re.sub(r"\s+"," ",s).strip()`.
- [ ] 엔진별 AND/OR 문법 확인(공백=AND? `AND` 키워드? `+`?)해 빌더 구분자 교체.
- [ ] `limit` 클램프 상·하한을 도메인에 맞게 조정.
- [ ] 위 검증 스니펫으로 포맷 수렴·이스케이프 확인.

## 출처
- `collector.py:817-868`, `collector.py:1090-1104`. 원본이 바뀔 수 있으니 재현 전 현재 코드와 대조.
