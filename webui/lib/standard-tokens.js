// 워크숍 선택(selections.json)에서 Claude_Manager 대시보드용 표준 토큰을 파생한다.
// 순수 모듈(fs 미의존). layout이 resolvedSelections()를 넘겨 사용한다.
//
// globals.css 는 `var(--std-accent-light/dark, 폴백)`, `var(--std-radius, 폴백)` 로 이 값을
// 참조하므로, 아래 <style> 한 조각만 주입하면 대시보드 전체가 선택된 테마·반경을 따른다.

// 테마 → 대시보드 강조색(라이트/다크 각각). 다크는 어두운 배경에서 대비가 서도록 밝게.
const THEME = {
  blue:    { light: "hsl(221 83% 53%)", dark: "hsl(217 91% 66%)" },
  violet:  { light: "hsl(262 83% 58%)", dark: "hsl(262 90% 72%)" },
  emerald: { light: "hsl(160 84% 33%)", dark: "hsl(160 70% 50%)" },
  slate:   { light: "hsl(215 28% 30%)", dark: "hsl(215 20% 66%)" },
  rose:    { light: "hsl(347 77% 50%)", dark: "hsl(347 85% 68%)" },
  amber:   { light: "hsl(30 90% 42%)",  dark: "hsl(38 95% 58%)" },
};
const RADIUS = { sharp: "0.125rem", subtle: "0.375rem", rounded: "0.5rem", round: "0.9rem" };
const DENSITY = { compact: "dense-compact", cozy: "", comfortable: "dense-comfortable" };

// 주입할 <style> 내용 — :root에 표준 토큰을 얹는다.
export function standardStyle(sel) {
  const t = THEME[sel.theme] ?? THEME.blue;
  const r = RADIUS[sel.radius] ?? RADIUS.rounded;
  return `:root{--std-accent-light:${t.light};--std-accent-dark:${t.dark};--std-radius:${r};}`;
}

// <body>에 붙일 밀도 클래스
export function bodyClass(sel) {
  return DENSITY[sel.density] ?? "";
}

// <body>에 붙일 data-* (카드/사이드바 변형을 대시보드 컴포넌트에 반영)
export function bodyData(sel) {
  return { "data-std-card": sel.card, "data-std-sidenav": sel.sidebarnav };
}
