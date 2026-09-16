/**
 * 업데이트 조회·적용 코어 — 프레임워크 없음. 순수 fetch 라 어떤 프런트에도 붙는다.
 *
 * 이 파일이 하는 일은 셋뿐이다.
 *   1) latest.json 을 읽어 내 버전과 비교한다      checkForUpdate()
 *   2) 앱에 "적용해라"를 요청한다                   applyUpdate()
 *   3) 앱이 다시 뜰 때까지 기다린다                 waitForServer()
 *
 * 화면(배너)은 이 셋을 순서대로 부르기만 한다 — update-banner.html / UpdateBanner.tsx 참고.
 *
 * ── 두 가지 배치 방식 ───────────────────────────────────────────────────────
 *  (a) 브라우저가 GitHub 을 직접 조회      : CORS 가 열려 있어야 한다(raw 파일은 대개 열려 있다)
 *  (b) 앱 서버가 대신 조회해 결과만 내려줌 : 사내망 프록시·차단 대응이 쉽고 화면이 단순해진다
 * 아래 checkForUpdate 는 (a)를 기본으로 하고, endpoint 를 주면 (b)로 동작한다.
 */

/** 버전 비교 — "1.4.10" > "1.4.9" 가 되도록 숫자 세그먼트로 가른다. */
export function isNewer(latest, current) {
  if (!latest || !current) return false;
  const seg = (v) => String(v).split(/[.\-+]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const a = seg(latest);
  const b = seg(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x > y;
    return String(x) > String(y); // 프리릴리스 태그 등은 문자열 비교로 떨어뜨린다
  }
  return false;
}

/**
 * 새 버전이 있는지 본다.
 *
 * @param {object}  opts
 * @param {string}  opts.currentVersion  지금 실행 중인 버전(계약 C1 로 받아 둔 값)
 * @param {string} [opts.owner]          GitHub owner (직접 조회 방식)
 * @param {string} [opts.repo]           GitHub repo  (직접 조회 방식)
 * @param {string} [opts.endpoint]       앱 서버가 대신 조회하는 경로(예: "/api/update/check")
 * @param {number} [opts.timeoutMs=8000]
 * @returns {Promise<{available:boolean, latest?:object, note?:string}>}
 *
 * <b>실패는 조용히 넘긴다.</b> 사내망·오프라인이 흔하다 — 첫 화면에 오류를 띄우면 업데이트와
 * 무관한 사람까지 앱이 고장난 줄 안다. available:false 로 돌려주고 note 에만 사유를 남긴다.
 */
export async function checkForUpdate(opts) {
  const { currentVersion, owner, repo, endpoint, timeoutMs = 8000 } = opts;
  const url = endpoint
    ? endpoint
    : `https://github.com/${owner}/${repo}/releases/latest/download/latest.json`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctl.signal });
    if (!res.ok) return { available: false, note: `조회 실패 ${res.status}` };
    const latest = await res.json();
    // 서버 경유 방식이면 서버가 이미 판단해 줄 수도 있다.
    if (typeof latest.available === "boolean") return latest;
    return {
      available: isNewer(latest.version, currentVersion),
      latest,
    };
  } catch (e) {
    return { available: false, note: e?.name === "AbortError" ? "조회 시간 초과" : "조회할 수 없음" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 적용 요청 — 앱이 업데이터를 띄우고 스스로 종료한다(계약 C3).
 *
 * 이 호출은 <b>성공해도 곧 연결이 끊긴다.</b> 응답을 받은 직후 서버가 죽는 게 정상이다.
 * 그래서 여기서는 "요청이 받아들여졌는가"까지만 본다.
 */
export async function applyUpdate(endpoint = "/api/update/apply") {
  const res = await fetch(endpoint, { method: "POST", cache: "no-store" });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const d = await res.json();
      if (d?.message || d?.detail) detail = d.message ?? d.detail;
    } catch {
      /* 본문이 없을 수 있다 */
    }
    throw new Error(detail);
  }
  return res.json().catch(() => ({}));
}

/**
 * 앱이 다시 뜰 때까지 기다린다 — 돌아온 버전을 돌려준다(못 뜨면 null).
 *
 * 교체 + 재기동 + 초기화까지 수십 초가 걸린다. 넉넉히 기다리되 무한대기는 하지 않는다.
 * 실패로 끝나면 화면은 "이전 버전으로 되돌렸을 수 있다"고 안내해야 한다 — 업데이터가 롤백하기
 * 때문에 대개 앱은 살아 있다.
 */
export async function waitForServer({ endpoint = "/health", timeoutMs = 180000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        return j.version ?? "";
      }
    } catch {
      /* 아직 안 떴을 뿐 */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/** 바이트 → "68MB". 배너에서 무엇을 받는지 크기로 가늠하게 한다. */
export function formatSize(bytes) {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
}

/**
 * 조회 → 적용 → 복귀 대기 → 새로고침 을 한 번에.
 *
 * 화면이 단계별 문구만 그리면 되도록 진행을 콜백으로 준다.
 * 중간에 실패하면 throw 하므로 호출부가 사유를 그대로 보여 주면 된다.
 *
 * 인자 타입을 JSDoc 으로 적어 둔 이유: TypeScript 프로젝트가 이 .js 를 그대로 import 할 때,
 * 타입이 없으면 기본값이 붙은 프로퍼티만 추론돼 `applyEndpoint` 같은 옵션이 **타입 오류**로
 * 거부된다(실제로 TSX 쪽에서 TS2353 이 났다).
 *
 * @param {object}   [opts]
 * @param {(phase:string)=>void} [opts.onPhase]        진행 문구 콜백
 * @param {string}   [opts.applyEndpoint]              적용 요청 경로
 * @param {string}   [opts.healthEndpoint]             복귀 확인 경로
 * @param {boolean}  [opts.reload=true]                끝나고 화면을 새로 불러올지
 * @returns {Promise<string>} 돌아온 버전
 */
export async function runUpdate({ onPhase, applyEndpoint, healthEndpoint, reload = true } = {}) {
  onPhase?.("업데이트 파일을 받고 검증하는 중… (수십 초)");
  await applyUpdate(applyEndpoint);

  onPhase?.("앱을 다시 시작하는 중… 창을 닫지 마세요.");
  const version = await waitForServer({ endpoint: healthEndpoint });
  if (version === null) {
    throw new Error("앱이 다시 뜨지 않았습니다. 이전 버전으로 되돌렸을 수 있습니다 — 시작 메뉴에서 다시 실행해 주세요.");
  }

  onPhase?.(`업데이트 완료 (${version}) — 화면을 새로 불러옵니다.`);
  if (reload) setTimeout(() => window.location.reload(), 1200);
  return version;
}
