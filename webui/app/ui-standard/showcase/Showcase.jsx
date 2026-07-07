"use client";
import { DEMO, StyledLine, THEME_COLORS } from "../demos";
import { UI_ELEMENTS, candidateName } from "@/lib/ui-elements";

// 요소 id → 제목 (칩 라벨용)
const TITLE = Object.fromEntries(UI_ELEMENTS.map((e) => [e.id, e.title.replace(/\s*\(.*\)$/, "")]));

// 전역 토큰(모든 장면에 상속)
const FOUNDATIONS = ["theme", "type", "radius", "density"];

// 장면별 사용 요소 — 렌더와 커버리지 검증에 함께 쓴다
const USES = {
  A: ["menubar", "navmenu", "searchinput", "notif", "avatar", "avatargroup", "banner", "breadcrumb",
      "sidebarnav", "tabs", "stat", "chart", "card", "toolbar", "iconbutton", "buttongroup", "button", "kbd", "badge"],
  B: ["searchinput", "select", "combobox", "datefield", "toggle", "table", "checkbox", "tag", "badge",
      "dropdown", "pagination", "list", "emptystate", "progress", "buttongroup"],
  C: ["avatar", "hovercard", "rating", "desclist", "separator", "tag", "timeline", "accordion",
      "media", "carousel", "tooltip", "collapsible", "progressring", "tree", "code"],
  D: ["steps", "field", "input", "textarea", "select", "combobox", "checkbox", "radio", "switch",
      "slider", "otp", "filedrop", "datefield", "alert", "popover", "button"],
  E: ["dialog", "alertdialog", "sheet", "toast", "spinner", "skeleton", "command", "popover", "emptystate"],
};

function AppliedList({ uses, sel }) {
  const seen = new Set();
  const list = uses.filter((id) => (seen.has(id) ? false : seen.add(id)));
  return (
    <div className="sc-applied">
      <div className="sc-applied-t">적용된 요소 <span>{list.length}</span></div>
      <div className="sc-chips">
        {list.map((id) => (
          <span key={id} className="sc-chip"><b>{TITLE[id]}</b>{candidateName(id, sel[id])}</span>
        ))}
      </div>
    </div>
  );
}

function Scene({ n, title, desc, uses, sel, children }) {
  return (
    <section className="sc-scene">
      <div className="sc-head">
        <span className="sc-num">{n}</span>
        <div><h2>{title}</h2><p>{desc}</p></div>
      </div>
      <div className={`ws theme-${sel.theme} type-${sel.type} radius-${sel.radius} density-${sel.density} sc-canvas`}>
        {children}
      </div>
      <AppliedList uses={uses} sel={sel} />
    </section>
  );
}

