# UI 표준 (UI Standard) — 기반

> 상태: **운영 중.** 룩앤필(색·타이포·모서리·각 컴포넌트의 변형)은 **UI 표준 워크숍**에서
> 직접 골라 확정한다. 이 문서와 하위 요소 문서는 그 위에서 **"어떻게 잘 쓸지(사용 규칙)"** 만 다룬다.

스택: **Next.js(React) + Tailwind CSS + shadcn/ui**(Radix 기반). 컴포넌트는 라이브러리 설치가
아니라 **shadcn 방식으로 repo에 복사해 소유**한다. 색·간격 등은 **CSS 변수 토큰**으로 테마화한다.

---

## 룩앤필의 단일 원본 = 워크숍 선택 (`selections.json`)

"어떤 색 테마·모서리·밀도를 쓸지", "버튼/카드/테이블/차트 등 각 요소를 어떤 변형으로 그릴지"
같은 **시각적 결정은 하드코딩하지 않는다.** 대신 WebUI의 **UI 표준 워크숍**에서 요소별 후보를
눈으로 비교해 고르고, 그 선택이 **`docs/standards/ui/selections.json`** 에 저장된다.
이 파일이 룩앤필 표준의 **단일 원본**이다.

- **워크숍**(`/ui-standard`): 66개 요소의 후보를 더미 데이터로 비교하고 「이걸로」로 확정.
- **조립 페이지**(`/ui-standard/result`): 선택을 합친 대시보드 미리보기.
- **요소 쇼케이스**(`/ui-standard/showcase`): 선택된 표준을 실제 화면 맥락(앱 셸·목록·상세·
  설정·오버레이) 속에서 확인. 장면마다 적용된 요소 목록이 붙는다.
- 구현 코드(`app/globals.css`의 토큰, `components/ui/*`)는 이 선택을 반영해야 한다.
  선택과 코드가 어긋나면 **`selections.json`이 기준**이다.

> 프로젝트에서 실제 컴포넌트를 만들 때: `selections.json`의 해당 요소 값이 그 요소의 표준 변형이다.
> (예: `"button": "solid"` → 기본 버튼은 솔리드. `"radius": "subtle"` → `--radius`는 살짝 둥근 값.)

---

## 디자인 토큰 (CSS 변수)

색·반경 등의 **구체적 값은 워크숍 선택에서 나온다.** 규칙은 아래 두 가지뿐:

1. 색·간격·반경은 `app/globals.css`에 **CSS 변수 토큰**으로 정의하고 Tailwind가 참조한다.
   light/dark 모두 제공한다.
2. Tailwind에서는 `bg-primary text-primary-foreground` 처럼 **토큰 이름**으로 쓴다.
   원시 색(`bg-blue-600`)·임의 hex 직접 사용 **금지**(테마 일관성 유지).

토큰 종류: `--background/--foreground`, `--muted(-foreground)`, `--card`, `--border`, `--input`,
`--ring`, `--primary(-foreground)`, `--secondary(-foreground)`, `--destructive(-foreground)`,
`--radius`, 차트 시리즈 `--chart-1 … --chart-5`. (구체 값 = 워크숍 `theme`·`radius` 선택.)

## 간격·반경·그림자

- **간격(spacing)**: Tailwind 기본 4px 스케일. 컴포넌트 내부 패딩 `2`(8)/`3`(12)/`4`(16),
  섹션 간격 `6`(24)/`8`(32). 촘촘/넉넉 정도는 워크숍 `density` 선택을 따른다.
- **모서리(radius)**: 토큰 `--radius` 기준(`rounded-md` 기본, 카드/모달 `rounded-lg`).
  둥근 정도는 워크숍 `radius` 선택으로 결정.
- **그림자**: 평면 우선. 떠 있는 요소(드롭다운·모달·팝오버)만 `shadow-md` 이상.

## 공통 원칙

1. **토큰 우선**: 색·간격·반경은 토큰/스케일로만. 매직 넘버·임의 hex 금지.
2. **접근성**: 인터랙티브 요소는 키보드 포커스 링(`--ring`) 유지, 의미 색만으로 정보 전달 금지,
   이미지·아이콘 버튼에 라벨/alt 필수.
3. **반응형**: 모바일 우선. Tailwind 브레이크포인트 `sm md lg xl` 기준.
4. **상태 표현**: hover/focus/active/disabled/loading 상태를 항상 정의.
5. **컴포넌트 소유**: shadcn 컴포넌트는 `components/ui/`에 복사해 두고 프로젝트가 직접 관리.

---

## 요소별 사용 규칙

각 문서는 **룩(변형)이 아니라 사용법**을 다룬다 — 언제 어떤 variant를 쓰는지의 의미,
접근성, 숫자·날짜 포맷, 차트 종류 선택, 상태 처리 등. (룩은 워크숍이 정한다.)

- [Typography / Font](./typography.md) — 글꼴 선택·로딩, 위계·가독 규칙
- [Button](./button.md) — variant 의미·사이즈·파괴적 액션·로딩·a11y
- [Table](./table.md) — 정렬·포맷·상태(로딩/빈/에러)·a11y
- [Image](./image.md) — `next/image`·alt·CLS·포맷·아바타 폴백
- [Chart / Graph](./chart.md) — 데이터에 맞는 **차트 종류 선택**·숫자 포맷·상태·a11y
