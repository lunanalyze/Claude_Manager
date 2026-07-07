// 순수 요소 카탈로그 (fs 미의존 → 클라이언트에서도 import 가능).
// 저장/파일 IO 는 lib/ui-standard.js 가 담당.
//
// 목표: shadcn/ui 가 제공하는 컴포넌트 전반을 "요소"로 편입하고,
// 요소마다 분위기(룩앤필) 후보를 고르게 한다.
//  - 기초(theme/type/radius/density)는 전역 토큰 → 나머지 모든 요소가 상속.
//  - 차트는 "종류"가 아니라 "룩앤필"을 고른다(같은 그래프, 다른 룩).

export const UI_GROUPS = [
  { id: "foundations", label: "기초 (Foundations)",
    desc: "색·타이포·모서리·밀도. 나머지 모든 요소가 여기서 상속받는 토대." },
  { id: "form", label: "폼 컨트롤 (Form)",
    desc: "사용자 입력 요소의 형태와 질감." },
  { id: "data", label: "데이터 표시 (Data Display)",
    desc: "정보를 담고 나열하는 컨테이너와 표면." },
  { id: "nav", label: "내비게이션 (Navigation)",
    desc: "화면 이동·메뉴·경로 표시." },
  { id: "overlay", label: "오버레이 · 피드백 (Overlay & Feedback)",
    desc: "겹쳐 뜨는 표면과 상태·알림." },
  { id: "chart", label: "차트 (Chart)",
    desc: "데이터 종류가 아니라 '분위기(룩앤필)'를 고른다 — 같은 그래프, 다른 룩." },
];

