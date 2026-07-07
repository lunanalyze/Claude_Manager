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

/* ══ 폼 컨트롤 ═══════════════════════════════════════════ */
export function DemoButton({ variant, label = "저장하기", withGhost = true }) {
  return (
    <div className="demo-row">
      <button className={`wb b-${variant}`}>{label}</button>
      {withGhost && variant !== "link" && <button className="wb ghost">취소</button>}
    </div>
  );
}

export function DemoInput({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>이메일</label>
      <input className={`wi inp-${variant}`} placeholder="you@example.com" defaultValue="lunanalyze@gmail.com" />
    </div>
  );
}

export function DemoTextarea({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>메모</label>
      <textarea className={`wta inp-${variant}`} rows={3} defaultValue={"이번 분기 목표를 정리했습니다.\n주요 지표는 매출과 이탈률."} />
    </div>
  );
}

export function DemoSelect({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>플랜</label>
      <div className={`wsel sel-${variant}`} role="button" tabIndex={0}>
        <span>Pro · 월 ₩49,000</span><span className="chev">▾</span>
      </div>
    </div>
  );
}

export function DemoCombobox({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>담당자</label>
      <div className={`wsel sel-${variant}`} role="button" tabIndex={0}>
        <span className="cb-ico">🔍</span>
        <span style={{ flex: "1 1 auto" }}>김민준</span><span className="chev">▾</span>
      </div>
    </div>
  );
}

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

export function DemoRadio({ variant }) {
  const rows = [["월간 결제", true], ["연간 결제 (2개월 무료)", false], ["평생 이용권", false]];
  return (
    <div className={`wradio rad-${variant} demo-full`}>
      {rows.map(([label, on]) => (
        <label className={`row ${on ? "on" : ""}`} key={label}>
          <span className="dot"><span className="i" /></span>{label}
        </label>
      ))}
    </div>
  );
}

export function DemoSwitch({ variant }) {
  const rows = [["다크 모드", true], ["2단계 인증", false]];
  return (
    <div className="wswitch demo-full">
      {rows.map(([label, on]) => (
        <div className="row" key={label}>
          <span className={`wtoggle sw-${variant} ${on ? "on" : ""}`}><span className="knob" /></span>{label}
        </div>
      ))}
    </div>
  );
}

export function DemoSlider({ variant }) {
  return (
    <div className={`wslider sld-${variant} demo-full`}>
      <div className="row"><span className="lbl">예산</span>
        <div className="track"><div className="fill" style={{ width: "62%" }} /><span className="handle" style={{ left: "62%" }} /></div>
      </div>
      <div className="row"><span className="lbl">알림</span>
        <div className="track"><div className="fill" style={{ width: "30%" }} /><span className="handle" style={{ left: "30%" }} /></div>
      </div>
    </div>
  );
}

export function DemoToggle({ variant }) {
  const items = [["B", true], ["I", false], ["U", false]];
  return (
    <div className={`wtoggrp tgg-${variant} demo-full`}>
      {items.map(([t, on]) => (
        <button key={t} className={`seg ${on ? "on" : ""}`}>{t}</button>
      ))}
    </div>
  );
}

export function DemoOtp({ variant }) {
  const vals = ["4", "8", "2", "", "", ""];
  return (
    <div className={`wotp otp-${variant} demo-full`}>
      {vals.map((v, i) => (
        <div key={i} className={`cell ${i === 3 ? "active" : ""}`}>{v}</div>
      ))}
    </div>
  );
}

export function DemoDateField({ variant }) {
  return (
    <div className="wi-field demo-full">
      <label>결제일</label>
      <div className={`wsel sel-${variant}`} role="button" tabIndex={0}>
        <span className="cb-ico">📅</span>
        <span style={{ flex: "1 1 auto" }}>2026-07-07</span><span className="chev">▾</span>
      </div>
    </div>
  );
}

