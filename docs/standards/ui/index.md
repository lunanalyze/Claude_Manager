# UI 표준 (UI Standard) — 기반

> 상태: **제안 (수락 대기)**. 사용자가 수락하면 "확정"으로 바꾼다.

스택: **Next.js(React) + Tailwind CSS + shadcn/ui**(Radix 기반). 컴포넌트는 라이브러리 설치가
아니라 **shadcn 방식으로 repo에 복사해 소유**한다. 색·간격 등은 **CSS 변수 토큰**으로 테마화한다.

UI 작업 시 아래 양식별 세부 표준을 함께 참고한다:
- [Typography / Font](./typography.md)
- [Button](./button.md)
- [Table](./table.md)
- [Image](./image.md)
- [Chart / Graph](./chart.md)

---

## 디자인 토큰 (CSS 변수)

`app/globals.css`에 정의하고 Tailwind가 참조한다. 기본은 light/dark 모두 제공. (HSL 값)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --card: 0 0% 100%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --primary: 221.2 83.2% 53.3%;          /* 메인 액션 (파랑) */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 72% 51%;              /* 삭제·위험 */
  --destructive-foreground: 210 40% 98%;
  --radius: 0.5rem;
}
.dark {
  --background: 222.2 47.4% 11.2%;
  --foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --card: 222.2 47.4% 11.2%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 55%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --destructive: 0 62.8% 50%;
  --destructive-foreground: 210 40% 98%;
}
```

Tailwind에서는 `bg-primary text-primary-foreground` 처럼 토큰 이름으로 쓴다(원시 색
`bg-blue-600` 직접 사용 금지 — 테마 일관성 유지).

## 간격·반경·그림자

- **간격(spacing)**: Tailwind 기본 4px 스케일. 컴포넌트 내부 패딩은 `2`(8px)/`3`(12px)/`4`(16px),
  섹션 간격은 `6`(24px)/`8`(32px)을 기본 단위로 한다.
- **모서리(radius)**: 토큰 `--radius`(0.5rem) 기준. `rounded-md` 기본, 카드/모달은 `rounded-lg`.
- **그림자**: 평면 우선. 떠 있는 요소(드롭다운·모달·팝오버)만 `shadow-md` 이상 사용.

## 공통 원칙

1. **토큰 우선**: 색·간격·반경은 토큰/스케일로만. 매직 넘버·임의 hex 금지.
2. **접근성**: 인터랙티브 요소는 키보드 포커스 링(`--ring`) 유지, 의미 색만으로 정보 전달 금지,
   이미지·아이콘 버튼에 라벨/alt 필수.
3. **반응형**: 모바일 우선. Tailwind 브레이크포인트 `sm md lg xl` 기준으로 확장.
4. **상태 표현**: hover/focus/active/disabled/loading 상태를 항상 정의.
5. **컴포넌트 소유**: shadcn 컴포넌트는 `components/ui/`에 복사해 두고 프로젝트가 직접 관리.
