"use client";

/**
 * 업데이트 배너 — React 변형. 상태 기계는 update-banner.html(바닐라)과 동일하다:
 *
 *     조회 → (있으면) 배너 → 확인 → 적용 → 서버 복귀 대기 → 새로고침
 *
 * 로직은 전부 update-client.js 에 있고 이 파일은 **그리기만** 한다. 다른 프레임워크로 옮길 때도
 * 옮길 것은 이 파일이지 로직이 아니다.
 *
 * 설계 의도(바닐라판과 같다)
 *  - 화면 맨 위 한 줄. 모달로 가로막지 않는다 — 하던 일을 끊으면 오히려 미루게 된다.
 *  - 누르기 전에 **무엇이 바뀌는지·얼마나 받는지**를 보여 준다.
 *  - '나중에'는 그 버전만 숨긴다(다음 버전엔 다시 뜬다).
 *  - 적용 중에는 닫을 수 없다. 교체 도중 창을 닫으면 무슨 일이 벌어졌는지 알 수 없다.
 *
 * 스타일은 프로젝트 토큰으로 바꿔 쓸 것 — 아래 className 은 예시다.
 */

import { useCallback, useEffect, useState } from "react";
import { checkForUpdate, formatSize, runUpdate } from "./update-client";

/** latest.json 의 모양 — references/latest-json.md 참조. */
interface LatestInfo {
  version: string;
  released_at?: string;
  notes?: string;
  restart_required?: boolean;
  pack?: { name?: string; url?: string; size?: number; sha256?: string };
}

const DISMISS_KEY = "update-dismissed";

export function UpdateBanner({
  owner,
  repo,
  healthEndpoint = "/health",
  applyEndpoint = "/api/update/apply",
}: {
  /** 사용자에게 받은 **public** repo. private 이면 설치된 앱이 읽지 못한다. */
  owner: string;
  repo: string;
  /** 계약 C1 — { version } 을 돌려주는 경로. */
  healthEndpoint?: string;
  /** 계약 C3 — 적용 요청 경로. */
  applyEndpoint?: string;
}) {
  const [latest, setLatest] = useState<LatestInfo | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 조회는 한 번만. 실패는 조용히 넘긴다(사내망·오프라인이 흔하다).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(healthEndpoint, { cache: "no-store" });
        const currentVersion = (await res.json())?.version ?? "";
        const r = await checkForUpdate({ currentVersion, owner, repo });
        if (alive && r.available && r.latest) setLatest(r.latest as LatestInfo);
      } catch {
        /* 앱과 대화가 안 되면 업데이트 얘기를 꺼낼 때가 아니다 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [owner, repo, healthEndpoint]);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY));
    } catch {
      /* 프라이빗 창 등 — 없으면 매번 보여 준다 */
    }
  }, []);

  const apply = useCallback(async () => {
    setApplying(true);
    setError(null);
    try {
      await runUpdate({ applyEndpoint, healthEndpoint, onPhase: setPhase });
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setPhase("");
      setError((e as Error).message);
      setApplying(false); // 다시 시도할 수 있게 되돌린다
    }
  }, [applyEndpoint, healthEndpoint]);

  const later = () => {
    if (!latest) return;
    try {
      localStorage.setItem(DISMISS_KEY, latest.version);
    } catch {
      /* ignore */
    }
    setDismissed(latest.version);
  };

  // 적용 중이면 배너 조건과 무관하게 계속 보여 준다 — 진행을 숨기면 안 된다.
  if (!latest || (!applying && dismissed === latest.version)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 border-b border-border bg-brand-soft px-4 py-2.5 text-t6"
    >
      <span className="font-semibold">새 버전 {latest.version} 이 있습니다</span>

      <span className="text-muted">
        {[
          latest.notes,
          formatSize(latest.pack?.size),
          latest.restart_required ? "적용 시 앱이 자동으로 재시작됩니다" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>

      <span className="ml-auto flex items-center gap-2">
        {phase && <span className="text-brand">{phase}</span>}
        {error && <span className="text-danger">{error}</span>}

        {!applying && (
          <button type="button" onClick={later} className="rounded-md px-3 py-1.5">
            나중에
          </button>
        )}
        <button
          type="button"
          onClick={apply}
          disabled={applying}
          className="rounded-md bg-brand px-3.5 py-1.5 font-semibold text-white disabled:opacity-55"
        >
          {applying ? "적용 중…" : "업데이트"}
        </button>
      </span>
    </div>
  );
}
