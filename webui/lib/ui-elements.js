// 순수 요소 카탈로그 (fs 미의존 → 클라이언트에서도 import 가능).
// 저장/파일 IO 는 lib/ui-standard.js 가 담당.
//
// 설계: shadcn/ui 처럼 "요소별 분위기(룩앤필)"를 특정한다.
//  - 기초(theme/type/radius/density)는 전역 토큰 → 나머지 모든 요소가 상속.
//  - 차트는 "어떤 그래프를 쓸지"가 아니라 "같은 그래프의 룩앤필"을 고른다.
//    (데이터 특성에 맞는 그래프 종류는 그때그때 고르되, 룩은 이 표준을 따른다.)

export const UI_GROUPS = [
  { id: "foundations", label: "기초 (Foundations)",
    desc: "색·타이포·모서리·밀도. 나머지 모든 요소가 여기서 상속받는 토대." },
  { id: "form", label: "폼 컨트롤 (Form)",
    desc: "사용자 입력 요소의 형태와 질감." },
  { id: "data", label: "데이터 표시 (Data Display)",
    desc: "정보를 담고 나열하는 컨테이너." },
  { id: "feedback", label: "피드백 (Feedback)",
    desc: "상태·진행·알림을 전하는 요소." },
  { id: "nav", label: "내비게이션 · 오버레이",
    desc: "화면 전환과 겹쳐 뜨는 표면." },
  { id: "chart", label: "차트 (Chart)",
    desc: "데이터 종류가 아니라 '분위기(룩앤필)'를 고른다 — 같은 그래프, 다른 룩." },
];

