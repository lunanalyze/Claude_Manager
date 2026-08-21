# Google News 링크 → 원문 기사 URL 복원 (batchexecute 디코딩)

> 참고(reference) 문서 · 강제 표준 아님. "이런 요구를 이렇게 풀었고, 이렇게 검증한다"는 재사용 사례.

- **프로젝트**: 조사연구 도우미 (ResearchReportAutomation) / `collector.py`
- **스택/버전**: Python 3.10+ 표준 라이브러리(`urllib`, `re`, `json`, `html`) + `lxml.etree`(RSS 파싱).
  선택적으로 `googlenewsdecoder`(gnewsdecoder) 라이브러리 폴백.
- **관련 파일**: `collector.py:1006-1060`(base64 토큰·batchexecute 디코딩), `collector.py:890-909`(폴백 래퍼), `collector.py:1063-1152`(RSS 검색·수집), `collector.py:85-131`(Http)
- **작성일**: 2026-07-07
- **키워드**: Google News 디코딩, news.google.com, batchexecute, DotsSplashUi, garturlreq, data-n-a-sg, data-n-a-ts, RSS search, when:Nd after: before:, 원문 URL 복원, gnewsdecoder

## 언제 참고
- Google News RSS/검색 결과의 **리다이렉트 링크(`news.google.com/articles/...`)를 실제 언론사
  원문 URL로 풀어야** 할 때.
- 특정 키워드·기간으로 **한국 뉴스**를 RSS로 긁어올 때(`hl=ko&gl=KR&ceid=KR:ko`).
- Google이 URL 인코딩 방식을 바꿔 기존 디코더가 깨졌을 때 원리를 이해해 고쳐야 할 때.

## 문제 / 목표
Google News RSS(`/rss/search`)는 기사 링크를 **`news.google.com/articles/<base64토큰>`** 형태의
불투명한 리다이렉트로 준다. 이걸 브라우저로 열면 원문으로 튕기지만, 서버에서 원문 URL을 얻으려면
토큰을 디코딩해야 한다. 과거엔 base64를 그냥 디코드하면 URL이 나왔지만, Google이 **서명(signature)
+타임스탬프**를 요구하는 내부 RPC(`batchexecute`)로 바꿔 단순 디코딩이 불가능해졌다.

## 접근 방식 (핵심 아이디어)
원문 URL 복원은 **3단계 RPC 재현**이다:
1. 링크 경로에서 base64 **토큰** 추출 (`/articles/<token>` 또는 `/read/<token>`).
2. `news.google.com/articles/<token>` 페이지를 GET → HTML의 `data-n-a-sg`(서명)·`data-n-a-ts`
   (타임스탬프) 속성 스크레이프.
3. 토큰+서명+타임스탬프로 `garturlreq` 페이로드를 만들어 **`/_/DotsSplashUi/data/batchexecute`**
   에 POST → 응답에서 원문 URL 파싱.

RSS 수집 자체는 `google_news_and_query`로 만든 쿼리에 `when:Nd after: before:` 기간 필터를 붙여
`/rss/search`를 부른 뒤 `<item>`을 순회한다(디코딩은 나중에 필요할 때만).

## 핵심 코드

```python
# collector.py:1006 — 경로에서 base64 토큰만 뽑기 (/articles|/read 뒤 마지막 세그먼트)
def google_news_base64_token(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    if parsed.netloc.lower().endswith("news.google.com") and len(parts) >= 2 and parts[-2] in {"articles", "read"}:
        return parts[-1]
    return ""
```

```python
# collector.py:1017 — 핵심: sg/ts 스크레이프 → garturlreq batchexecute POST → 원문 URL
def decode_google_news_url(http: Http, google_link: str) -> str:
    token = google_news_base64_token(google_link)
    if not token:
        return ""
    signature = timestamp = ""
    for prefix in ["articles", "rss/articles"]:                 # 두 경로 다 시도
        page = decode_html(http.get(f"https://news.google.com/{prefix}/{token}", timeout=10, attempts=1))
        signature_match = re.search(r'data-n-a-sg="([^"]+)"', page)
        timestamp_match = re.search(r'data-n-a-ts="([^"]+)"', page)
        if signature_match and timestamp_match:
            signature = html_lib.unescape(signature_match.group(1))
            timestamp = html_lib.unescape(timestamp_match.group(1))
            break
    if not signature or not timestamp:
        return ""
    payload = [[[ "Fbv4je",
        ('["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,'
         f'null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"{token}",{timestamp},"{signature}"]'),
        None, "generic" ]]]
    raw = http.post_form(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute",
        {"f.req": json.dumps(payload, separators=(",", ":"))},
        referer=f"https://news.google.com/articles/{token}",
        timeout=10,
    )
    text = decode_html(raw)
    parts = text.split("\n\n", 1)                               # batchexecute는 잡음 프리픽스 후 \n\n
    if len(parts) < 2:
        return ""
    parsed = json.loads(parts[1])
    decoded = json.loads(parsed[0][2])[1]                       # 이중 인코딩된 JSON: 바깥[0][2] 문자열 안에 배열
    return clean_text(decoded)
```

```python
# collector.py:890 — 얇은 래퍼: 쿼리스트링에 원문이 이미 있으면 그걸, 아니면 라이브러리 디코더로 폴백
def original_url_from_google_news(http: Http, google_link: str) -> str:
    if not is_google_news_url(google_link):
        return google_link
    params = urllib.parse.parse_qs(urllib.parse.urlparse(google_link).query)
    for key in ["url", "u", "q"]:                               # 구형 링크는 ?url=... 로 원문 노출
        value = params.get(key, [""])[0]
        if value and not is_google_news_url(value):
            return value
    if gnewsdecoder is None:
        raise RuntimeError("googlenewsdecoder is not installed")
    result = gnewsdecoder(google_link)                          # 라이브러리에 위임(위 원리와 동일)
    # … status/유효성 검사 후 decoded_url 반환
```

