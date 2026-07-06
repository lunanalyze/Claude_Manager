// 순수 요소 카탈로그 (fs 미의존 → 클라이언트에서도 import 가능).
// 저장/파일 IO 는 lib/ui-standard.js 가 담당.

export const UI_ELEMENTS = [
  { id: "theme", title: "컬러 테마", desc: "전체 색 팔레트(주색·강조·의미색). 모든 요소의 색이 여기서 나온다.",
    candidates: [
      { id: "blue", name: "코퍼레이트 블루", note: "신뢰감·범용. 관리도구 기본값." },
      { id: "violet", name: "모던 바이올렛", note: "세련·제품 느낌." },
      { id: "emerald", name: "칼름 에메랄드", note: "차분·성장 지표." },
      { id: "slate", name: "뉴트럴 슬레이트", note: "무채색 절제·데이터 밀도." },
    ] },
  { id: "type", title: "타이포그래피", desc: "제목·본문의 크기·굵기·대비 규칙.",
    candidates: [
      { id: "contrast", name: "또렷한 대비", note: "큰 굵은 제목 ↔ 작은 본문. 위계가 강함." },
      { id: "balanced", name: "차분한 균형", note: "중간 굵기·넉넉한 행간. 읽기 편안." },
      { id: "compact", name: "촘촘한 실용", note: "작고 촘촘. 정보 밀도 우선." },
    ] },
  { id: "button", title: "버튼", desc: "주요 액션의 모양·질감.",
    candidates: [
      { id: "solid", name: "솔리드", note: "꽉 찬 배경. 명확한 주액션." },
      { id: "soft", name: "소프트", note: "옅은 틴트 배경. 부드러움." },
      { id: "outline", name: "아웃라인", note: "테두리만. 절제·미니멀." },
      { id: "pill", name: "필(둥근)", note: "완전 둥근 모서리. 친근함." },
    ] },
  { id: "card", title: "카드", desc: "정보 묶음 컨테이너의 표현.",
    candidates: [
      { id: "flat", name: "플랫 보더", note: "얇은 테두리·평면. 정보밀도형." },
      { id: "elevated", name: "엘리베이티드", note: "그림자로 떠 있음. 강조형." },
      { id: "filled", name: "필드(음영)", note: "옅은 배경 채움. 경계 부드러움." },
    ] },
  { id: "table", title: "테이블", desc: "행/열 데이터의 가독 규칙.",
    candidates: [
      { id: "lined", name: "라인드", note: "행 구분선. 표준적." },
      { id: "zebra", name: "지브라", note: "교차 음영. 넓은 표에 유리." },
      { id: "minimal", name: "미니멀", note: "헤더 밑줄만. 가벼움." },
    ] },
  { id: "badge", title: "뱃지 · 상태", desc: "상태·라벨 표시 방식.",
    candidates: [
      { id: "soft", name: "소프트 틴트", note: "옅은 배경+진한 글자. 눈이 편함." },
      { id: "solid", name: "솔리드", note: "꽉 찬 색. 강한 주목." },
      { id: "dot", name: "닷 아웃라인", note: "점+테두리. 절제된 신호." },
    ] },
  { id: "chart", title: "차트", desc: "추세/구성 시각화 스타일.",
    candidates: [
      { id: "area", name: "그라디언트 에어리어", note: "면적+그라디언트. 추세 강조." },
      { id: "bar", name: "라운드 바", note: "둥근 막대. 비교 명확." },
      { id: "line", name: "미니멀 라인", note: "선만. 담백·정밀." },
    ] },
  { id: "input", title: "인풋 · 폼", desc: "입력 필드의 형태.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리 박스. 명확." },
      { id: "filled", name: "필드", note: "옅은 배경 채움. 부드러움." },
      { id: "underline", name: "언더라인", note: "밑줄만. 미니멀." },
    ] },
];

export function defaultSelections() {
  return Object.fromEntries(UI_ELEMENTS.map((e) => [e.id, e.candidates[0].id]));
}
