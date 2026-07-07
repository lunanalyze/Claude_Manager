# UI 표준 — Table

> **행 표현 룩(라인드·지브라·미니멀)은 [UI 표준 워크숍](./index.md)의 `table` 선택이 정한다.**
> 이 문서는 그 위에서 **정렬·포맷·상태(로딩/빈/에러)·접근성** 등 사용 규칙을 다룬다.

데이터 표시는 shadcn/ui `Table` 프리미티브(`components/ui/table.tsx`)를 기본으로 사용한다.
복잡한 정렬·페이지네이션·필터가 필요하면 `@tanstack/react-table` 와 결합한다.

## 구조

- `Table > TableHeader > TableRow > TableHead` / `TableBody > TableRow > TableCell`
- 헤더는 `text-xs font-medium text-muted-foreground`, 본문은 `text-sm`.
- 행 구분은 `border-b border-border`(가로줄). 세로줄은 기본 사용 안 함(조밀한 표만 예외).
- 행 hover: `hover:bg-muted/50`. 선택 행: `data-[state=selected]:bg-muted`.

## 정렬·표시 규칙

- **숫자/금액/날짜는 우측 정렬**(`text-right`), 텍스트는 좌측 정렬.
- 금액은 천단위 구분, 통화·단위 표기 일관. 날짜는 `YYYY-MM-DD`(또는 프로젝트 합의 포맷).
- 긴 텍스트 열은 `truncate` + 툴팁/상세보기. 표 자체 가로 스크롤은 컨테이너 `overflow-x-auto`.
- 헤더는 스크롤 시 고정 필요하면 `sticky top-0 bg-background`.

## 상태

- **로딩**: 행 자리 스켈레톤(`animate-pulse`) 또는 상단 진행 표시.
- **빈 상태**: 표 전체 colspan 셀에 안내 문구 + (가능하면) 액션. 빈 표를 그냥 두지 않는다.
- **에러**: 표 영역에 재시도 가능한 에러 메시지.

## 규칙

- 셀 안 액션 버튼은 `ghost` + `sm`(또는 `icon`).
- 한 행 클릭으로 상세 이동 시 행 전체를 클릭 타깃으로, 키보드 접근 가능하게.
- 컬럼 10개 초과 등 과밀 표는 우선순위 낮은 열 숨기기/반응형 축약 고려.

```tsx
<div className="overflow-x-auto rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>이름</TableHead>
        <TableHead className="text-right">금액</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>홍길동</TableCell>
        <TableCell className="text-right">1,200,000</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```
