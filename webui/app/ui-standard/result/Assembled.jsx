"use client";
import {
  DemoButton, DemoCard, DemoTable, DemoInput, DemoSelect, DemoCheckbox, DemoSwitch,
  DemoAvatar, DemoAlert, DemoProgress, DemoTabs, DemoDialog, Badge,
  StyledLine, StyledBar, THEME_COLORS, DEMO,
} from "../demos";
import { UI_GROUPS, UI_ELEMENTS, candidateName } from "@/lib/ui-elements";
import { KPIS, ORDERS } from "@/lib/ui-dummy";

// 히어로 대시보드에서 이미 크게 쓴 요소는 갤러리에서 생략(중복 방지)
const HERO_SHOWN = new Set([
  "theme", "type", "radius", "density", "button", "card", "table", "badge",
  "avatar", "tabs", "alert", "progress", "input", "select", "checkbox", "switch",
  "chart", "dialog",
]);

export default function Assembled({ sel }) {
  const colors = THEME_COLORS[sel.theme] ?? THEME_COLORS.blue;
  const cardCls = `wc card-${sel.card}`;

  return (
    <div className={`ws theme-${sel.theme} type-${sel.type} radius-${sel.radius} density-${sel.density} res-root`}>
      {/* 헤더 */}
      <div className="res-head">
        <div>
          <div className="ttl">매출 대시보드</div>
          <div className="txt" style={{ color: "hsl(var(--muted-foreground))" }}>
            2026년 상반기 · 데모 데이터
          </div>
        </div>
        <DemoButton variant={sel.button} label="리포트 내보내기" withGhost={false} />
      </div>

      {/* 탭 */}
      <div style={{ marginBottom: 18 }}>
        <DemoTabs variant={sel.tabs} active={0} />
      </div>

      {/* KPI 카드 4 */}
      <div className="res-kpis">
        {KPIS.map((k) => (
          <DemoCard key={k.label} variant={sel.card} kpi={k} />
        ))}
      </div>

      {/* 차트 + 사이드 */}
      <div className="res-mid">
        <div className={cardCls} style={{ flex: "2 1 380px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div className="sub" style={{ marginBottom: 8 }}>월별 매출 추세</div>
            <StyledLine style={sel.chart} colors={colors} h={210} />
          </div>
          <div>
            <div className="sub" style={{ marginBottom: 8 }}>부서별 매출</div>
            <StyledBar style={sel.chart} colors={colors} h={130} />
          </div>
        </div>

        <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 14 }}>
          <DemoAlert variant={sel.alert} />
          <div className={cardCls} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sub">빠른 초대</div>
            <DemoSelect variant={sel.select} />
            <DemoInput variant={sel.input} />
            <DemoButton variant={sel.button} label="초대 보내기" withGhost={false} />
          </div>
          <div className={cardCls} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="sub" style={{ marginBottom: 2 }}>이번 분기 목표</div>
            <DemoProgress variant={sel.progress} />
          </div>
        </div>
      </div>

      {/* 주문 테이블 */}
      <div className={cardCls} style={{ marginTop: 16 }}>
        <div className="res-tbl-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="sub">최근 주문</div>
            <DemoAvatar variant={sel.avatar} />
          </div>
          <Badge variant={sel.badge} kind="ok">실시간</Badge>
        </div>
        <DemoTable variant={sel.table} badgeVariant={sel.badge} rows={ORDERS} />
      </div>

      {/* 설정 + 다이얼로그 */}
      <div className="res-mid" style={{ marginTop: 16 }}>
        <div className={cardCls} style={{ flex: "1 1 280px" }}>
          <div className="sub" style={{ marginBottom: 14 }}>알림 설정</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <DemoCheckbox variant={sel.checkbox} />
            <DemoSwitch variant={sel.switch} />
          </div>
        </div>
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="sub">확인 대화상자</div>
          <DemoDialog variant={sel.dialog} button={sel.button} />
        </div>
      </div>

      {/* 전체 요소 갤러리 — 히어로에 안 나온 나머지 선택까지 모두 반영 */}
      <div className="res-gallery">
        <div className="ttl" style={{ fontSize: 18, marginBottom: 4 }}>전체 요소 갤러리</div>
        <div className="txt" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 18 }}>
          위 대시보드에 크게 쓰이지 않은 나머지 컴포넌트까지, 지정한 표준 그대로 렌더한 모음입니다.
        </div>
        {UI_GROUPS.filter((g) => g.id !== "foundations" && g.id !== "chart").map((g) => {
          const els = UI_ELEMENTS.filter((e) => e.group === g.id && !HERO_SHOWN.has(e.id));
          if (!els.length) return null;
          return (
            <div key={g.id} style={{ marginTop: 18 }}>
              <div className="rg-group">{g.label}</div>
              <div className="rg-grid">
                {els.map((e) => (
                  <div className="rg-tile" key={e.id}>
                    <div className="rg-canvas">{DEMO[e.id]?.(sel[e.id])}</div>
                    <div className="rg-cap">
                      <span className="rg-name">{e.title}</span>
                      <span className="rg-pick">{candidateName(e.id, sel[e.id])}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
