"use client";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { KPIS, ORDERS, TREND, STATUS_KIND, fmtWon } from "@/lib/ui-dummy";


// 테마별 차트 색 (CSS var는 SVG에서 불안정 → JS 매핑)
export const THEME_COLORS = {
  blue: { c1: "hsl(221 83% 53%)", c2: "hsl(262 83% 63%)" },
  violet: { c1: "hsl(262 83% 58%)", c2: "hsl(291 70% 55%)" },
  emerald: { c1: "hsl(160 84% 36%)", c2: "hsl(173 70% 42%)" },
  slate: { c1: "hsl(215 28% 35%)", c2: "hsl(215 16% 55%)" },
};

// ── 버튼 ──────────────────────────────
export function DemoButton({ variant, label = "저장하기" }) {
  return (
    <div className="demo-row">
      <button className={`wb b-${variant}`}>{label}</button>
      <button className="wb ghost">취소</button>
    </div>
  );
}

// ── 카드(KPI) ─────────────────────────
export function DemoCard({ variant, kpi = KPIS[0] }) {
  return (
    <div className={`wc card-${variant} demo-full`}>
      <p className="kpi-l">{kpi.label}</p>
      <div className="kpi-v">
        {kpi.value}
        <span className={`kpi-d ${kpi.up ? "up" : "down"}`}>{kpi.delta}</span>
      </div>
    </div>
  );
}

// ── 뱃지 ──────────────────────────────
export function Badge({ variant, kind, children }) {
  if (variant === "dot") {
    return <span className={`wbadge bdg-dot ${kind}`}><span className="d" />{children}</span>;
  }
  return <span className={`wbadge bdg-${variant} ${kind}`}>{children}</span>;
}
export function DemoBadge({ variant }) {
  return (
    <div className="demo-row">
      <Badge variant={variant} kind="ok">완료</Badge>
      <Badge variant={variant} kind="wait">대기</Badge>
      <Badge variant={variant} kind="fail">실패</Badge>
    </div>
  );
}

// ── 테이블 ────────────────────────────
export function DemoTable({ variant, badgeVariant = "soft", rows = ORDERS }) {
  return (
    <div className="demo-tblwrap">
      <table className={`wt tbl-${variant}`}>
        <thead>
          <tr><th>주문</th><th>고객</th><th>플랜</th><th className="num">금액</th><th>상태</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.customer}</td>
              <td>{r.plan}</td>
              <td className="num">{fmtWon(r.amount)}</td>
              <td><Badge variant={badgeVariant} kind={STATUS_KIND[r.status]}>{r.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 인풋 ──────────────────────────────
export function DemoInput({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>이메일</label>
      <input className={`wi inp-${variant}`} placeholder="you@example.com" defaultValue="lunanalyze@gmail.com" />
    </div>
  );
}

// ── 차트 ──────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rc-tip">
      <div className="k">{label}</div>
      {payload.map((p) => (
        <div key={p.name}><span className="k">{p.name} </span><span className="v">{p.value}</span></div>
      ))}
    </div>
  );
}
export function DemoChart({ variant, colors = THEME_COLORS.blue, h = 150 }) {
  const grid = "hsl(214 32% 91% / .7)";
  const axis = { fontSize: 11, fill: "hsl(215 16% 47%)" };
  const gid = `g-${variant}-${colors.c1.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="demo-full" style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "area" ? (
          <AreaChart data={TREND} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.c1} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.c1} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ChartTip />} />
            <Area type="monotone" dataKey="매출" stroke={colors.c1} strokeWidth={2} fill={`url(#${gid})`} />
          </AreaChart>
        ) : variant === "bar" ? (
          <BarChart data={TREND} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(214 32% 91% / .35)" }} />
            <Bar dataKey="매출" fill={colors.c1} radius={[6, 6, 0, 0]} maxBarSize={26} />
          </BarChart>
        ) : (
          <LineChart data={TREND} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="매출" stroke={colors.c1} strokeWidth={2.2} dot={{ r: 3, fill: colors.c1 }} />
            <Line type="monotone" dataKey="비용" stroke={colors.c2} strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
// ── 테마/타이포 샘플 ───────────────────
const THEME_SWATCH = {
  blue: ["hsl(221 83% 53%)", "hsl(262 83% 63%)", "hsl(199 89% 48%)"],
  violet: ["hsl(262 83% 58%)", "hsl(291 70% 55%)", "hsl(221 83% 60%)"],
  emerald: ["hsl(160 84% 36%)", "hsl(173 70% 40%)", "hsl(130 55% 45%)"],
  slate: ["hsl(215 28% 30%)", "hsl(215 16% 55%)", "hsl(200 30% 50%)"],
};
export function ThemeSample({ theme }) {
  return (
    <div className={`theme-${theme}`} style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div className="demo-swatches">
        {THEME_SWATCH[theme].map((c, i) => (
          <div key={i} className="demo-swatch" style={{ background: c }} />
        ))}
      </div>
      <div className="demo-row">
        <button className="wb b-solid">주요 액션</button>
        <Badge variant="soft" kind="ok">완료</Badge>
      </div>
    </div>
  );
}
export function TypeSample({ type }) {
  return (
    <div className={`type-${type} demo-full`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="ttl">매출 대시보드</div>
      <div className="sub">이번 달 요약</div>
      <div className="txt">지난달 대비 매출이 12.4% 증가했고, 신규 가입은 1,284건입니다. 이탈률은 소폭 개선됐습니다.</div>
    </div>
  );
}
