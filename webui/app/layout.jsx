import "./globals.css";
import { getSidebarGroups } from "@/lib/content";

export const metadata = {
  title: "Claude_Manager",
  description: "읽기 전용 대시보드 — docs + 세션 로그",
};

// 로컬 파일을 매 요청마다 다시 읽도록 (캐시 끔)
export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  const groups = getSidebarGroups();
  return (
    <html lang="ko">
      <body>
        <div className="layout">
          <nav className="sidebar">
            <h1><a href="/">Claude_Manager</a></h1>
            <div className="sub">읽기 전용 대시보드</div>
            <div className="group">
              <div className="label">관제</div>
              <ul>
                <li><a href="/">🗼 관제탑 (전체 지형)</a></li>
                <li><a href="/ui-preview">🎨 UI 표준 미리보기</a></li>
              </ul>
            </div>
            <div className="group">
              <div className="label">환경</div>
              <ul>
                <li><a href="/browse/wsl">🐧 WSL ~/.claude</a></li>
                <li><a href="/browse/win">🪟 Windows .claude</a></li>
              </ul>
            </div>
            {groups.map((g) => (
              <div className="group" key={g.key}>
                <div className="label">{g.label}</div>
                {g.items.length === 0 ? (
                  <div className="empty">(없음)</div>
                ) : (
                  <ul>
                    {g.items.map((it) => (
                      <li key={it.rel}>
                        <a href={it.href} title={it.rel}>{it.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