export const UI_ELEMENTS = [
  // ── 기초 ────────────────────────────────────────────────
  { id: "theme", group: "foundations", title: "컬러 테마", desc: "전체 색 팔레트(주색·강조·의미색). 모든 요소의 색이 여기서 나온다.",
    candidates: [
      { id: "blue", name: "코퍼레이트 블루", note: "신뢰감·범용. 관리도구 기본값." },
      { id: "violet", name: "모던 바이올렛", note: "세련·제품 느낌." },
      { id: "emerald", name: "칼름 에메랄드", note: "차분·성장 지표." },
      { id: "slate", name: "뉴트럴 슬레이트", note: "무채색 절제·데이터 밀도." },
      { id: "rose", name: "웜 로즈", note: "생동감·소비자 서비스." },
      { id: "amber", name: "앰버 골드", note: "따뜻함·주의 환기." },
    ] },
  { id: "type", group: "foundations", title: "타이포그래피", desc: "제목·본문의 크기·굵기·대비 규칙.",
    candidates: [
      { id: "contrast", name: "또렷한 대비", note: "큰 굵은 제목 ↔ 작은 본문. 위계가 강함." },
      { id: "balanced", name: "차분한 균형", note: "중간 굵기·넉넉한 행간. 읽기 편안." },
      { id: "compact", name: "촘촘한 실용", note: "작고 촘촘. 정보 밀도 우선." },
    ] },
  { id: "radius", group: "foundations", title: "모서리 반경", desc: "버튼·카드·인풋 등 모든 모서리의 둥근 정도(전역 --radius).",
    candidates: [
      { id: "sharp", name: "샤프", note: "각진 모서리. 엄격·데이터스러움." },
      { id: "subtle", name: "서틀", note: "살짝 둥근. 절제된 부드러움." },
      { id: "rounded", name: "라운디드", note: "표준적으로 둥근. 균형(기본)." },
      { id: "round", name: "라운드", note: "크게 둥근. 친근·소프트." },
    ] },
  { id: "density", group: "foundations", title: "밀도 · 여백", desc: "카드·테이블 내부 여백의 촘촘함(정보 밀도).",
    candidates: [
      { id: "compact", name: "컴팩트", note: "빽빽. 한 화면에 많이." },
      { id: "cozy", name: "코지", note: "적당한 여백. 균형(기본)." },
      { id: "comfortable", name: "컴포터블", note: "넉넉한 여백. 여유·고급감." },
    ] },

  // ── 폼 컨트롤 ────────────────────────────────────────────
  { id: "button", group: "form", title: "버튼", desc: "주요 액션의 모양·질감.",
    candidates: [
      { id: "solid", name: "솔리드", note: "꽉 찬 배경. 명확한 주액션." },
      { id: "soft", name: "소프트", note: "옅은 틴트 배경. 부드러움." },
      { id: "outline", name: "아웃라인", note: "테두리만. 절제·미니멀." },
      { id: "pill", name: "필(둥근)", note: "완전 둥근 모서리. 친근함." },
      { id: "gradient", name: "그라디언트", note: "그라디언트 배경. 제품 강조." },
    ] },
  { id: "input", group: "form", title: "인풋", desc: "텍스트 입력 필드의 형태.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리 박스. 명확." },
      { id: "filled", name: "필드", note: "옅은 배경 채움. 부드러움." },
      { id: "underline", name: "언더라인", note: "밑줄만. 미니멀." },
    ] },
  { id: "select", group: "form", title: "셀렉트 · 드롭다운", desc: "선택 필드의 형태.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리 박스. 인풋과 통일." },
      { id: "filled", name: "필드", note: "옅은 배경. 부드러움." },
      { id: "ghost", name: "고스트", note: "밑줄만. 툴바에 가벼움." },
    ] },
  { id: "checkbox", group: "form", title: "체크박스", desc: "다중 선택 표시.",
    candidates: [
      { id: "square", name: "스퀘어", note: "각진 박스. 표준." },
      { id: "rounded", name: "라운디드", note: "둥근 박스. 부드러움." },
      { id: "soft", name: "소프트", note: "틴트 배경. 눈이 편함." },
    ] },
  { id: "switch", group: "form", title: "스위치 · 토글", desc: "on/off 설정.",
    candidates: [
      { id: "pill", name: "필", note: "둥근 트랙. 표준." },
      { id: "square", name: "스퀘어", note: "각진 트랙. 엄격." },
    ] },

  // ── 데이터 표시 ─────────────────────────────────────────
  { id: "card", group: "data", title: "카드", desc: "정보 묶음 컨테이너의 표현.",
    candidates: [
      { id: "flat", name: "플랫 보더", note: "얇은 테두리·평면. 정보밀도형." },
      { id: "elevated", name: "엘리베이티드", note: "그림자로 떠 있음. 강조형." },
      { id: "filled", name: "필드(음영)", note: "옅은 배경 채움. 경계 부드러움." },
      { id: "accent", name: "액센트 탑", note: "상단 강조선. 카테고리 구분." },
    ] },
  { id: "table", group: "data", title: "테이블", desc: "행/열 데이터의 가독 규칙.",
    candidates: [
      { id: "lined", name: "라인드", note: "행 구분선. 표준적." },
      { id: "zebra", name: "지브라", note: "교차 음영. 넓은 표에 유리." },
      { id: "minimal", name: "미니멀", note: "헤더 밑줄만. 가벼움." },
    ] },
  { id: "badge", group: "data", title: "뱃지 · 상태", desc: "상태·라벨 표시 방식.",
    candidates: [
      { id: "soft", name: "소프트 틴트", note: "옅은 배경+진한 글자. 눈이 편함." },
      { id: "solid", name: "솔리드", note: "꽉 찬 색. 강한 주목." },
      { id: "dot", name: "닷 아웃라인", note: "점+테두리. 절제된 신호." },
      { id: "outline", name: "아웃라인", note: "테두리만. 담백." },
    ] },
  { id: "avatar", group: "data", title: "아바타", desc: "사용자/엔티티 식별 이미지.",
    candidates: [
      { id: "circle", name: "서클", note: "완전 원형. 표준." },
      { id: "rounded", name: "라운디드", note: "둥근 사각. 제품 느낌." },
      { id: "ring", name: "링", note: "강조 링 테두리. 온라인 표시 등." },
    ] },

  // ── 피드백 ──────────────────────────────────────────────
  { id: "alert", group: "feedback", title: "얼럿 · 배너", desc: "안내·경고 메시지 표면.",
    candidates: [
      { id: "soft", name: "소프트", note: "옅은 틴트 배경. 은은함." },
      { id: "accent", name: "좌측 강조선", note: "테두리+좌측 바. 문서형." },
      { id: "solid", name: "솔리드", note: "꽉 찬 색. 강한 경고." },
    ] },
  { id: "progress", group: "feedback", title: "프로그레스", desc: "진행률 표시 바.",
    candidates: [
      { id: "bar", name: "바", note: "각진 트랙. 명료." },
      { id: "thin", name: "씬 라운드", note: "얇고 둥근. 미니멀." },
      { id: "striped", name: "스트라이프", note: "빗금 무늬. 활동 강조." },
    ] },

  // ── 내비게이션 · 오버레이 ───────────────────────────────
  { id: "tabs", group: "nav", title: "탭", desc: "섹션 전환 내비게이션.",
    candidates: [
      { id: "underline", name: "언더라인", note: "밑줄 활성. 표준·가벼움." },
      { id: "pill", name: "필", note: "알약 활성. 세그먼트 느낌." },
      { id: "enclosed", name: "인클로즈드", note: "탭이 카드처럼 물림. 문서형." },
    ] },
  { id: "dialog", group: "nav", title: "다이얼로그 · 모달", desc: "겹쳐 뜨는 대화 상자.",
    candidates: [
      { id: "soft", name: "소프트", note: "얇은 테두리. 담백." },
      { id: "bordered", name: "보더드", note: "또렷한 테두리. 경계 강함." },
      { id: "elevated", name: "엘리베이티드", note: "짙은 그림자로 떠 있음." },
    ] },

  // ── 차트 (룩앤필) ───────────────────────────────────────
  { id: "chart", group: "chart", title: "차트 룩앤필", desc: "차트 종류가 아니라 '분위기'. 같은 데이터를 여러 룩으로 — 표준 룩을 고르면 어떤 그래프든 이 톤을 따른다.",
    candidates: [
      { id: "minimal", name: "미니멀", note: "격자·축 최소. 선만. 담백·정밀." },
      { id: "gridded", name: "그리드", note: "격자+축+점. 값을 정확히 읽는 분석형." },
      { id: "gradient", name: "그라디언트 필", note: "면적 그라디언트. 추세 강조·모던." },
      { id: "bold", name: "볼드", note: "굵은 선/막대·점 강조. 대시보드 히어로." },
      { id: "soft", name: "소프트", note: "점선 격자·은은한 채움. 부드러운 리포트." },
    ] },
];

export function defaultSelections() {
  return Object.fromEntries(UI_ELEMENTS.map((e) => [e.id, e.candidates[0].id]));
}

// 요소 id → 후보 id → 후보 이름 (레전드/요약 표시용)
export function candidateName(elementId, candidateId) {
  const el = UI_ELEMENTS.find((e) => e.id === elementId);
  const c = el?.candidates.find((x) => x.id === candidateId);
  return c?.name ?? candidateId;
}