export default function Showcase({ sel }) {
  const colors = THEME_COLORS[sel.theme] ?? THEME_COLORS.blue;
  const E = (id) => DEMO[id]?.(sel[id]);
  const card = `wc card-${sel.card}`;

  // 커버리지 검증
  const covered = new Set([...FOUNDATIONS, ...Object.values(USES).flat()]);
  const missing = UI_ELEMENTS.filter((e) => !covered.has(e.id)).map((e) => e.id);

  return (
    <div className="sc-wrap">
      <div className="sc-intro">
        <a href="/ui-standard">← 워크숍으로</a>
        <h1>요소 쇼케이스</h1>
        <p>지정한 표준을 실제 화면 맥락에 배치했습니다. 66개 요소가 낱개 타일이 아니라 관리자 앱의 여러 장면 속에서 쓰입니다. 각 장면 아래에는 <b>적용된 요소 목록</b>이 붙습니다.</p>
        <div className="sc-cover">
          <span className={`sc-cover-badge ${missing.length ? "warn" : "ok"}`}>
            커버리지 {UI_ELEMENTS.length - missing.length} / {UI_ELEMENTS.length}
          </span>
          {missing.length > 0 && <span className="sc-cover-miss">미포함: {missing.join(", ")}</span>}
          <span className="sc-cover-note">전역 토큰(테마·타이포·모서리·밀도)은 모든 장면에 상속됩니다.</span>
        </div>
      </div>

      {/* ── 장면 1: 앱 셸 / 홈 ─────────────────────────── */}
      <Scene n="1" title="관리자 홈 · 앱 셸" desc="상단바 · 사이드바 · KPI · 차트를 갖춘 기본 관리 화면." uses={USES.A} sel={sel}>
        <div className="sc-topbar">
          {E("menubar")}
          <div className="sc-grow" />
          <div style={{ width: 190 }}>{E("searchinput")}</div>
          {E("notif")}
          {E("avatar")}
        </div>
        {E("banner")}
        <div className="sc-cols" style={{ marginTop: 14 }}>
          <aside className="sc-side">{E("sidebarnav")}</aside>
          <main className="sc-main">
            {E("breadcrumb")}
            {E("tabs")}
            <div className="sc-kpis">{E("stat")}{E("stat")}{E("stat")}</div>
            <div className={card}>
              <div className="sc-cardhead"><span className="sub">월별 매출</span>{E("toolbar")}</div>
              <StyledLine style={sel.chart} colors={colors} h={200} />
            </div>
            <div className="sc-two">
              <div className={card}>
                <div className="sub" style={{ marginBottom: 12 }}>팀 멤버</div>
                {E("avatargroup")}
                <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {E("buttongroup")}{E("iconbutton")}
                </div>
                <div style={{ marginTop: 14 }}>{E("kbd")}</div>
              </div>
              <div className={card}>
                <div className="sub" style={{ marginBottom: 12 }}>바로가기</div>
                {E("navmenu")}
                <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>{E("button")}{E("badge")}</div>
              </div>
            </div>
          </main>
        </div>
      </Scene>

      {/* ── 장면 2: 주문 목록 / 데이터 뷰 ───────────────── */}
      <Scene n="2" title="주문 목록 · 데이터 뷰" desc="필터 · 테이블 · 페이지네이션으로 구성된 목록 화면." uses={USES.B} sel={sel}>
        <div className="sc-filters">
          {E("searchinput")}{E("select")}{E("combobox")}{E("datefield")}
          <div style={{ marginLeft: "auto" }}>{E("toggle")}</div>
        </div>
        <div className={card}>
          <div className="sc-cardhead">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{E("buttongroup")}{E("badge")}</div>
            <div style={{ width: 200 }}>{E("progress")}</div>
          </div>
          {E("table")}
          <div className="sc-tablefoot">{E("pagination")}</div>
        </div>
        <div className="sc-two" style={{ marginTop: 14 }}>
          <div className={card}>
            <div className="sub" style={{ marginBottom: 12 }}>선택 · 라벨</div>
            {E("checkbox")}
            <div style={{ marginTop: 12 }}>{E("tag")}</div>
            <div style={{ marginTop: 12 }}>{E("dropdown")}</div>
          </div>
          <div className={card}>
            <div className="sub" style={{ marginBottom: 12 }}>빠른 목록 · 결과 없음</div>
            {E("list")}
            <div style={{ marginTop: 12 }}>{E("emptystate")}</div>
          </div>
        </div>
      </Scene>

      {/* ── 장면 3: 고객 상세 / 프로필 ──────────────────── */}
      <Scene n="3" title="고객 상세 · 프로필" desc="프로필 · 활동 이력 · 미디어 · 문서를 담은 상세 패널." uses={USES.C} sel={sel}>
        <div className="sc-two">
          <div className={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {E("avatar")}
              <div><div className="sub">김민준 · Pro</div>{E("rating")}</div>
            </div>
            {E("separator")}
            <div style={{ marginTop: 12 }}>{E("desclist")}</div>
            <div style={{ marginTop: 12 }}>{E("tag")}</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
              {E("progressring")}<span className="txt" style={{ color: "hsl(var(--muted-foreground))" }}>목표 달성률</span>
            </div>
          </div>
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sub">미리보기 카드</div>
            {E("hovercard")}
            {E("tooltip")}
          </div>
        </div>
        <div className="sc-two" style={{ marginTop: 14 }}>
          <div className={card}><div className="sub" style={{ marginBottom: 12 }}>활동 이력</div>{E("timeline")}</div>
          <div className={card}><div className="sub" style={{ marginBottom: 12 }}>자주 묻는 질문</div>{E("accordion")}</div>
        </div>
        <div className="sc-two" style={{ marginTop: 14 }}>
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sub">첨부 미디어</div>{E("media")}{E("carousel")}
          </div>
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sub">프로젝트 파일</div>{E("tree")}{E("code")}
          </div>
        </div>
        <div className={card} style={{ marginTop: 14 }}>{E("collapsible")}</div>
      </Scene>

      {/* ── 장면 4: 설정 / 폼 ───────────────────────────── */}
      <Scene n="4" title="설정 · 폼 마법사" desc="단계 · 입력 · 토글 · 파일 업로드로 이루어진 설정 화면." uses={USES.D} sel={sel}>
        <div className={card} style={{ marginBottom: 14 }}>{E("steps")}</div>
        <div className="sc-two">
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="sub">기본 정보</div>
            {E("field")}{E("input")}{E("textarea")}{E("select")}{E("combobox")}{E("datefield")}
          </div>
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="sub">환경 설정</div>
            {E("radio")}{E("checkbox")}{E("switch")}{E("slider")}
          </div>
        </div>
        <div className="sc-two" style={{ marginTop: 14 }}>
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sub">2단계 인증 코드</div>{E("otp")}
          </div>
          <div className={card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sub">첨부</div>{E("filedrop")}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>{E("alert")}</div>
        <div className={card} style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          {E("popover")}
          <div>{E("button")}</div>
        </div>
      </Scene>

      {/* ── 장면 5: 오버레이 / 피드백 ───────────────────── */}
      <Scene n="5" title="오버레이 · 피드백 상태" desc="대화상자 · 시트 · 토스트 · 로딩 등 겹쳐 뜨는 표면의 '열린' 상태 모음." uses={USES.E} sel={sel}>
        <div className="sc-two">
          <div className="sc-stage"><span className="sc-stage-l">Dialog</span>{E("dialog")}</div>
          <div className="sc-stage"><span className="sc-stage-l">Alert Dialog</span>{E("alertdialog")}</div>
        </div>
        <div className="sc-two" style={{ marginTop: 14 }}>
          <div className="sc-stage"><span className="sc-stage-l">Sheet / Drawer</span>{E("sheet")}</div>
          <div className="sc-stage"><span className="sc-stage-l">Command</span>{E("command")}</div>
        </div>
        <div className="sc-two" style={{ marginTop: 14 }}>
          <div className="sc-stage"><span className="sc-stage-l">Toast</span>{E("toast")}</div>
          <div className="sc-stage"><span className="sc-stage-l">Popover</span>{E("popover")}</div>
        </div>
        <div className="sc-three" style={{ marginTop: 14 }}>
          <div className="sc-stage"><span className="sc-stage-l">Spinner</span>{E("spinner")}</div>
          <div className="sc-stage"><span className="sc-stage-l">Skeleton</span>{E("skeleton")}</div>
          <div className="sc-stage"><span className="sc-stage-l">Empty State</span>{E("emptystate")}</div>
        </div>
      </Scene>
    </div>
  );
}