export function DemoField({ variant }) {
  return (
    <div className={`wfield fld-${variant} demo-full`}>
      <div className="fld-line">
        <label>표시 이름</label>
        <div className="fld-input">
          <input className="wi inp-outline" defaultValue="루나" placeholder="이름" />
        </div>
      </div>
      <p className="fld-help">프로필과 댓글에 표시됩니다.</p>
    </div>
  );
}

/* ══ 데이터 표시 ═════════════════════════════════════════ */
export function DemoCard({ variant, kpi = KPIS[0] }) {
  return (
    <div className={`wc card-${variant} demo-full`}>
      <p className="kpi-l">{kpi.label}</p>
      <div className="kpi-v">{kpi.value}<span className={`kpi-d ${kpi.up ? "up" : "down"}`}>{kpi.delta}</span></div>
    </div>
  );
}

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

export function DemoTable({ variant, badgeVariant = "soft", rows = ORDERS }) {
  return (
    <div className="demo-tblwrap">
      <table className={`wt tbl-${variant}`}>
        <thead><tr><th>주문</th><th>고객</th><th>플랜</th><th className="num">금액</th><th>상태</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td>{r.customer}</td><td>{r.plan}</td>
              <td className="num">{fmtWon(r.amount)}</td>
              <td><Badge variant={badgeVariant} kind={STATUS_KIND[r.status]}>{r.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DemoAvatar({ variant }) {
  const people = [["김민", "hsl(221 83% 55%)"], ["이서", "hsl(160 70% 40%)"], ["박지", "hsl(32 90% 50%)"]];
  return (
    <div className={`wav av-${variant}`}>
      {people.map(([ini, bg]) => <span key={ini} className="av" style={{ background: bg }}>{ini}</span>)}
    </div>
  );
}

export function DemoAccordion({ variant }) {
  const items = [["결제 수단은 어떻게 바꾸나요?", true], ["환불 정책이 궁금해요", false], ["팀 요금제 할인", false]];
  return (
    <div className={`wacc acc-${variant} demo-full`}>
      {items.map(([q, open]) => (
        <div className={`item ${open ? "open" : ""}`} key={q}>
          <div className="head"><span>{q}</span><span className="chev">{open ? "▾" : "›"}</span></div>
          {open && <div className="body">설정 → 결제에서 언제든 변경할 수 있습니다.</div>}
        </div>
      ))}
    </div>
  );
}

export function DemoSkeleton({ variant }) {
  return (
    <div className={`wskel sk-${variant} demo-full`}>
      <div className="row"><span className="sk-av" /><div className="sk-lines"><span className="sk-l w70" /><span className="sk-l w40" /></div></div>
      <span className="sk-l w90" /><span className="sk-l w80" />
    </div>
  );
}

export function DemoTooltip({ variant }) {
  return (
    <div className="demo-col">
      <div className={`wtip tip-${variant}`}>업데이트: 2분 전<span className="arrow" /></div>
      <button className="wb b-soft">호버 대상</button>
    </div>
  );
}

export function DemoHoverCard({ variant }) {
  return (
    <div className={`whcard hc-${variant} demo-full`}>
      <div className="hc-head">
        <span className="av" style={{ background: "hsl(221 83% 55%)" }}>루</span>
        <div><div className="hc-name">@lunanalyze</div><div className="hc-sub">제품 디자이너</div></div>
      </div>
      <p className="hc-body">데이터 대시보드와 디자인 시스템을 만듭니다.</p>
    </div>
  );
}

export function DemoSeparator({ variant }) {
  return (
    <div className="demo-full" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="txt">섹션 A</span>
      {variant === "label"
        ? <div className="wsep sep-label"><span className="line" /><span className="t">또는</span><span className="line" /></div>
        : <div className={`wsep sep-${variant}`} />}
      <span className="txt">섹션 B</span>
    </div>
  );
}

/* ══ 내비게이션 ══════════════════════════════════════════ */
export function DemoTabs({ variant, active = 0 }) {
  const tabs = ["개요", "주문", "설정"];
  return (
    <div className={`wtabs tab-${variant} demo-full`}>
      {tabs.map((t, i) => <span key={t} className={`tab ${i === active ? "on" : ""}`}>{t}</span>)}
    </div>
  );
}

export function DemoBreadcrumb({ variant }) {
  const parts = ["대시보드", "주문", "#10245"];
  const sep = { chevron: "›", slash: "/", dot: "·" }[variant] ?? "›";
  return (
    <div className="wbc demo-full">
      {parts.map((p, i) => (
        <span key={p} className="seg">
          <span className={i === parts.length - 1 ? "cur" : "link"}>{p}</span>
          {i < parts.length - 1 && <span className="bsep">{sep}</span>}
        </span>
      ))}
    </div>
  );
}

export function DemoPagination({ variant }) {
  if (variant === "compact")
    return <div className="wpag demo-row"><button className="pg">←</button><span className="pg-info">3 / 12</span><button className="pg">→</button></div>;
  if (variant === "arrows")
    return <div className="wpag demo-row"><button className="pg wide">← 이전</button><button className="pg wide">다음 →</button></div>;
  return (
    <div className="wpag demo-row">
      <button className="pg">←</button>
      {[1, 2, 3, 4].map((n) => <button key={n} className={`pg ${n === 3 ? "on" : ""}`}>{n}</button>)}
      <button className="pg">→</button>
    </div>
  );
}

export function DemoNavMenu({ variant }) {
  const items = [["대시보드", true], ["주문", false], ["고객", false], ["설정", false]];
  return (
    <div className={`wnav nav-${variant} demo-full`}>
      {items.map(([t, on]) => <span key={t} className={`nv ${on ? "on" : ""}`}>{t}</span>)}
    </div>
  );
}

export function DemoMenubar({ variant }) {
  return (
    <div className={`wmenubar mb-${variant} demo-full`}>
      {["파일", "편집", "보기", "도움말"].map((t, i) => <span key={t} className={`mb-item ${i === 0 ? "on" : ""}`}>{t}</span>)}
    </div>
  );
}

export function DemoDropdown({ variant }) {
  return (
    <div className={`wmenu menu-${variant} demo-full`}>
      <div className="mi">프로필 보기</div>
      <div className="mi">설정</div>
      <div className="msep" />
      <div className="mi danger">로그아웃</div>
    </div>
  );
}

export function DemoCommand({ variant }) {
  return (
    <div className={`wcmd cmd-${variant} demo-full`}>
      <div className="cmd-in"><span className="cb-ico">🔍</span><span className="ph">명령 또는 검색…</span></div>
      <div className="cmd-grp">바로가기</div>
      <div className="ci"><span>＋</span>새 주문</div>
      <div className="ci"><span>⚙</span>설정 열기</div>
    </div>
  );
}

export function DemoSidebarNav({ variant }) {
  const items = [["◧ 대시보드", true], ["▤ 주문", false], ["◔ 고객", false]];
  return (
    <div className={`wsbnav sb-${variant} demo-full`}>
      {items.map(([t, on]) => <div key={t} className={`sb-item ${on ? "on" : ""}`}>{t}</div>)}
    </div>
  );
}

/* ══ 오버레이 · 피드백 ═══════════════════════════════════ */
export function DemoDialog({ variant, button = "solid" }) {
  return (
    <div className="dlg-backdrop demo-full">
      <div className={`wdlg dlg-${variant}`}>
        <p className="dt">주문을 삭제할까요?</p>
        <p className="dx">이 작업은 되돌릴 수 없습니다.</p>
        <div className="df"><button className="wb ghost sm">취소</button><button className={`wb b-${button} sm`}>삭제</button></div>
      </div>
    </div>
  );
}

export function DemoAlertDialog({ variant }) {
  return (
    <div className="dlg-backdrop demo-full">
      <div className={`wdlg dlg-${variant}`}>
        <div className="ad-head"><span className="ad-ico">⚠</span><p className="dt">계정을 삭제할까요?</p></div>
        <p className="dx">모든 데이터가 영구 삭제됩니다.</p>
        <div className="df"><button className="wb ghost sm">취소</button><button className="wb b-danger sm">영구 삭제</button></div>
      </div>
    </div>
  );
}

export function DemoSheet({ variant }) {
  const side = variant; // right/left/bottom
  return (
    <div className={`wsheet sheet-${side} demo-full`}>
      <div className="sh-panel">
        <div className="sh-head"><span className="sub">필터</span><span className="sh-x">✕</span></div>
        <div className="sh-row">상태 · 전체</div>
        <div className="sh-row">기간 · 최근 30일</div>
      </div>
    </div>
  );
}

export function DemoPopover({ variant }) {
  return (
    <div className={`wpop pop-${variant} demo-full`}>
      <div className="pop-t">알림 설정</div>
      <div className="pop-row">이메일<span className="pop-v">켜짐</span></div>
      <div className="pop-row">푸시<span className="pop-v">꺼짐</span></div>
    </div>
  );
}

export function DemoToast({ variant }) {
  return (
    <div className={`wtoast toast-${variant} demo-full`}>
      <span className="tico">✓</span>
      <div><div className="tt">저장되었습니다</div><div className="tx">변경사항이 반영됐어요.</div></div>
      <span className="tx-close">✕</span>
    </div>
  );
}

export function DemoAlert({ variant }) {
  return (
    <div className={`walert al-${variant} demo-full`}>
      <span className="ai">◆</span>
      <div><p className="at">결제가 곧 만료됩니다</p><p className="ax">7일 내 갱신하지 않으면 Pro 기능이 중단됩니다.</p></div>
    </div>
  );
}

export function DemoProgress({ variant }) {
  return (
    <div className={`wprog pr-${variant} demo-full`}>
      <div className="track"><div className="fill" style={{ width: "72%" }} /></div>
      <div className="track"><div className="fill" style={{ width: "38%" }} /></div>
    </div>
  );
}

/* ══ 차트 룩앤필 엔진 ════════════════════════════════════ */
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
      {payload.map((p) => <div key={p.name}><span className="k">{p.name} </span><span className="v">{p.value}</span></div>)}
    </div>
  );
}
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
export function DemoChart({ variant, colors = THEME_COLORS.blue }) {
  return (
    <div className="demo-full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <StyledLine style={variant} colors={colors} h={92} />
      <StyledBar style={variant} colors={colors} h={62} />
    </div>
  );
}

/* ══ 신규: 폼 추가 ═══════════════════════════════════════ */
export function DemoIconButton({ variant }) {
  return <div className="demo-row">{["✎", "🗑", "★"].map((i, k) => <button key={k} className={`wib ib-${variant}`}>{i}</button>)}</div>;
}
export function DemoButtonGroup({ variant }) {
  if (variant === "split")
    return <div className="wbg bg-split demo-row"><button className="wb b-solid">저장</button><button className="wb b-solid">▾</button></div>;
  const items = ["왼쪽", "가운데", "오른쪽"];
  return <div className={`wbg bg-${variant}`}>{items.map((t, i) => <button key={t} className={`bg-btn ${i === 0 ? "on" : ""}`}>{t}</button>)}</div>;
}
export function DemoSearchInput({ variant }) {
  return (
    <div className={`wsearch se-${variant} demo-full`}>
      <span className="se-ico">🔍</span>
      <input placeholder="검색…" defaultValue="주문 #10245" />
      <span className="se-clear">✕</span>
    </div>
  );
}
export function DemoFileDrop({ variant }) {
  return (
    <div className={`wdrop drop-${variant} demo-full`}>
      <div className="drop-ico">⬆</div>
      <div className="drop-t">파일을 끌어다 놓기</div>
      <div className="drop-x">또는 클릭해 업로드 · PNG, PDF</div>
    </div>
  );
}

/* ══ 신규: 데이터 표시 ═══════════════════════════════════ */
function Spark() {
  return (
    <svg width="66" height="22" viewBox="0 0 66 22" preserveAspectRatio="none">
      <polyline points="0,18 13,13 26,15 39,7 52,9 66,2" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Ring({ pct }) {
  const r = 16, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="hsl(var(--foreground))">{pct}</text>
    </svg>
  );
}
export function DemoStat({ variant }) {
  const label = "월 매출", val = "₩128.4M", delta = "+12.4%";
  if (variant === "icon")
    return (
      <div className="wstat st-icon demo-full">
        <span className="st-ic">💰</span>
        <div><div className="st-l">{label}</div><div className="st-v">{val}</div></div>
        <span className="st-d up">{delta}</span>
      </div>
    );
  if (variant === "spark")
    return (
      <div className="wstat st-spark demo-full">
        <div className="st-l">{label}</div>
        <div className="st-row"><div className="st-v">{val}</div><Spark /></div>
      </div>
    );
  if (variant === "ring")
    return (
      <div className="wstat st-ring demo-full">
        <Ring pct={72} />
        <div><div className="st-l">{label}</div><div className="st-v">{val}</div><span className="st-d up">{delta}</span></div>
      </div>
    );
  return (
    <div className="wstat st-plain demo-full">
      <div className="st-l">{label}</div><div className="st-v">{val}</div><span className="st-d up">{delta}</span>
    </div>
  );
}
export function DemoList({ variant }) {
  const rows = [["프로필 설정", "계정 정보 관리"], ["결제 수단", "카드 · 계좌"], ["알림", "이메일 · 푸시"]];
  return (
    <div className={`wlist list-${variant} demo-full`}>
      {rows.map(([t, s]) => (
        <div className="li" key={t}><div><div className="li-t">{t}</div><div className="li-s">{s}</div></div><span className="li-ch">›</span></div>
      ))}
    </div>
  );
}
export function DemoDescList({ variant }) {
  const rows = [["플랜", "Pro"], ["상태", "활성"], ["다음 결제", "2026-08-01"]];
  return (
    <div className={`wdl dl-${variant} demo-full`}>
      {rows.map(([k, v]) => <div className="dl-row" key={k}><span className="dl-k">{k}</span><span className="dl-v">{v}</span></div>)}
    </div>
  );
}
export function DemoTag({ variant }) {
  return (
    <div className={`wtags tag-${variant} demo-row`}>
      {["디자인", "프론트엔드", "긴급"].map((t) => <span key={t} className="tg">{t}<span className="tg-x">✕</span></span>)}
    </div>
  );
}
export function DemoAvatarGroup({ variant }) {
  const people = [["김", "hsl(221 83% 55%)"], ["이", "hsl(160 70% 40%)"], ["박", "hsl(32 90% 50%)"], ["최", "hsl(291 60% 55%)"]];
  return (
    <div className={`wavg avg-${variant} demo-full`}>
      {people.map(([i, bg], k) => <span key={k} className="av" style={{ background: bg }}>{i}</span>)}
      {variant === "count" && <span className="av more">+5</span>}
    </div>
  );
}
export function DemoRating({ variant }) {
  if (variant === "score")
    return <div className="wrate demo-row"><span className="rt-score">4.5</span><span className="rt-stars">★★★★☆</span><span className="rt-count">(128)</span></div>;
  const [full, empty] = variant === "hearts" ? ["♥", "♡"] : ["★", "☆"];
  return <div className={`wrate rate-${variant} demo-row`}>{[1, 1, 1, 1, 0].map((f, i) => <span key={i} className={`rt ${f ? "on" : ""}`}>{f ? full : empty}</span>)}</div>;
}
export function DemoKbd({ variant }) {
  return (
    <div className={`wkbd kbd-${variant} demo-row`}>
      <kbd>⌘</kbd><kbd>K</kbd><span className="kbd-txt">검색 열기</span>
    </div>
  );
}
export function DemoCode({ variant }) {
  return (
    <div className={`wcode code-${variant} demo-full`}>
      <div className="code-bar"><span className="cd-dot" /><span className="cd-dot" /><span className="cd-dot" /></div>
      <pre><span className="tk-k">const</span> total = orders.<span className="tk-f">reduce</span>((a, o) =&gt; a + o.amount, <span className="tk-n">0</span>);</pre>
    </div>
  );
}
const TREE = [[0, "📁", "app"], [1, "📁", "components"], [2, "📄", "button.tsx"], [2, "📄", "card.tsx", true], [1, "📄", "page.tsx"]];
export function DemoTree({ variant }) {
  return (
    <div className={`wtree tree-${variant} demo-full`}>
      {TREE.map(([lvl, ic, name, on], i) => (
        <div key={i} className={`tr-row lvl${lvl} ${on ? "on" : ""}`}><span className="tr-ic">{ic}</span>{name}</div>
      ))}
    </div>
  );
}
export function DemoTimeline({ variant }) {
  const items = [["주문 생성", "09:24"], ["결제 완료", "09:26"], ["배송 시작", "11:02"]];
  return (
    <div className={`wtl tl-${variant} demo-full`}>
      {items.map(([t, tm], i, arr) => (
        <div className="tl-item" key={t}>
          <div className="tl-marker"><span className="tl-dot" />{i < arr.length - 1 && <span className="tl-line" />}</div>
          <div className="tl-body"><div className="tl-t">{t}</div><div className="tl-tm">{tm}</div></div>
        </div>
      ))}
    </div>
  );
}

/* ══ 신규: 미디어 ════════════════════════════════════════ */
export function DemoMedia({ variant }) {
  return (
    <div className={`wmedia med-${variant} demo-full`}>
      <div className="med-frame"><span className="med-ico">🖼</span>{variant === "overlay" && <div className="med-ov">제품 이미지</div>}</div>
    </div>
  );
}
export function DemoCarousel({ variant }) {
  return (
    <div className={`wcar car-${variant} demo-full`}>
      <div className="car-frame"><span className="car-slide">1</span>
        {variant === "arrows" && <><button className="car-arrow l">‹</button><button className="car-arrow r">›</button></>}
      </div>
      {variant === "dots" && <div className="car-dots"><span className="on" /><span /><span /></div>}
      {variant === "thumbs" && <div className="car-thumbs"><span className="on">1</span><span>2</span><span>3</span></div>}
    </div>
  );
}

/* ══ 신규: 내비게이션 ════════════════════════════════════ */
export function DemoSteps({ variant }) {
  const steps = ["장바구니", "배송", "결제", "완료"], cur = 2;
  return (
    <div className={`wsteps step-${variant} demo-full`}>
      {steps.map((s, i, arr) => (
        <div key={s} className={`stp ${i < cur ? "done" : i === cur ? "cur" : ""}`}>
          <span className="stp-n">{variant === "dots" ? "" : i < cur ? "✓" : i + 1}</span>
          <span className="stp-l">{s}</span>
          {i < arr.length - 1 && <span className="stp-line" />}
        </div>
      ))}
    </div>
  );
}
export function DemoToolbar({ variant }) {
  return (
    <div className={`wtb tb-${variant} demo-full`}>
      <button className="tb-b on">B</button><button className="tb-b">I</button><button className="tb-b">U</button>
      <span className="tb-sep" /><button className="tb-b">≡</button><button className="tb-b">⋯</button>
      <span style={{ flex: 1 }} /><button className="tb-b">↗</button>
    </div>
  );
}
export function DemoCollapsible({ variant }) {
  return (
    <div className={`wcol col-${variant} demo-full`}>
      <div className="col-head"><span>고급 설정</span><span className="col-ic">{variant === "plus" ? "−" : "▾"}</span></div>
      <div className="col-body">API 키, 웹훅, 데이터 내보내기 옵션을 포함합니다.</div>
    </div>
  );
}

/* ══ 신규: 오버레이 · 피드백 ═════════════════════════════ */
export function DemoBanner({ variant }) {
  return (
    <div className={`wbanner ban-${variant} demo-full`}>
      <span className="ban-ic">🎉</span>
      <span className="ban-t">새 대시보드가 출시되었습니다.</span>
      <button className="ban-cta">자세히 →</button><span className="ban-x">✕</span>
    </div>
  );
}
export function DemoSpinner({ variant }) {
  if (variant === "dots") return <div className="wspin spin-dots demo-row"><span className="sp-dot" /><span className="sp-dot" /><span className="sp-dot" /></div>;
  if (variant === "bars") return <div className="wspin spin-bars demo-row"><span className="sp-bar" /><span className="sp-bar" /><span className="sp-bar" /><span className="sp-bar" /></div>;
  return <div className="wspin spin-ring demo-row"><span className="sp-ring" /></div>;
}
export function DemoEmpty({ variant }) {
  return (
    <div className={`wempty empty-${variant} demo-full`}>
      <div className="em-ic">📭</div>
      <div className="em-t">주문이 없습니다</div>
      <div className="em-x">첫 주문을 생성해 시작하세요.</div>
      <button className="wb b-solid sm">＋ 새 주문</button>
    </div>
  );
}
function ProgRing({ pct, variant }) {
  const r = 20, c = 2 * Math.PI * r, off = c * (1 - pct / 100), gid = `prg-${variant}-${pct}`;
  const stroke = variant === "gradient" ? `url(#${gid})` : "hsl(var(--primary))";
  return (
    <svg width="58" height="58" viewBox="0 0 58 58">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="hsl(var(--chart-1))" /><stop offset="100%" stopColor="hsl(var(--chart-2))" />
      </linearGradient></defs>
      <circle cx="29" cy="29" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" strokeDasharray={variant === "dashed" ? "3 4" : undefined} />
      <circle cx="29" cy="29" r={r} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 29 29)" />
      <text x="29" y="33" textAnchor="middle" fontSize="13" fontWeight="700" fill="hsl(var(--foreground))">{pct}%</text>
    </svg>
  );
}
export function DemoProgressRing({ variant }) {
  return <div className="demo-row" style={{ gap: 20 }}><ProgRing pct={72} variant={variant} /><ProgRing pct={40} variant={variant} /></div>;
}
export function DemoNotif({ variant }) {
  const txt = variant === "dot" ? ["", ""] : variant === "count" ? ["3", "12"] : ["9+", "99+"];
  return (
    <div className={`wnotif notif-${variant} demo-row`} style={{ gap: 26 }}>
      <span className="nf-anchor">🔔<span className="nf-badge">{txt[0]}</span></span>
      <span className="nf-anchor">✉<span className="nf-badge">{txt[1]}</span></span>
    </div>
  );
}

/* ══ 기초 샘플 ═══════════════════════════════════════════ */
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
      <div className="demo-swatches">{THEME_SWATCH[theme].map((c, i) => <div key={i} className="demo-swatch" style={{ background: c }} />)}</div>
      <div className="demo-row"><button className="wb b-solid">주요 액션</button><Badge variant="soft" kind="ok">완료</Badge></div>
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
export function RadiusSample({ variant }) {
  return (
    <div className={`radius-${variant} demo-full`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="wc card-flat" style={{ padding: "12px 14px" }}>
        <div className="wi-field"><input className="wi inp-outline" defaultValue="샘플 입력" /></div>
      </div>
      <div className="demo-row"><button className="wb b-solid">버튼</button><span className="wbadge bdg-soft ok">태그</span></div>
    </div>
  );
}
export function DensitySample({ variant }) {
  return (
    <div className={`density-${variant} demo-full`}>
      <div className="wc card-flat">
        <p className="kpi-l" style={{ marginBottom: 8 }}>이번 주 요약</p>
        <table className="wt tbl-lined"><tbody>
          <tr><td>신규 가입</td><td className="num">128</td></tr>
          <tr><td>활성 세션</td><td className="num">1,024</td></tr>
          <tr><td>결제 성공</td><td className="num">96%</td></tr>
        </tbody></table>
      </div>
    </div>
  );
}

/* ══ 요소 id → 렌더 함수 레지스트리 ══════════════════════
   워크숍(후보 캔버스)과 조립 페이지(갤러리)가 공유한다. */
export const DEMO = {
  theme:      (v) => <ThemeSample theme={v} />,
  type:       (v) => <TypeSample type={v} />,
  radius:     (v) => <RadiusSample variant={v} />,
  density:    (v) => <DensitySample variant={v} />,
  button:      (v) => <DemoButton variant={v} />,
  iconbutton:  (v) => <DemoIconButton variant={v} />,
  buttongroup: (v) => <DemoButtonGroup variant={v} />,
  input:       (v) => <DemoInput variant={v} />,
  searchinput: (v) => <DemoSearchInput variant={v} />,
  textarea:    (v) => <DemoTextarea variant={v} />,
  select:      (v) => <DemoSelect variant={v} />,
  combobox:    (v) => <DemoCombobox variant={v} />,
  checkbox:    (v) => <DemoCheckbox variant={v} />,
  radio:       (v) => <DemoRadio variant={v} />,
  switch:      (v) => <DemoSwitch variant={v} />,
  slider:      (v) => <DemoSlider variant={v} />,
  toggle:      (v) => <DemoToggle variant={v} />,
  otp:         (v) => <DemoOtp variant={v} />,
  datefield:   (v) => <DemoDateField variant={v} />,
  filedrop:    (v) => <DemoFileDrop variant={v} />,
  field:       (v) => <DemoField variant={v} />,
  card:        (v) => <DemoCard variant={v} />,
  stat:        (v) => <DemoStat variant={v} />,
  table:       (v) => <DemoTable variant={v} rows={ORDERS.slice(0, 3)} />,
  list:        (v) => <DemoList variant={v} />,
  desclist:    (v) => <DemoDescList variant={v} />,
  badge:       (v) => <DemoBadge variant={v} />,
  tag:         (v) => <DemoTag variant={v} />,
  avatar:      (v) => <DemoAvatar variant={v} />,
  avatargroup: (v) => <DemoAvatarGroup variant={v} />,
  rating:      (v) => <DemoRating variant={v} />,
  kbd:         (v) => <DemoKbd variant={v} />,
  code:        (v) => <DemoCode variant={v} />,
  tree:        (v) => <DemoTree variant={v} />,
  accordion:   (v) => <DemoAccordion variant={v} />,
  skeleton:    (v) => <DemoSkeleton variant={v} />,
  tooltip:     (v) => <DemoTooltip variant={v} />,
  hovercard:   (v) => <DemoHoverCard variant={v} />,
  separator:   (v) => <DemoSeparator variant={v} />,
  timeline:    (v) => <DemoTimeline variant={v} />,
  media:       (v) => <DemoMedia variant={v} />,
  carousel:    (v) => <DemoCarousel variant={v} />,
  tabs:        (v) => <DemoTabs variant={v} />,
  steps:       (v) => <DemoSteps variant={v} />,
  breadcrumb:  (v) => <DemoBreadcrumb variant={v} />,
  pagination:  (v) => <DemoPagination variant={v} />,
  navmenu:     (v) => <DemoNavMenu variant={v} />,
  menubar:     (v) => <DemoMenubar variant={v} />,
  toolbar:     (v) => <DemoToolbar variant={v} />,
  dropdown:    (v) => <DemoDropdown variant={v} />,
  command:     (v) => <DemoCommand variant={v} />,
  collapsible: (v) => <DemoCollapsible variant={v} />,
  sidebarnav:  (v) => <DemoSidebarNav variant={v} />,
  dialog:      (v) => <DemoDialog variant={v} />,
  alertdialog: (v) => <DemoAlertDialog variant={v} />,
  sheet:       (v) => <DemoSheet variant={v} />,
  popover:     (v) => <DemoPopover variant={v} />,
  toast:       (v) => <DemoToast variant={v} />,
  banner:      (v) => <DemoBanner variant={v} />,
  alert:       (v) => <DemoAlert variant={v} />,
  progress:    (v) => <DemoProgress variant={v} />,
  progressring:(v) => <DemoProgressRing variant={v} />,
  spinner:     (v) => <DemoSpinner variant={v} />,
  emptystate:  (v) => <DemoEmpty variant={v} />,
  notif:       (v) => <DemoNotif variant={v} />,
  chart:       (v) => <DemoChart variant={v} />,
};
