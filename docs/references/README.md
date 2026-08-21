# 참고자료 (References)

CLAUDE.md에 직접 싣지는 않지만 작업 시 참고하는 자료를 모은다. (예: UI 참고자료, 디자인 토큰,
외부 문서 요약 등) 표준(strict rule)과 달리 **참고(reference)** 성격이다.

분류가 늘어나면 하위 폴더로 나눈다. 예:

```
references/
├─ ui/          # UI 참고자료
└─ ...
```

## 목록

- [마크다운 렌더링 함정](./markdown-rendering.md) — react-markdown/remark-gfm 렌더링
  시 자주 겪는 문제와 대응책 (예: 물결 하나 `~x~`가 취소선 되는 문제 → `singleTilde: false`)
- [Windows DPAPI 로컬 시크릿 저장](./dpapi-secret-storage.md) — API 키를 평문 없이 사용자
  PC에 저장 (CryptProtectData via ctypes + b64 폴백) · `DPAPI, ctypes, openai_key.bin, secret at rest`
- [Google News 링크 → 원문 URL 복원](./google-news-url-decode.md) — news.google.com
  리다이렉트 토큰을 batchexecute RPC로 디코딩 · `Google News 디코딩, batchexecute, garturlreq, RSS search`
- [키워드 AND/OR → 검색 쿼리 생성](./keyword-and-or-query.md) — 사용자 키워드 조합을
  방어적으로 정규화해 검색엔진 쿼리로 변환 · `AND OR 검색, 그룹 쿼리, normalize_keyword_filters, 따옴표 이스케이프`
- [로컬 앱 단일 인스턴스 + 유휴 종료](./local-server-idle-shutdown.md) — 127.0.0.1 HTTP
  서버 싱글톤(connect_ex 프로브)과 유휴 자동 종료 · `로컬 서버, singleton, idle shutdown, ThreadingHTTPServer`
