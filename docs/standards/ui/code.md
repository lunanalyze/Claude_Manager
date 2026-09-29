# UI 표준 — Code (코드 블록)

> **표면 질감(다크·라이트·보더드)은 [UI 표준 워크숍](./index.md)의 `code` 선택이 정한다**(현재 `light`).
> 이 문서는 그 위에서 **조각별 색 토큰·언어 표시·색 입히기 방법·접근성** 등 사용 규칙을 다룬다.

화면에 코드(스니펫·산식·AI 답의 코드 블록)를 보여 줄 때 적용한다.

## 색 토큰

색은 원시 hex 가 아니라 **CSS 변수 토큰**으로 정의하고(`app/globals.css`), 코드 조각의 클래스를 토큰에 연결한다.
같은 종류의 조각은 **언어가 달라도 같은 색**이다(Python 의 `def`, Java 의 `public`, SQL 의 `SELECT` 는 모두 키워드).

| 토큰 | 조각 | 라이트 | 다크 | 출처 |
|---|---|---|---|---|
| `--code-bg` | 배경 | `hsl(210 40% 98%)` | `hsl(222 45% 8%)` | 라이트: 워크숍 `code-light` |
| `--code-fg` | 기본 글자 | `hsl(222 47% 20%)` | `hsl(210 40% 90%)` | 라이트: 워크숍 `code-light` |
| `--code-keyword` | 키워드·내장 이름 | `hsl(262 60% 50%)` | `hsl(262 85% 78%)` | 라이트: 워크숍 `.tk-k` |
| `--code-function` | 함수·속성 이름 | `hsl(221 70% 45%)` | `hsl(213 90% 72%)` | 라이트: 워크숍 `.tk-f` |
| `--code-number` | 숫자 | `hsl(20 80% 45%)` | `hsl(24 90% 66%)` | 라이트: 워크숍 `.tk-n` |
| `--code-string` | 문자열 | `hsl(142 60% 30%)` | `hsl(142 55% 62%)` | 추가 (2026-09-29) |
| `--code-comment` | 주석 (기울임) | `hsl(215 16% 47%)` | `hsl(215 20% 58%)` | 추가 (2026-09-29) |
| `--code-type` | 타입·클래스 이름 | `hsl(188 70% 32%)` | `hsl(188 65% 60%)` | 추가 (2026-09-29) |

- **추가 값의 기준**: 문자열·주석·타입과 다크 값은 워크숍에 없던 것을 ALM 프로젝트에서 처음 정했다. 워크숍 값과 같은
  채도·명도 계열로 맞췄고, 다크 값은 **같은 색상(hue)에서 명도만 올렸다**(색을 뒤집지 않는다).
- 주석은 색만이 아니라 **기울임**으로도 구분한다(색만으로 정보를 전달하지 않는다 — 공통 원칙 2).
- 워크숍의 `code-dark`·`code-bordered` 변형에도 같은 역할의 `.tk-s`(문자열)·`.tk-c`(주석)·`.tk-t`(타입)를 두었다.

## 코드 블록 구성

- **머리줄**: 왼쪽에 **언어 이름**(Python·SQL·TypeScript…), 오른쪽에 **복사 버튼**("복사" → "복사됨"). 항상 보이게 둔다
  (마우스를 올려야 나타나는 버튼은 터치·키보드 사용자가 못 찾는다).
- 언어가 없으면 "코드", 산식·계산식은 `text` 로 적고 "텍스트"로 표시한다. 모르는 언어 이름은 적힌 그대로 보여 준다.
- 본문은 고정폭 글꼴, 줄바꿈 없이 **가로 스크롤**(`overflow-x: auto`). 페이지 전체가 가로로 밀리면 안 된다.
- 인라인 코드(문장 속 `이름`)는 같은 고정폭 글꼴 + 옅은 배경, 색은 입히지 않는다.

## 색 입히기 (구현)

1. **라이브러리**: highlight.js 를 쓴다(마크다운이면 `rehype-highlight`). 스트리밍 중 글자가 올 때마다 다시 칠해도
   깜빡이지 않는다(동기 처리). VS Code 수준의 정확도가 꼭 필요할 때만 Shiki 를 검토한다(비동기·무거움).
2. **쓰는 언어만 등록**한다(`highlight.js/lib/languages/<언어>`) — 전체 번들을 싣지 않는다. 각 문법의 별칭(py·ts·sh·yml)은 함께 등록된다.
3. **자동 감지는 끈다**(`detect: false`). 언어가 안 적힌 블록과 `text` 는 색을 입히지 않는다(엉뚱한 언어로 칠해지는 것을 막는다).
4. highlight.js 클래스 → 토큰 연결:

```css
.hljs-keyword, .hljs-built_in, .hljs-literal            { color: var(--code-keyword); }
.hljs-title, .hljs-title.function_, .hljs-attr, .hljs-property { color: var(--code-function); }
.hljs-number                                            { color: var(--code-number); }
.hljs-string, .hljs-regexp                              { color: var(--code-string); }
.hljs-comment, .hljs-quote, .hljs-meta                  { color: var(--code-comment); }
.hljs-comment, .hljs-quote                              { font-style: italic; }
.hljs-type, .hljs-title.class_                          { color: var(--code-type); }
```

## AI 답의 코드 블록

- 모델에게 **여는 ``` 뒤에 언어를 붙이게** 한다(예: ```` ```python ````, 산식은 ```` ```text ````) — 붙이지 않으면 언어 표시도 색도 없다.
- 코드 블록은 산식·코드처럼 **글자 그대로 보여야 할 때만** 쓴다. 숫자 결과를 코드 블록에 넣지 않는다.

## 참고 구현

ALM (`lunanalyze/ALM`) — `web/src/components/markdown.tsx`(머리줄·복사·rehype-highlight 등록),
`web/src/app/globals.css`(`--code-*` 토큰·`.hljs-*` 연결).

---

> Claude_Manager UI 표준 요소 문서. 룩은 워크숍 `selections.json` 의 `code` 가 정한다.