비자명한 점:
- `parsed[0][2]`가 **문자열**이고 그 안에 또 JSON 배열이 들어있다 → `json.loads`를 **두 번** 한다.
- batchexecute 응답 앞에는 `)]}'` 류 안티-JSON 프리픽스가 붙어 `\n\n`로 분리 후 뒤쪽만 파싱.
- `attempts=1`(재시도 없음): 디코딩은 실패해도 치명적이지 않아 빨리 포기하고 다음 후보로.

## 동작 원리 / 흐름
- 수집(`collect_google_news`, `collector.py:1063`)은 링크를 **일단 Google 리다이렉트 그대로**
  `Item.url`에 담고 `extra["google_news_url"]`에 보존. 실제 원문 디코딩은 사용자가 항목을 열거나
  후처리(`populate_original_urls`) 시점에만 수행 → 불필요한 요청 절약.
- RSS 쿼리에 `when:{lookback}d after:{start} before:{end+1}`를 함께 넣어 기간을 **이중으로** 좁히고,
  파싱 후 `pubDate`로 한 번 더 날짜 필터(`start_date <= parsed <= end_date`).
- 실패 시: 토큰 없음/서명 없음/응답 형식 불일치면 `""` 반환(예외 대신 빈 값) → 호출측이 리다이렉트
  링크를 그대로 쓰도록 degrade.

## 검증 방법 (How to verify)

```bash
cd "C:\Users\JBB\Desktop\조사연구 자동화"
# 1) 실제 RSS에서 링크 하나 얻어 디코딩까지 (네트워크 필요)
python -c "import collector, datetime as dt; h=collector.Http(); \
items=collector.collect_google_news(h, days=7, today=dt.date.today(), news_kind='bank', \
  queries=[['금융']], max_per_filter=1); \
print('items:', len(items)); \
u=items[0].url if items else ''; print('google_link:', u[:60]); \
print('decoded:', collector.decode_google_news_url(h, u)[:80] if u else '(none)')"
# 기대:
#   items: 1
#   google_link: https://news.google.com/rss/articles/CBM...  (또는 /articles/)
#   decoded: https://<언론사도메인>/...   ← news.google.com 이 아닌 실제 원문
```

```bash
# 2) 토큰 추출만 오프라인으로 (네트워크 불필요)
python -c "import collector; \
print(collector.google_news_base64_token('https://news.google.com/articles/CBMiABCD?x=1'))"
# 기대: CBMiABCD
```

- 정상 신호: `decoded`가 `news.google.com`이 아닌 언론사 도메인(`.co.kr`, `.com` 등)으로 시작.
- 흔한 오판: `decoded`가 빈 문자열 → Google이 서명 로직/`Fbv4je` RPC id를 바꿨을 가능성. HTML에서
  `data-n-a-sg`가 여전히 나오는지, batchexecute 응답 구조(`parsed[0][2]`)가 그대로인지부터 확인.

## 결정과 함정 (왜 이렇게 했나)
- **직접 batchexecute 재현 + 라이브러리 폴백 둘 다 보유**: `decode_google_news_url`은 의존성 없이
  동작하고 원리를 소유(고장 시 직접 수리 가능). `original_url_from_google_news`는 `gnewsdecoder`가
  있으면 그쪽에 위임 → 유지보수 부담 분산.
- **함정 — Google 내부 RPC는 계약이 아님**: `Fbv4je` id, `garturlreq` 페이로드 배열 형태, 응답
  중첩(`[0][2]` 안의 JSON 문자열)은 비공개 API라 예고 없이 바뀐다. 깨지면 이 문서의 3단계(토큰→sg/ts→
  batchexecute)를 기준으로 각 단계 산출물을 찍어보며 어디서 형식이 변했는지 국소화.
- **함정 — 지역/언어 고정**: 페이로드 안 `"US:en"`과 RSS의 `hl=ko&gl=KR&ceid=KR:ko`가 섞여 있음.
  다른 지역 뉴스면 RSS 파라미터를 바꿔야 하고, 서명 페이지 언어와 무관하게 디코딩은 동작.
- **함정 — 레이트리밋**: 항목마다 GET+POST 2회. 대량이면 차단당하기 쉬워 **열람 시점 lazy 디코딩**
  으로 요청을 미룬 설계.

## 다른 프로젝트에 재사용하려면 (체크리스트)
- [ ] `Http`(retry+ProxyHandler({})+CookieProcessor) 또는 동급 세션 객체 필요(`collector.py:85`).
- [ ] `decode_html`(`collector.py:133`)로 인코딩 안전 디코드 — 없으면 `bytes.decode('utf-8','replace')`.
- [ ] `lxml`(RSS `etree.fromstring`) 설치. RSS만 쓰고 디코딩 불필요면 lxml만으로 충분.
- [ ] 지역 바꾸려면 RSS의 `hl/gl/ceid`와(필요 시) 페이로드 로케일 조정.
- [ ] 위 검증 1)로 실제 원문 도메인 복원 확인.

## 출처
- `collector.py:1006-1060`, `collector.py:890-909`, `collector.py:1063-1152`. 비공개 Google RPC에
  의존하므로 재현 전 현재 코드·실제 응답과 대조 필수.
