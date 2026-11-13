// SSE(POST) 스트림 읽기 — fetch + ReadableStream. EventSource 는 POST 를 못 보내므로 쓰지 않는다.
// 사용: await streamSSE(`${API}/api/chat`, { message, thread_id }, onEvent, abortController.signal)
// 한 청크에 이벤트가 여러 개 오거나, 이벤트가 청크 경계에서 잘려도 처리한다.

export async function streamSSE(url, body, onEvent, signal) {
    const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal,
    });
    if (!r.ok || !r.body) {
        // 스트림을 열기 전 오류(400/503)는 JSON detail 로 온다
        const detail = await r.json().then((j) => j.detail).catch(() => null);
        throw new Error(typeof detail === "string" ? detail : `요청 실패 (${r.status})`);
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let gotFinal = false;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            for (const line of block.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const ev = JSON.parse(line.slice(6));
                if (ev.type === "final" || ev.type === "error") gotFinal = true;
                onEvent(ev);
            }
        }
    }
    if (!gotFinal && !signal?.aborted) throw new Error("응답이 도중에 끊겼습니다.");
}
