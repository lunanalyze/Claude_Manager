import { getSidebarGroups } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function Home() {
  const groups = getSidebarGroups();
  const counts = Object.fromEntries(groups.map((g) => [g.key, g.items.length]));
  return (
    <div className="md">
      <h1>Claude_Manager 대시보드</h1>
      <p>좌측에서 문서나 세션 로그를 선택하세요. 이 대시보드는 <strong>읽기 전용</strong>이며,
        repo의 <code>docs/</code>와 <code>local/transcripts/</code>를 직접 읽어 렌더링합니다.</p>
      <h2>현재 항목</h2>
      <ul>
        <li>문서(docs): <strong>{counts.docs ?? 0}</strong>개</li>
        <li>세션 로그(WSL): <strong>{counts.transcripts ?? 0}</strong>개</li>
      </ul>
      <p style={{ color: "var(--muted)", fontSize: "13px" }}>
        세션 로그는 <code>transcript-to-md</code> skill로 변환된 markdown입니다.
        Windows 로그 연동은 구축 순서 4단계에서 추가됩니다.
      </p>
    </div>
  );
}
