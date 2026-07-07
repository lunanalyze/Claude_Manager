"use client";
import { useEffect, useState } from "react";

// 라이트/다크 토글. 선택은 localStorage('cm-theme')에 저장하고
// <html data-theme> 로 반영한다(FOUC 방지 스크립트는 layout <head> 에 있음).
export default function ThemeToggle() {
  const [theme, setTheme] = useState(null); // null = 아직 미확정(하이드레이션 일치용)

  useEffect(() => {
    const stored = localStorage.getItem("cm-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  function apply(next) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("cm-theme", next); } catch {}
  }

  // 초기(서버/클라 공통) 렌더는 라벨 없는 자리표시자 → 하이드레이션 불일치 방지
  if (theme === null) {
    return <button className="theme-toggle" aria-hidden="true" tabIndex={-1} />;
  }

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="theme-toggle"
      onClick={() => apply(next)}
      title={`${next === "dark" ? "다크" : "라이트"} 모드로 전환`}
      aria-label={`${next === "dark" ? "다크" : "라이트"} 모드로 전환`}
    >
      {theme === "dark" ? "☀️ 라이트" : "🌙 다크"}
    </button>
  );
}
