"use client";
import {
  DemoButton, DemoCard, DemoTable, DemoInput, Badge, DemoChart, THEME_COLORS,
} from "../demos";
import { KPIS, ORDERS } from "@/lib/ui-dummy";

export default function Assembled({ sel }) {
  const colors = THEME_COLORS[sel.theme] ?? THEME_COLORS.blue;
  const chartTitle = { area: "월별 매출 추세", bar: "월별 매출", line: "매출·비용 추이" }[sel.chart];

  return (
    <div className={`ws theme-${sel.theme} type-${sel.type} res-root`}>
      {/* 헤더 */}
      <div className="res-head">
        <div>
          <div className="ttl">매출 대시보드</div>
          <div className="txt" style={{ color: "hsl(var(--muted-foreground))" }}>
            2026년 상반기 · 데모 데이터
          </div>
        </div>
        <DemoButton variant={sel.button} label="리포트 내보내기" />
      </div>

      {/* KPI 카드 4 */}
      <div className="res-kpis">
        {KPIS.map((k) => (
          <DemoCard key={k.label} variant={sel.card} kpi={k} />
        ))}
      </div>

      {/* 차트 + 폼 */}
      <div className="res-mid">
        <div className={`wc card-${sel.card}`} style={{ flex: "2 1 380px" }}>
          <div className="sub" style={{ marginBottom: 10 }}>{chartTitle}</div>
          <DemoChart variant={sel.chart} colors={colors} h={230} />
        </div>
        <div className={`wc card-${sel.card}`} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="sub">빠른 초대</div>
          <DemoInput variant={sel.input} />
          <DemoButton variant={sel.button} label="초대 보내기" />
        </div>
      </div>

      {/* 주문 테이블 */}
      <div className={`wc card-${sel.card}`} style={{ marginTop: 16 }}>
        <div className="res-tbl-head">
          <div className="sub">최근 주문</div>
          <Badge variant={sel.badge} kind="ok">실시간</Badge>
        </div>
        <DemoTable variant={sel.table} badgeVariant={sel.badge} rows={ORDERS} />
      </div>
    </div>
  );
}
