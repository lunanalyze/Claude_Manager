"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

// 서버 컴포넌트를 다시 실행시켜 실제 git/파일 상태를 재스캔한다(= 최신으로 갱신).
export default function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="eco-refresh"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      title="실제 git·파일 상태를 다시 읽어 갱신"
      aria-label="새로고침"
    >
      <span className={`eco-refresh-ico ${pending ? "spin" : ""}`}>⟳</span>
      {pending ? "갱신 중…" : "새로고침"}
    </button>
  );
}
