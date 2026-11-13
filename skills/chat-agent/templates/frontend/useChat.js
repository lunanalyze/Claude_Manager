// 챗 상태 훅 — SSE 이벤트를 메시지 목록에 반영한다.
// 교훈
// - 앱 최상단(레이아웃)에서 한 번만 만든다 → 화면을 옮겨도 대화·진행 중 답이 유지된다
// - turnRef: 늦게 끝난 이전 스트림이 현재 질문의 busy 를 풀지 않게 막는다
// - final 이 오면 본문을 가드 처리본(⚠ 포함)으로 교체하고, 그 뒤 token 은 무시한다
// - 새 질문을 보내면 진행 중인 스트림을 abort 한다(끼어들기)
// - 마지막으로 본 thread_id 만 localStorage 에 둔다(try/catch 필수 — 막힌 환경에서 throw)
import { useCallback, useRef, useState } from "react";
import { streamSSE } from "./sse";

const KEY = "chat.current";
const store = {
    get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
    set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* 무시 */ } },
};

export function useChat(apiBase) {
    const [threadId, setThreadId] = useState(store.get);
    const [messages, setMessages] = useState([]);   // {role:"user"|"agent", text, steps, final, streaming, error}
    const [busy, setBusy] = useState(false);
    const turnRef = useRef(0);
    const abortRef = useRef(null);

    const patchLast = (fn) => setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

    const send = useCallback(async (text) => {
        const q = text.trim();
        if (!q) return;
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const turn = ++turnRef.current;
        setBusy(true);
        setMessages((ms) => [...ms, { role: "user", text: q }, { role: "agent", text: "", steps: [], streaming: true }]);
        try {
            await streamSSE(`${apiBase}/api/chat`, { message: q, thread_id: threadId }, (ev) => {
                if (turn !== turnRef.current) return;
                if (ev.type === "start") { setThreadId(ev.thread_id); store.set(ev.thread_id); }
                else if (ev.type === "step") patchLast((m) => ({ ...m, steps: [...m.steps, ev.label].slice(-4) }));
                else if (ev.type === "token") patchLast((m) => (m.final ? m : { ...m, text: m.text + ev.text }));
                else if (ev.type === "reset") patchLast((m) => ({ ...m, text: "" }));
                else if (ev.type === "final") patchLast((m) => ({ ...m, text: ev.reply, final: ev, streaming: false }));
                else if (ev.type === "error") patchLast((m) => ({ ...m, error: ev.message, streaming: false }));
            }, ac.signal);
        } catch (e) {
            if (!ac.signal.aborted && turn === turnRef.current) patchLast((m) => ({ ...m, error: e.message, streaming: false }));
        } finally {
            if (turn === turnRef.current) setBusy(false);
        }
    }, [apiBase, threadId]);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        turnRef.current++;
        setThreadId(null); store.set(null); setMessages([]); setBusy(false);
    }, []);

    return { threadId, messages, busy, send, reset, setMessages, setThreadId };
}
