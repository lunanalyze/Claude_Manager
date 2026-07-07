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
