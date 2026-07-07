"use client";
import { useState } from "react";
import { UI_ELEMENTS, UI_GROUPS } from "@/lib/ui-elements";
import { ORDERS } from "@/lib/ui-dummy";
import {
  DemoButton, DemoCard, DemoTable, DemoBadge, DemoChart, DemoInput,
  DemoSelect, DemoCheckbox, DemoSwitch, DemoAvatar, DemoAlert, DemoProgress,
  DemoTabs, DemoDialog, RadiusSample, DensitySample, ThemeSample, TypeSample,
} from "./demos";

function Canvas({ elementId, cid }) {
  switch (elementId) {
    case "theme":    return <ThemeSample theme={cid} />;
    case "type":     return <TypeSample type={cid} />;
    case "radius":   return <RadiusSample variant={cid} />;
    case "density":  return <DensitySample variant={cid} />;
    case "button":   return <DemoButton variant={cid} />;
    case "input":    return <DemoInput variant={cid} />;
    case "select":   return <DemoSelect variant={cid} />;
    case "checkbox": return <DemoCheckbox variant={cid} />;
    case "switch":   return <DemoSwitch variant={cid} />;
    case "card":     return <DemoCard variant={cid} />;
    case "table":    return <DemoTable variant={cid} rows={ORDERS.slice(0, 3)} />;
    case "badge":    return <DemoBadge variant={cid} />;
    case "avatar":   return <DemoAvatar variant={cid} />;
    case "alert":    return <DemoAlert variant={cid} />;
    case "progress": return <DemoProgress variant={cid} />;
    case "tabs":     return <DemoTabs variant={cid} />;
    case "dialog":   return <DemoDialog variant={cid} />;
    case "chart":    return <DemoChart variant={cid} />;
    default: return null;
  }
}

export default function Workshop({ initial }) {
  const [sel, setSel] = useState(initial.saved || {});
  const [busy, setBusy] = useState(null);

  const total = UI_ELEMENTS.length;
  const confirmed = Object.keys(sel).length;

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
      if (data.saved) setSel(data.saved); // 서버가 병합한 전체 선택으로 동기화(비파괴)
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
          요소별 후보를 더미 데이터로 비교하고 <b>「이걸로」</b>를 누르면 그 요소의 표준으로
          저장됩니다. 선택은 <b>누적</b>되며 — 나중에 다른 후보를 눌러도 기존 선택은 유지되고
          바뀐 부분만 반영됩니다. 언제든 다시 눌러 바꿀 수 있어요.
        </p>
        <div className="wsx-progress">
          <div className="wsx-bar"><i style={{ width: `${(confirmed / total) * 100}%` }} /></div>
          <span className="n">{confirmed} / {total} 지정됨 <em>(미지정은 기본값 사용)</em></span>
          <a className="result-link" href="/ui-standard/result">조립된 페이지 보기 →</a>
        </div>
      </div>

      {UI_GROUPS.map((g) => {
        const els = UI_ELEMENTS.filter((e) => e.group === g.id);
        if (!els.length) return null;
        return (
          <div className="wsx-group" key={g.id}>
            <div className="wsx-group-head">
              <h2>{g.label}</h2>
              <p>{g.desc}</p>
            </div>
            {els.map((el) => {
              const chosen = sel[el.id];
              return (
                <section className="el-section" key={el.id}>
                  <div className="el-head">
                    <h3>{el.title}</h3>
                    {chosen ? <span className="done-tag">✓ 지정됨</span> : <span className="todo-tag">미지정</span>}
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
                              {isSel ? "지정됨" : "이걸로"}
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
      })}
    </div>
  );
}
