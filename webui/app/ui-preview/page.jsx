"use client";
import { useState } from "react";
import "./preview.css";

const COLORS = [
  ["--background", "background"],
  ["--foreground", "foreground"],
  ["--primary", "primary"],
  ["--primary-foreground", "primary-fg"],
  ["--secondary", "secondary"],
  ["--muted", "muted"],
  ["--muted-foreground", "muted-fg"],
  ["--destructive", "destructive"],
  ["--border", "border"],
  ["--ring", "ring"],
];

const ROWS = [
  { name: "홍길동", dept: "영업", date: "2026-06-21", amount: 1200000, status: "ok" },
  { name: "김철수", dept: "개발", date: "2026-06-22", amount: 980500, status: "wait" },
  { name: "이영희", dept: "디자인", date: "2026-06-23", amount: 4530000, status: "ok" },
  { name: "박민수", dept: "기획", date: "2026-06-24", amount: 75000, status: "fail" },
];
const PILL = {
  ok: ["pill-ok", "완료"],
  wait: ["pill-wait", "대기"],
  fail: ["pill-fail", "실패"],
};

function Btn({ variant = "default", size, children, ...rest }) {
  const cls = ["btn", `btn-${variant}`, size && `btn-${size}`].filter(Boolean).join(" ");
  return <button className={cls} {...rest}>{children}</button>;
}

export default function UiPreview() {
  const [dark, setDark] = useState(false);
  return (
    <div className={"uiprev" + (dark ? " dark" : "")}>
      <div className="wrap">
        <div className="topbar">
          <h1>UI 표준 미리보기</h1>
          <button className="toggle" onClick={() => setDark((d) => !d)}>
            {dark ? "☀︎ 라이트" : "☾ 다크"}로 보기
          </button>
        </div>
        <p className="lead">
          docs/standards/ui/* 의 토큰·컴포넌트 규칙을 샘플 데이터로 렌더링했습니다.
          라이트/다크를 토글해 확인한 뒤 수락/수정해 주세요.
        </p>

        {/* Colors */}
        <section>
          <h2>색 토큰 (Color tokens)</h2>
          <p className="desc">CSS 변수 토큰. 코드에서는 bg-primary 처럼 이름으로 사용(원시 hex 금지).</p>
          <div className="swatches">
            {COLORS.map(([v, label]) => (
              <div className="swatch" key={v}>
                <div className="chip" style={{ background: `hsl(var(${v}))` }} />
                <div className="name"><b>{label}</b><span>{v}</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2>Typography</h2>
          <p className="desc">7단계 타입 스케일. 본문 16/24, 보조는 muted-foreground.</p>
          {[
            ["Display · text-3xl · 700", "t-display", "프로젝트 대시보드"],
            ["H1 · text-2xl · 600", "t-h1", "월간 매출 현황"],
            ["H2 · text-xl · 600", "t-h2", "부서별 집계"],
            ["H3 · text-lg · 500", "t-h3", "영업팀 상세"],
            ["Body · text-base · 400", "t-body", "본문 텍스트입니다. 한글과 English가 함께 자연스럽게 보입니다."],
            ["Small · text-sm · 400", "t-sm", "보조 설명 텍스트 (muted)"],
            ["Caption · text-xs · 500", "t-xs", "라벨 / 캡션"],
          ].map(([meta, cls, text]) => (
            <div className="type-row" key={cls}>
              <div className="meta">{meta}</div>
              <div className={cls}>{text}</div>
            </div>
          ))}
        </section>

        {/* Buttons */}
        <section>
          <h2>Button</h2>
          <p className="desc">variant 6종 · size 4종 · 상태(hover/focus/disabled/loading).</p>
          <div className="row">
            <Btn variant="default">저장</Btn>
            <Btn variant="secondary">보조</Btn>
            <Btn variant="outline">취소</Btn>
            <Btn variant="ghost">더보기</Btn>
            <Btn variant="destructive">삭제</Btn>
            <Btn variant="link">자세히</Btn>
            <span className="tag">variant: default / secondary / outline / ghost / destructive / link</span>
          </div>
          <div className="row">
            <Btn variant="default" size="sm">Small</Btn>
            <Btn variant="default">Default</Btn>
            <Btn variant="default" size="lg">Large</Btn>
            <Btn variant="outline" size="icon" aria-label="편집">✎</Btn>
            <span className="tag">size: sm(32) / default(40) / lg(44) / icon</span>
          </div>
          <div className="row">
            <Btn variant="default" disabled>비활성</Btn>
            <Btn variant="default" disabled><span className="spinner" /> 저장 중…</Btn>
            <Btn variant="destructive">위험 액션</Btn>
            <span className="tag">disabled · loading(스피너+라벨 유지) · 파괴적 액션은 확인 절차</span>
          </div>
        </section>

        {/* Table */}
        <section>
          <h2>Table</h2>
          <p className="desc">숫자/날짜 우측 정렬 · 행 hover · 상태 pill · 빈/로딩 상태 포함.</p>
          <div className="table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>이름</th><th>부서</th><th className="num">날짜</th>
                  <th className="num">금액(원)</th><th>상태</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.dept}</td>
                    <td className="num">{r.date}</td>
                    <td className="num">{r.amount.toLocaleString("ko-KR")}</td>
                    <td><span className={"pill " + PILL[r.status][0]}>{PILL[r.status][1]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="desc" style={{ marginTop: 18 }}>빈 상태 (empty)</p>
          <div className="table-wrap">
            <table className="ui-table">
              <thead><tr><th>이름</th><th>부서</th><th className="num">금액(원)</th></tr></thead>
              <tbody><tr><td className="empty-cell" colSpan={3}>표시할 데이터가 없습니다.</td></tr></tbody>
            </table>
          </div>

          <p className="desc" style={{ marginTop: 18 }}>로딩 상태 (skeleton)</p>
          <div className="table-wrap">
            <table className="ui-table">
              <thead><tr><th>이름</th><th>부서</th><th className="num">금액(원)</th></tr></thead>
              <tbody>
                {[0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ width: "60%" }} /></td>
                    <td><div className="skeleton" style={{ width: "40%" }} /></td>
                    <td><div className="skeleton" style={{ width: "50%", marginLeft: "auto" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Image / Avatar */}
        <section>
          <h2>Image / Avatar</h2>
          <p className="desc">16:9 비율 고정(CLS 방지) · alt 필수 · 아바타는 이미지 실패 시 이니셜 폴백.</p>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="img-frame">
              <div className="cap">샘플 이미지 (16:9, object-cover)</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span className="avatar">JB</span>
              <span className="avatar">홍</span>
              <span className="tag" style={{ width: "auto" }}>Avatar 폴백(이니셜)</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
