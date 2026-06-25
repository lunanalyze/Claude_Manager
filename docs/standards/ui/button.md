# UI 표준 — Button

> 상태: **제안 (수락 대기)**

shadcn/ui `<Button>` 을 기본으로 사용한다. (`components/ui/button.tsx` 에 복사 소유)

## Variant (용도)

| variant | 용도 | 예 |
|---------|------|-----|
| `default` | 주요 액션(화면당 1개 권장) | 저장, 확인 |
| `secondary` | 보조 액션 | 취소 옆 보조 |
| `outline` | 낮은 강조 | 필터, 더보기 |
| `ghost` | 아이콘/툴바·테이블 행 액션 | 편집, 메뉴 |
| `destructive` | 삭제·위험 | 삭제, 영구 제거 |
| `link` | 인라인 텍스트 링크형 | 자세히 |

## Size

| size | 높이 | 용도 |
|------|------|------|
| `sm` | 32px | 조밀한 영역(테이블·툴바) |
| `default` | 40px | 일반 |
| `lg` | 44px | 강조·모바일 주요 CTA |
| `icon` | 정사각 | 아이콘 전용(반드시 `aria-label`) |

## 규칙

- 한 화면/섹션에서 **주요 액션(default)은 하나**. 나머지는 secondary/outline/ghost로 낮춘다.
- **파괴적 액션**은 `destructive` + 확인 절차(다이얼로그). 곧바로 실행 금지.
- **로딩 상태**: 비동기 작업은 `disabled` + 스피너 아이콘, 라벨 유지("저장 중…").
- 아이콘만 있는 버튼은 `aria-label` 필수. 아이콘+텍스트는 아이콘 `size-4`, 간격 `gap-2`.
- 색은 토큰 사용(`bg-primary` 등). 원시 색 직접 지정 금지.

```tsx
<Button>저장</Button>
<Button variant="outline">취소</Button>
<Button variant="destructive" onClick={confirmDelete}>삭제</Button>
<Button size="icon" aria-label="편집"><PencilIcon className="size-4" /></Button>
```
