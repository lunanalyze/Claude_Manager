import "./globals.css";
import { getSidebarGroups } from "@/lib/content";
import { resolvedSelections } from "@/lib/ui-standard";
import { standardStyle, bodyClass, bodyData } from "@/lib/standard-tokens";
import ThemeToggle from "./ThemeToggle";

export const metadata = {
  title: "Claude_Manager",
  description: "읽기 전용 대시보드 — docs + 세션 로그",
};

// 로컬 파일을 매 요청마다 다시 읽도록 (캐시 끔)
export const dynamic = "force-dynamic";

// 페인트 전에 저장된 테마를 적용해 깜빡임(FOUC) 방지
const THEME_INIT = `(function(){try{var t=localStorage.getItem('cm-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }) {
  const groups = getSidebarGroups();
  const sel = resolvedSelections(); // 워크숍에서 고른 UI 표준
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* 선택된 표준(테마·반경)을 대시보드 토큰으로 주입 */}
        <style dangerouslySetInnerHTML={{ __html: standardStyle(sel) }} />
      </head>
      <body className={bodyClass(sel)} {...bodyData(sel)}>
        <div className="layout">
          <nav className="sidebar">
            <h1><a href="/">Claude_Manager</a></h1>
            <div className="sub">읽기 전용 대시보드</div>
            <ThemeToggle />
            <div className="group">
              <div className="label">관제</div>
              <ul>
                <li><a href="/">🗼 관제탑 (전체 지형)</a></li>
                <li><a href="/ui-standard">🎛️ UI 표준 워크숍</a></li>
                <li><a href="/ui-standard/result">🧩 조립된 표준 페이지</a></li>
                <li><a href="/ui-standard/showcase">🖼️ 요소 쇼케이스</a></li>
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
