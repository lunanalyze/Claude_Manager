"use client";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { KPIS, ORDERS, TREND, DEPT, STATUS_KIND, fmtWon } from "@/lib/ui-dummy";

// 테마별 차트 색 (CSS var는 SVG에서 불안정 → JS 매핑)
export const THEME_COLORS = {
  blue:    { c1: "hsl(221 83% 53%)", c2: "hsl(262 83% 63%)" },
  violet:  { c1: "hsl(262 83% 58%)", c2: "hsl(291 70% 55%)" },
  emerald: { c1: "hsl(160 84% 36%)", c2: "hsl(173 70% 42%)" },
  slate:   { c1: "hsl(215 28% 35%)", c2: "hsl(215 16% 55%)" },
  rose:    { c1: "hsl(347 77% 52%)", c2: "hsl(12 76% 61%)" },
  amber:   { c1: "hsl(32 92% 46%)",  c2: "hsl(43 96% 48%)" },
};

// ── 버튼 ──────────────────────────────
export function DemoButton({ variant, label = "저장하기", withGhost = true }) {
  return (
    <div className="demo-row">
      <button className={`wb b-${variant}`}>{label}</button>
      {withGhost && <button className="wb ghost">취소</button>}
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

// ── 셀렉트 ────────────────────────────
export function DemoSelect({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>플랜</label>
      <div className={`wsel sel-${variant}`} role="button" tabIndex={0}>
        <span>Pro · 월 ₩49,000</span>
        <span className="chev">▾</span>
      </div>
    </div>
  );
}

// ── 체크박스 ──────────────────────────
export function DemoCheckbox({ variant }) {
  const rows = [["이메일 알림", true], ["주간 리포트", true], ["마케팅 수신", false]];
  return (
    <div className={`wcheck chk-${variant} demo-full`}>
      {rows.map(([label, on]) => (
        <label className={`row ${on ? "on" : ""}`} key={label}>
          <span className="box">{on ? "✓" : ""}</span>{label}
        </label>
      ))}
    </div>
  );
}

// ── 스위치 ────────────────────────────
export function DemoSwitch({ variant }) {
  const rows = [["다크 모드", true], ["2단계 인증", false]];
  return (
    <div className="wswitch demo-full">
      {rows.map(([label, on]) => (
        <div className="row" key={label}>
          <span className={`wtoggle sw-${variant} ${on ? "on" : ""}`}><span className="knob" /></span>
          {label}
        </div>
      ))}
    </div>
  );
}

// ── 아바타 ────────────────────────────
export function DemoAvatar({ variant }) {
  const people = [["김민", "hsl(221 83% 55%)"], ["이서", "hsl(160 70% 40%)"], ["박지", "hsl(32 90% 50%)"]];
  return (
    <div className={`wav av-${variant}`}>
      {people.map(([ini, bg]) => (
        <span key={ini} className="av" style={{ background: bg }}>{ini}</span>
      ))}
    </div>
  );
}

// ── 얼럿 ──────────────────────────────
export function DemoAlert({ variant }) {
  return (
    <div className={`walert al-${variant} demo-full`}>
      <span className="ai">◆</span>
      <div>
        <p className="at">결제가 곧 만료됩니다</p>
        <p className="ax">7일 내 갱신하지 않으면 Pro 기능이 중단됩니다.</p>
      </div>
    </div>
  );
}

// ── 프로그레스 ────────────────────────
export function DemoProgress({ variant }) {
  return (
    <div className={`wprog pr-${variant} demo-full`}>
      <div className="track"><div className="fill" style={{ width: "72%" }} /></div>
      <div className="track"><div className="fill" style={{ width: "38%" }} /></div>
    </div>
  );
}

// ── 탭 ────────────────────────────────
export function DemoTabs({ variant, active = 0 }) {
  const tabs = ["개요", "주문", "설정"];
  return (
    <div className={`wtabs tab-${variant} demo-full`}>
      {tabs.map((t, i) => (
        <span key={t} className={`tab ${i === active ? "on" : ""}`}>{t}</span>
      ))}
    </div>
  );
}

// ── 다이얼로그 ────────────────────────
export function DemoDialog({ variant, button = "solid" }) {
  return (
    <div className="dlg-backdrop demo-full">
      <div className={`wdlg dlg-${variant}`}>
        <p className="dt">주문을 삭제할까요?</p>
        <p className="dx">이 작업은 되돌릴 수 없습니다.</p>
        <div className="df">
          <button className="wb ghost sm">취소</button>
          <button className={`wb b-${button} sm`}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// ── 반경 샘플 ─────────────────────────
export function RadiusSample({ variant }) {
  return (
    <div className={`radius-${variant} demo-full`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="wc card-flat" style={{ padding: "12px 14px" }}>
        <div className="wi-field">
          <input className="wi inp-outline" defaultValue="샘플 입력" />
        </div>
      </div>
      <div className="demo-row"><button className="wb b-solid">버튼</button><span className="wbadge bdg-soft ok">태그</span></div>
    </div>
  );
}

// ── 밀도 샘플 ─────────────────────────
export function DensitySample({ variant }) {
  return (
    <div className={`density-${variant} demo-full`}>
      <div className="wc card-flat">
        <p className="kpi-l" style={{ marginBottom: 8 }}>이번 주 요약</p>
        <table className="wt tbl-lined">
          <tbody>
            <tr><td>신규 가입</td><td className="num">128</td></tr>
            <tr><td>활성 세션</td><td className="num">1,024</td></tr>
            <tr><td>결제 성공</td><td className="num">96%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══ 차트 룩앤필 엔진 ═══════════════════════════════════════
// 후보 = "룩앤필". 같은 데이터를 서로 다른 룩으로 그린다(차트 종류 결정 아님).
export const CHART_STYLES = {
  minimal:  { grid: false,  axis: false, strokeW: 2,   dots: false, area: false, dash: null,   bar: "flat" },
  gridded:  { grid: true,   axis: true,  strokeW: 2,   dots: true,  area: false, dash: null,   bar: "flat" },
  gradient: { grid: false,  axis: true,  strokeW: 2.4, dots: false, area: true,  dash: null,   bar: "grad" },
  bold:     { grid: true,   axis: true,  strokeW: 3.6, dots: true,  area: false, dash: null,   bar: "bold" },
  soft:     { grid: "dash", axis: true,  strokeW: 2,   dots: false, area: true,  dash: "4 3",  bar: "soft" },
};

const GRID = "hsl(214 32% 91% / .8)";
const AXIS = { fontSize: 10, fill: "hsl(215 16% 47%)" };

function gridEl(s) {
  if (!s.grid) return null;
  return <CartesianGrid vertical={false} stroke={GRID} strokeDasharray={s.grid === "dash" ? "3 3" : undefined} />;
}
function axisEls(s) {
  if (!s.axis) return null;
  return [
    <XAxis key="x" dataKey="m" tick={AXIS} axisLine={false} tickLine={false} />,
    <YAxis key="y" tick={AXIS} axisLine={false} tickLine={false} width={28} />,
  ];
}
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

// 추세형(선/면적) — 룩앤필만 style 로 바뀐다
export function StyledLine({ style = "gradient", colors = THEME_COLORS.blue, data = TREND, h = 120 }) {
  const s = CHART_STYLES[style] ?? CHART_STYLES.gradient;
  const gid = `ln-${style}-${colors.c1.replace(/[^a-z0-9]/gi, "")}`;
  const dot = s.dots ? { r: 3, fill: colors.c1, strokeWidth: 0 } : false;
  return (
    <div className="demo-full" style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        {s.area ? (
          <AreaChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.c1} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.c1} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            {gridEl(s)}{axisEls(s)}
            <Tooltip content={<ChartTip />} />
            <Area type="monotone" dataKey="매출" stroke={colors.c1} strokeWidth={s.strokeW}
              strokeDasharray={s.dash || undefined} fill={`url(#${gid})`} dot={dot} />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
            {gridEl(s)}{axisEls(s)}
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="매출" stroke={colors.c1} strokeWidth={s.strokeW}
              strokeDasharray={s.dash || undefined} dot={dot} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// 비교형(막대) — 같은 룩앤필을 막대에도 적용
export function StyledBar({ style = "gradient", colors = THEME_COLORS.blue, data = DEPT, h = 96 }) {
  const s = CHART_STYLES[style] ?? CHART_STYLES.gradient;
  const gid = `br-${style}-${colors.c1.replace(/[^a-z0-9]/gi, "")}`;
  const radius = s.bar === "bold" ? [2, 2, 0, 0] : s.bar === "soft" ? [7, 7, 0, 0] : [4, 4, 0, 0];
  const fill = s.bar === "grad" ? `url(#${gid})` : colors.c1;
  const fillOpacity = s.bar === "soft" ? 0.55 : 1;
  const size = s.bar === "bold" ? 34 : 24;
  return (
    <div className="demo-full" style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.c1} stopOpacity={0.95} />
              <stop offset="100%" stopColor={colors.c1} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          {gridEl(s)}
          {s.axis && <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />}
          {s.axis && <YAxis tick={AXIS} axisLine={false} tickLine={false} width={28} />}
          <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(214 32% 91% / .35)" }} />
          <Bar dataKey="v" fill={fill} fillOpacity={fillOpacity} radius={radius} maxBarSize={size} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 후보 캔버스: "같은 룩, 두 종류(선+막대)" — 룩앤필이 종류를 가리지 않음을 보여준다
export function DemoChart({ variant, colors = THEME_COLORS.blue }) {
  return (
    <div className="demo-full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <StyledLine style={variant} colors={colors} h={92} />
      <StyledBar style={variant} colors={colors} h={62} />
    </div>
  );
}

// ── 테마/타이포 샘플 ───────────────────
const THEME_SWATCH = {
  blue:    ["hsl(221 83% 53%)", "hsl(262 83% 63%)", "hsl(199 89% 48%)"],
  violet:  ["hsl(262 83% 58%)", "hsl(291 70% 55%)", "hsl(221 83% 60%)"],
  emerald: ["hsl(160 84% 36%)", "hsl(173 70% 40%)", "hsl(130 55% 45%)"],
  slate:   ["hsl(215 28% 30%)", "hsl(215 16% 55%)", "hsl(200 30% 50%)"],
  rose:    ["hsl(347 77% 52%)", "hsl(330 75% 60%)", "hsl(12 76% 61%)"],
  amber:   ["hsl(32 92% 46%)",  "hsl(43 96% 48%)",  "hsl(20 90% 52%)"],
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
