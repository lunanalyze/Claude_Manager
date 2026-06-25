# UI 표준 — Typography / Font

> 상태: **제안 (수락 대기)**

## 글꼴 (font-family)

- **본문/UI**: `Pretendard` 우선 → 시스템 폰트 폴백. *(한글 가독성 우수, 제안)*
  ```
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI",
               Roboto, "Helvetica Neue", "Noto Sans KR", sans-serif;
  ```
- **코드/모노**: `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`
- Next.js에서는 `next/font` 로 로드(서브셋·자체 호스팅). 웹폰트 직접 `<link>` 지양.

## 타입 스케일

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
