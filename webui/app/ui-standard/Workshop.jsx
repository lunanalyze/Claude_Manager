"use client";
import { useState } from "react";
import { UI_ELEMENTS } from "@/lib/ui-elements";
import { ORDERS } from "@/lib/ui-dummy";
import {
  DemoButton, DemoCard, DemoTable, DemoBadge, DemoChart, DemoInput,
  ThemeSample, TypeSample,
} from "./demos";

function Canvas({ elementId, cid }) {
  switch (elementId) {
    case "theme": return <ThemeSample theme={cid} />;
    case "type": return <TypeSample type={cid} />;
    case "button": return <DemoButton variant={cid} />;
    case "card": return <DemoCard variant={cid} />;
    case "table": return <DemoTable variant={cid} rows={ORDERS.slice(0, 3)} />;
    case "badge": return <DemoBadge variant={cid} />;
    case "chart": return <DemoChart variant={cid} />;
    case "input": return <DemoInput variant={cid} />;
    default: return null;
  }
}

export default function Workshop({ initial }) {
  const [sel, setSel] = useState(initial.saved || {});
  const [busy, setBusy] = useState(null);

  const total = UI_ELEMENTS.length;
  const confirmed = Object.keys(sel).length;
  const allDone = confirmed === total;

  async function pick(element, candidate) {
    if (sel[element] === candidate) return;
    setBusy(element + ":" + candidate);
    const prev = sel;
    setSel({ ...sel, [element]: candidate }); // 낙관적
    try {
      const res = await fetch("/api/ui-standard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ element, candidate }),
      });
      const data = await res.json();
      if (data.saved) setSel(data.saved);
    } catch {
      setSel(prev); // 롤백
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wsx">
      <div className="wsx-hero">
        <h1>🎛️ UI 표준 워크숍</h1>
        <p>
          각 시각요소의 후보를 더미 데이터로 비교하고, <b>「이걸로 확정」</b>을 누르면 그 요소의
          표준으로 저장됩니다. 모든 요소가 확정되면 선택들로 조립된 실제 대시보드가 완성됩니다.
        </p>
        <div className="wsx-progress">
          <div className="wsx-bar"><i style={{ width: `${(confirmed / total) * 100}%` }} /></div>
          <span className="n">{confirmed} / {total} 확정</span>
          <a className={`result-link ${allDone ? "" : "disabled"}`} href="/ui-standard/result">
            조립된 페이지 보기 →
          </a>
        </div>
      </div>

      {UI_ELEMENTS.map((el) => {
        const chosen = sel[el.id];
        return (
          <section className="el-section" key={el.id}>
            <div className="el-head">
              <h2>{el.title}</h2>
              {chosen ? <span className="done-tag">✓ 확정됨</span> : <span className="todo-tag">미확정</span>}
            </div>
            <p className="el-desc">{el.desc}</p>
            <div className="cand-grid">
              {el.candidates.map((c) => {
                const isSel = chosen === c.id;
                return (
                  <div className={`cand ${isSel ? "selected" : ""}`} key={c.id}>
                    <div className="cand-canvas ws">
                      <Canvas elementId={el.id} cid={c.id} />
                    </div>
                    <div className="cand-bar">
                      <span className="cand-name">{c.name}</span>
                      <button
                        className="cand-pick"
                        disabled={busy === el.id + ":" + c.id}
                        onClick={() => pick(el.id, c.id)}
                      >
                        {isSel ? "확정됨" : "이걸로 확정"}
                      </button>
                    </div>
                    <div className="cand-bar" style={{ borderTop: "none", paddingTop: 0 }}>
                      <span className="cand-note">{c.note}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
