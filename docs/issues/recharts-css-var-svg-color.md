---
title: recharts 차트 색이 CSS var()로 불안정 — SVG엔 JS 색 매핑으로 전달
date: 2026-07-07
type: 실패→해결
status: workaround
stack: recharts, Tailwind/CSS 변수 토큰
tags: [recharts, css variable, hsl var, svg stroke fill, gradient stop, 차트 색, theme, 테마 토큰]
---

# recharts 차트 색이 CSS var()로 불안정 — SVG엔 JS 색 매핑으로 전달

## 언제 참고
- recharts 시리즈 색(`stroke`/`fill`/그라디언트 `stopColor`)을 **테마 토큰(CSS 변수)** 으로 입히려 할 때.
- 테마를 바꿔도 차트 색이 안 따라오거나, 그라디언트가 비거나, 색이 들쭉날쭉할 때.

## 무엇을 하려 했나
UI 셸과 동일하게 `hsl(var(--chart-1))` 같은 **토큰**으로 차트 색을 지정.

## 무슨 일이 있었나
SVG presentation 속성(`stroke`, `fill`, `<stop stopColor>`)에서 `hsl(var(--chart-1))` 가
**일관되게 반영되지 않음**(특히 그라디언트 stop, 런타임 테마 전환 시).

## 원인
recharts는 색을 SVG 속성·내부 계산에 사용하는데, **CSS 변수는 SVG presentation 속성에서
계산·상속 타이밍이 불안정**하다. 그라디언트 `<stop stopColor>` 등은 계산된 실제 색이 필요하다.

## 해결 (실제로 통한 것)
테마 → **실제 HSL 문자열 맵(JS)** 을 만들어 recharts에 직접 넘긴다. (셸 UI는 계속 토큰 사용.)

```jsx
// webui/app/ui-standard/demos.jsx — "CSS var는 SVG에서 불안정 → JS 매핑"
export const THEME_COLORS = {
  blue:    { c1: "hsl(221 83% 53%)", c2: "hsl(262 83% 63%)" },
  violet:  { c1: "hsl(262 83% 58%)", c2: "hsl(291 70% 55%)" },
  // …테마별
};
const colors = THEME_COLORS[sel.theme] ?? THEME_COLORS.blue;
<Area stroke={colors.c1} fill={`url(#${gid})`} /> // 그라디언트 stop도 colors.c1로
```

## 다음엔 이렇게 (재발 방지 규칙)
- **recharts 색은 CSS 토큰 `var()`에 의존하지 말고 JS 색 맵으로 넘긴다.**
- 버튼·카드 등 일반 UI(HTML/CSS)는 토큰 `var()` 그대로 OK — **SVG 차트만 예외**로 취급.
- 테마가 여러 개면 `{테마: {c1,c2,...}}` 맵을 두고 선택값으로 조회해 전달한다.

## 검증 방법
테마를 바꿔가며 선/막대/그라디언트 색이 실제로 바뀌는지 **브라우저**에서 확인
(차트 렌더 검증은 [recharts SSR curl 이슈](./recharts-ssr-curl-empty.md) 참고 — curl로는 안 보임).

## 출처
이 repo webui UI 표준 워크숍 차트 룩앤필 구현(2026-07-07).
