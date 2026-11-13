// 스트리밍 답 렌더링 — 모델은 글을 수십~수백 자씩 묶어 보낸다. 도착 속도의 절반으로 고르게 드러낸다.
// 교훈
// - requestAnimationFrame 루프는 '하나만' 돈다. 새 글자는 ref 로만 넘긴다
//   (글자가 올 때마다 루프를 새로 시작하면 목표 2배인데 측정 2.7~2.8배로 빨라졌다)
// - 글이 줄면(reset) 위치도 줄인다
// - 쓰는 중에는 '완성된 줄'까지만 Markdown 으로, 마지막 줄은 평문으로 그린다.
//   표는 구분줄(|---|)이 오기 전 머리줄과 쓰다 만 행을 숨겨 파이프 기호가 번쩍이지 않게 한다
// - 처음부터 완성본(저장된 대화, final 교체)이면 애니메이션 없이 바로 보여 준다
// Markdown 컴포넌트는 react-markdown + remark-gfm + remark-breaks + remark-cjk-friendly 권장
//   (remark-cjk-friendly: "**176.41%**로"처럼 닫는 ** 뒤에 한글이 붙어도 굵게로 인식)
import { useEffect, useRef, useState } from "react";

const SLOWDOWN = 2;      // 도착 속도의 1/2
const MIN_CPS = 12;      // 초당 최소 글자
const FALLBACK_CPS = 60; // 측정 전 기본값

function splitStable(text) {
    const cut = text.lastIndexOf("\n");
    if (cut < 0) return ["", text];
    let done = text.slice(0, cut + 1);
    const tail = text.slice(cut + 1);
    // 표: 구분줄이 아직 없으면 표 블록을 통째로 보류
    const lines = done.split("\n");
    let k = lines.length - 1;
    while (k > 0 && lines[k - 1].trim().startsWith("|")) k--;
    const block = lines.slice(k).filter(Boolean);
    if (block.length && !block.some((l) => /^\s*\|?\s*:?-{3,}/.test(l))) done = lines.slice(0, k).join("\n");
    return [done, tail];
}

export default function StreamText({ text, streaming, Markdown }) {
    const target = useRef(text);
    const [shown, setShown] = useState(streaming ? 0 : text.length);
    const pos = useRef(shown);
    const rate = useRef({ cps: FALLBACK_CPS, lastLen: text.length, lastT: performance.now() });

    useEffect(() => {
        const now = performance.now();
        const r = rate.current;
        const added = text.length - r.lastLen;
        if (added > 0 && now > r.lastT) {
            const measured = (added / (now - r.lastT)) * 1000;
            r.cps = Math.max(MIN_CPS, measured / SLOWDOWN);
        }
        r.lastLen = text.length;
        r.lastT = now;
        target.current = text;
        if (pos.current > text.length) pos.current = text.length; // reset
        if (!streaming) pos.current = text.length;                // 완성본
    }, [text, streaming]);

    useEffect(() => {
        let raf;
        let prev = performance.now();
        let last = -1; // 루프 안에서는 state 대신 지역 변수로 비교한다(클로저의 state 는 갱신되지 않음)
        const tick = (t) => {
            const dt = (t - prev) / 1000;
            prev = t;
            const goal = target.current.length;
            if (pos.current < goal) pos.current = Math.min(goal, pos.current + Math.max(1, rate.current.cps * dt));
            const next = Math.floor(Math.min(pos.current, goal));
            if (next !== last) {
                last = next;
                setShown(next);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const visible = (streaming ? target.current : text).slice(0, streaming ? shown : text.length);
    if (!streaming) return <Markdown>{visible}</Markdown>;
    const [done, tail] = splitStable(visible);
    return (
        <div>
            {done && <Markdown>{done}</Markdown>}
            <span className="whitespace-pre-wrap">{tail}</span>
            <span className="stream-caret" aria-hidden="true">▍</span>
        </div>
    );
}
