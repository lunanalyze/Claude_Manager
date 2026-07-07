# UI 표준 — Typography / Font

> **위계(제목↔본문의 크기·굵기·대비)는 [UI 표준 워크숍](./index.md)의 `type` 선택이 정한다**
> (또렷한 대비 / 차분한 균형 / 촘촘한 실용). 이 문서는 **글꼴 선택·로딩과 가독 규칙**을 다룬다.

## 글꼴 (font-family)

- **본문/UI**: `Pretendard` 우선 → 시스템 폰트 폴백. *(한글 가독성 우수, 제안)*
  ```
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI",
               Roboto, "Helvetica Neue", "Noto Sans KR", sans-serif;
  ```
- **코드/모노**: `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`
- Next.js에서는 `next/font` 로 로드(서브셋·자체 호스팅). 웹폰트 직접 `<link>` 지양.

## 타입 스케일 (참고 기본값)

구체적 크기·굵기·대비 강도는 워크숍 `type` 선택(대비/균형/촘촘)으로 결정된다.
아래는 **'균형'을 골랐을 때의 참고 기본값**이며, 위계 단계 이름은 프로젝트 공통으로 쓴다.

| 용도 | Tailwind | 크기/행간 | 굵기 |
|------|----------|-----------|------|
| Display (페이지 타이틀) | `text-3xl` | 30 / 36 | `font-bold` |
| H1 (섹션) | `text-2xl` | 24 / 32 | `font-semibold` |
| H2 | `text-xl` | 20 / 28 | `font-semibold` |
| H3 | `text-lg` | 18 / 28 | `font-medium` |
| Body (기본) | `text-base` | 16 / 24 | `font-normal` |
| Small / 보조 | `text-sm` | 14 / 20 | `font-normal` |
| Caption / 라벨 | `text-xs` | 12 / 16 | `font-medium` |

## 규칙

- 본문 기본은 `text-base text-foreground`, 보조 설명은 `text-sm text-muted-foreground`.
- 줄 길이는 본문 `max-w-prose`(약 65ch) 권장. 무한정 늘리지 않는다.
- 굵기는 `normal / medium / semibold / bold` 4단계만 사용.
- 한글+영문 혼용 시 자간 임의 조정 금지(폰트 기본값 사용).