export const UI_ELEMENTS = [
  // ══ 기초 ════════════════════════════════════════════════
  { id: "theme", group: "foundations", title: "컬러 테마", desc: "전체 색 팔레트(주색·강조·의미색). 모든 요소의 색이 여기서 나온다.",
    candidates: [
      { id: "blue", name: "코퍼레이트 블루", note: "신뢰감·범용. 기본값." },
      { id: "violet", name: "모던 바이올렛", note: "세련·제품 느낌." },
      { id: "emerald", name: "칼름 에메랄드", note: "차분·성장 지표." },
      { id: "slate", name: "뉴트럴 슬레이트", note: "무채색 절제·데이터 밀도." },
      { id: "rose", name: "웜 로즈", note: "생동감·소비자 서비스." },
      { id: "amber", name: "앰버 골드", note: "따뜻함·주의 환기." },
    ] },
  { id: "type", group: "foundations", title: "타이포그래피", desc: "제목·본문의 크기·굵기·대비 규칙.",
    candidates: [
      { id: "contrast", name: "또렷한 대비", note: "큰 굵은 제목 ↔ 작은 본문. 위계 강함." },
      { id: "balanced", name: "차분한 균형", note: "중간 굵기·넉넉한 행간. 편안함." },
      { id: "compact", name: "촘촘한 실용", note: "작고 촘촘. 정보 밀도 우선." },
    ] },
  { id: "radius", group: "foundations", title: "모서리 반경", desc: "모든 모서리의 둥근 정도(전역 --radius).",
    candidates: [
      { id: "sharp", name: "샤프", note: "각진. 엄격·데이터스러움." },
      { id: "subtle", name: "서틀", note: "살짝 둥근. 절제." },
      { id: "rounded", name: "라운디드", note: "표준(기본)." },
      { id: "round", name: "라운드", note: "크게 둥근. 친근." },
    ] },
  { id: "density", group: "foundations", title: "밀도 · 여백", desc: "카드·테이블 내부 여백의 촘촘함.",
    candidates: [
      { id: "compact", name: "컴팩트", note: "빽빽. 한 화면에 많이." },
      { id: "cozy", name: "코지", note: "적당(기본)." },
      { id: "comfortable", name: "컴포터블", note: "넉넉·고급감." },
    ] },

  // ══ 폼 컨트롤 ═══════════════════════════════════════════
  { id: "button", group: "form", title: "버튼 (Button)", desc: "주요 액션의 모양·질감.",
    candidates: [
      { id: "solid", name: "솔리드", note: "꽉 찬 배경. 명확한 주액션." },
      { id: "soft", name: "소프트", note: "옅은 틴트. 부드러움." },
      { id: "outline", name: "아웃라인", note: "테두리만. 절제." },
      { id: "pill", name: "필", note: "완전 둥근. 친근." },
      { id: "gradient", name: "그라디언트", note: "그라디언트. 제품 강조." },
      { id: "link", name: "링크", note: "밑줄 텍스트. 최소." },
    ] },
  { id: "input", group: "form", title: "인풋 (Input)", desc: "텍스트 입력 필드의 형태.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리 박스." },
      { id: "filled", name: "필드", note: "옅은 배경 채움." },
      { id: "underline", name: "언더라인", note: "밑줄만." },
    ] },
  { id: "textarea", group: "form", title: "텍스트영역 (Textarea)", desc: "여러 줄 입력 필드.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리 박스." },
      { id: "filled", name: "필드", note: "옅은 배경." },
      { id: "underline", name: "언더라인", note: "밑줄만." },
    ] },
  { id: "select", group: "form", title: "셀렉트 (Select)", desc: "단일 선택 드롭다운.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "인풋과 통일." },
      { id: "filled", name: "필드", note: "옅은 배경." },
      { id: "ghost", name: "고스트", note: "밑줄만. 툴바용." },
    ] },
  { id: "combobox", group: "form", title: "콤보박스 (Combobox)", desc: "검색되는 선택 필드.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리+검색 아이콘." },
      { id: "filled", name: "필드", note: "옅은 배경." },
    ] },
  { id: "checkbox", group: "form", title: "체크박스 (Checkbox)", desc: "다중 선택 표시.",
    candidates: [
      { id: "square", name: "스퀘어", note: "각진 박스." },
      { id: "rounded", name: "라운디드", note: "둥근 박스." },
      { id: "soft", name: "소프트", note: "틴트 배경." },
    ] },
  { id: "radio", group: "form", title: "라디오 (Radio Group)", desc: "단일 선택.",
    candidates: [
      { id: "dot", name: "닷", note: "원 안 점. 표준." },
      { id: "soft", name: "소프트", note: "틴트 채움." },
      { id: "card", name: "카드", note: "선택지를 카드로. 강조." },
    ] },
  { id: "switch", group: "form", title: "스위치 (Switch)", desc: "on/off 토글.",
    candidates: [
      { id: "pill", name: "필", note: "둥근 트랙." },
      { id: "square", name: "스퀘어", note: "각진 트랙." },
    ] },
  { id: "slider", group: "form", title: "슬라이더 (Slider)", desc: "범위/값 조절.",
    candidates: [
      { id: "bar", name: "바", note: "표준 트랙+핸들." },
      { id: "rounded", name: "라운드", note: "둥근 트랙." },
      { id: "thin", name: "씬", note: "얇은 트랙·작은 핸들." },
    ] },
  { id: "toggle", group: "form", title: "토글 그룹 (Toggle Group)", desc: "세그먼트 선택.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "테두리 세그먼트." },
      { id: "soft", name: "소프트", note: "틴트 활성." },
      { id: "pill", name: "필", note: "알약 컨테이너." },
    ] },
  { id: "otp", group: "form", title: "OTP 입력 (Input OTP)", desc: "인증코드 낱자 입력.",
    candidates: [
      { id: "box", name: "박스", note: "칸 나뉜 박스." },
      { id: "underline", name: "언더라인", note: "밑줄 칸." },
    ] },
  { id: "datefield", group: "form", title: "날짜 선택 (Date Picker)", desc: "달력 팝오버 트리거.",
    candidates: [
      { id: "outline", name: "아웃라인", note: "달력 아이콘+테두리." },
      { id: "filled", name: "필드", note: "옅은 배경." },
    ] },
  { id: "field", group: "form", title: "폼 필드 (Form Field)", desc: "라벨·입력·도움말 배치.",
    candidates: [
      { id: "stacked", name: "스택드", note: "라벨 위, 입력 아래. 표준." },
      { id: "inline", name: "인라인", note: "라벨 왼쪽. 밀도형." },
      { id: "floating", name: "플로팅", note: "라벨이 위로 뜸. 모던." },
    ] },

  // ══ 데이터 표시 ═════════════════════════════════════════
  { id: "card", group: "data", title: "카드 (Card)", desc: "정보 묶음 컨테이너.",
    candidates: [
      { id: "flat", name: "플랫 보더", note: "얇은 테두리·평면." },
      { id: "elevated", name: "엘리베이티드", note: "그림자로 떠 있음." },
      { id: "filled", name: "필드", note: "옅은 배경 채움." },
      { id: "accent", name: "액센트 탑", note: "상단 강조선." },
    ] },
  { id: "table", group: "data", title: "테이블 (Table)", desc: "행/열 데이터.",
    candidates: [
      { id: "lined", name: "라인드", note: "행 구분선." },
      { id: "zebra", name: "지브라", note: "교차 음영." },
      { id: "minimal", name: "미니멀", note: "헤더 밑줄만." },
    ] },
  { id: "badge", group: "data", title: "뱃지 (Badge)", desc: "상태·라벨 표시.",
    candidates: [
      { id: "soft", name: "소프트 틴트", note: "옅은 배경+진한 글자." },
      { id: "solid", name: "솔리드", note: "꽉 찬 색." },
      { id: "dot", name: "닷 아웃라인", note: "점+테두리." },
      { id: "outline", name: "아웃라인", note: "테두리만." },
    ] },
  { id: "avatar", group: "data", title: "아바타 (Avatar)", desc: "사용자 식별 이미지.",
    candidates: [
      { id: "circle", name: "서클", note: "완전 원형." },
      { id: "rounded", name: "라운디드", note: "둥근 사각." },
      { id: "ring", name: "링", note: "강조 링." },
    ] },
  { id: "accordion", group: "data", title: "아코디언 (Accordion)", desc: "접히는 섹션 목록.",
    candidates: [
      { id: "bordered", name: "보더드", note: "행 구분선." },
      { id: "separated", name: "세퍼레이티드", note: "카드로 분리." },
      { id: "filled", name: "필드", note: "열린 항목 음영." },
    ] },
  { id: "skeleton", group: "data", title: "스켈레톤 (Skeleton)", desc: "로딩 자리표시자.",
    candidates: [
      { id: "pulse", name: "펄스", note: "은은한 명멸." },
      { id: "shimmer", name: "쉬머", note: "빛 스윕." },
      { id: "block", name: "블록", note: "정적 회색 블록." },
    ] },
  { id: "tooltip", group: "data", title: "툴팁 (Tooltip)", desc: "호버 힌트 말풍선.",
    candidates: [
      { id: "dark", name: "다크", note: "짙은 배경·흰 글자." },
      { id: "light", name: "라이트", note: "밝은 배경·테두리." },
      { id: "accent", name: "액센트", note: "주색 배경." },
    ] },
  { id: "hovercard", group: "data", title: "호버카드 (Hover Card)", desc: "호버 시 뜨는 미리보기 카드.",
    candidates: [
      { id: "soft", name: "소프트", note: "얇은 테두리." },
      { id: "bordered", name: "보더드", note: "또렷한 테두리." },
      { id: "elevated", name: "엘리베이티드", note: "짙은 그림자." },
    ] },
  { id: "separator", group: "data", title: "구분선 (Separator)", desc: "영역 구분 라인.",
    candidates: [
      { id: "line", name: "라인", note: "실선." },
      { id: "dashed", name: "대시드", note: "점선." },
      { id: "label", name: "라벨", note: "가운데 텍스트." },
    ] },

  // ══ 내비게이션 ══════════════════════════════════════════
  { id: "tabs", group: "nav", title: "탭 (Tabs)", desc: "섹션 전환.",
    candidates: [
      { id: "underline", name: "언더라인", note: "밑줄 활성." },
      { id: "pill", name: "필", note: "알약 활성." },
      { id: "enclosed", name: "인클로즈드", note: "탭이 물림." },
    ] },
  { id: "breadcrumb", group: "nav", title: "브레드크럼 (Breadcrumb)", desc: "경로 표시.",
    candidates: [
      { id: "chevron", name: "셰브론", note: "› 구분." },
      { id: "slash", name: "슬래시", note: "/ 구분." },
      { id: "dot", name: "닷", note: "· 구분." },
    ] },
  { id: "pagination", group: "nav", title: "페이지네이션 (Pagination)", desc: "페이지 이동.",
    candidates: [
      { id: "numbered", name: "넘버드", note: "번호 나열." },
      { id: "compact", name: "컴팩트", note: "현재/총계." },
      { id: "arrows", name: "애로우", note: "이전/다음만." },
    ] },
  { id: "navmenu", group: "nav", title: "내비 메뉴 (Navigation Menu)", desc: "상단 내비게이션 바.",
    candidates: [
      { id: "underline", name: "언더라인", note: "밑줄 활성." },
      { id: "pill", name: "필", note: "알약 활성." },
      { id: "ghost", name: "고스트", note: "호버 배경만." },
    ] },
  { id: "menubar", group: "nav", title: "메뉴바 (Menubar)", desc: "앱 상단 메뉴.",
    candidates: [
      { id: "bordered", name: "보더드", note: "테두리 바." },
      { id: "ghost", name: "고스트", note: "배경 없는 바." },
    ] },
  { id: "dropdown", group: "nav", title: "드롭다운 메뉴 (Dropdown / Context)", desc: "떠오르는 메뉴 패널.",
    candidates: [
      { id: "soft", name: "소프트", note: "얇은 테두리." },
      { id: "bordered", name: "보더드", note: "또렷한 테두리." },
      { id: "elevated", name: "엘리베이티드", note: "짙은 그림자." },
    ] },
  { id: "command", group: "nav", title: "커맨드 (Command)", desc: "명령 팔레트.",
    candidates: [
      { id: "bordered", name: "보더드", note: "테두리 패널." },
      { id: "elevated", name: "엘리베이티드", note: "떠 있는 팔레트." },
    ] },
  { id: "sidebarnav", group: "nav", title: "사이드바 항목 (Sidebar)", desc: "사이드바 내비 항목.",
    candidates: [
      { id: "filled", name: "필드", note: "활성 항목 채움." },
      { id: "ghost", name: "고스트", note: "활성 텍스트 강조." },
      { id: "bordered", name: "보더드", note: "좌측 강조 바." },
    ] },

  // ══ 오버레이 · 피드백 ═══════════════════════════════════
  { id: "dialog", group: "overlay", title: "다이얼로그 (Dialog)", desc: "겹쳐 뜨는 대화 상자.",
    candidates: [
      { id: "soft", name: "소프트", note: "얇은 테두리." },
      { id: "bordered", name: "보더드", note: "또렷한 테두리." },
      { id: "elevated", name: "엘리베이티드", note: "짙은 그림자." },
    ] },
  { id: "alertdialog", group: "overlay", title: "얼럿 다이얼로그 (Alert Dialog)", desc: "위험 확인 대화상자.",
    candidates: [
      { id: "soft", name: "소프트", note: "아이콘+파괴 버튼." },
      { id: "bordered", name: "보더드", note: "테두리 강조." },
    ] },
  { id: "sheet", group: "overlay", title: "시트 · 드로어 (Sheet / Drawer)", desc: "가장자리에서 나오는 패널.",
    candidates: [
      { id: "right", name: "라이트", note: "우측에서." },
      { id: "left", name: "레프트", note: "좌측에서." },
      { id: "bottom", name: "바텀", note: "하단에서(드로어)." },
    ] },
  { id: "popover", group: "overlay", title: "팝오버 (Popover)", desc: "트리거에 붙는 플로팅 카드.",
    candidates: [
      { id: "soft", name: "소프트", note: "얇은 테두리." },
      { id: "bordered", name: "보더드", note: "또렷한 테두리." },
      { id: "elevated", name: "엘리베이티드", note: "짙은 그림자·화살표." },
    ] },
  { id: "toast", group: "overlay", title: "토스트 (Toast / Sonner)", desc: "일시 알림.",
    candidates: [
      { id: "soft", name: "소프트", note: "옅은 배경." },
      { id: "solid", name: "솔리드", note: "짙은 배경." },
      { id: "bordered", name: "보더드", note: "흰 배경+테두리." },
    ] },
  { id: "alert", group: "overlay", title: "얼럿 · 배너 (Alert)", desc: "안내·경고 메시지 표면.",
    candidates: [
      { id: "soft", name: "소프트", note: "옅은 틴트." },
      { id: "accent", name: "좌측 강조선", note: "테두리+좌측 바." },
      { id: "solid", name: "솔리드", note: "꽉 찬 색." },
    ] },
  { id: "progress", group: "overlay", title: "프로그레스 (Progress)", desc: "진행률 바.",
    candidates: [
      { id: "bar", name: "바", note: "각진 트랙." },
      { id: "thin", name: "씬 라운드", note: "얇고 둥근." },
      { id: "striped", name: "스트라이프", note: "빗금 무늬." },
    ] },

  // ══ 차트 (룩앤필) ═══════════════════════════════════════
  { id: "chart", group: "chart", title: "차트 룩앤필 (Chart)", desc: "차트 종류가 아니라 '분위기'. 표준 룩을 고르면 어떤 그래프든 이 톤을 따른다.",
    candidates: [
      { id: "minimal", name: "미니멀", note: "격자·축 최소. 담백·정밀." },
      { id: "gridded", name: "그리드", note: "격자+축+점. 분석형." },
      { id: "gradient", name: "그라디언트 필", note: "면적 그라디언트. 모던." },
      { id: "bold", name: "볼드", note: "굵은 선/막대. 히어로." },
      { id: "soft", name: "소프트", note: "점선 격자·은은한 채움." },
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
