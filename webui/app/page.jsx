import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const SHARE_BADGE = {
  git: { label: "공유", cls: "b-git", title: "git 단일 원본 — 양쪽 환경이 clone 해 읽음" },
  env: { label: "환경전용", cls: "b-env", title: "이 환경에만 적용 — git 공유 안 함" },
  gen: { label: "생성물", cls: "b-gen", title: "로컬 생성 로그 — git 미포함" },
};

function fmtTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Card({ sp }) {
  const badge = SHARE_BADGE[sp.share] ?? SHARE_BADGE.env;
  const meta = sp.exists
    ? sp.kind === "dir"
      ? `${sp.count ?? 0}개 항목`
      : `${sp.size ?? 0} B`
    : "없음";
  const inner = (
    <>
      <div className="ct-head">
        <span className="ct-icon">{sp.icon}</span>
        <span className="ct-title">{sp.title}</span>
        <span className={`ct-badge ${badge.cls}`} title={badge.title}>{badge.label}</span>
      </div>
      <p className="ct-desc">{sp.desc}</p>
      <div className="ct-foot">
        <code className="ct-path">{sp.rootPath.replace("/home/raspvery", "~").replace("/mnt/c/Users/JBB", "C:…")}/{sp.rel}</code>
        <span className={`ct-status ${sp.exists ? "on" : "off"}`}>
          {sp.exists ? "●" : "○"} {meta}
          {sp.isSymlink ? " · 심링크" : ""}
          {sp.exists && sp.mtime ? ` · ${fmtTime(sp.mtime)}` : ""}
        </span>
      </div>
    </>
  );
  return sp.exists ? (
    <a className="ct-card" href={sp.href}>{inner}</a>
  ) : (
    <div className="ct-card is-empty">{inner}</div>
  );
}

export default function Home() {
  const catalog = getCatalog();
  const total = catalog.reduce((n, g) => n + g.spaces.length, 0);
  const live = catalog.reduce((n, g) => n + g.spaces.filter((s) => s.exists).length, 0);

  return (
    <div className="tower">
      <header className="tower-hero">
        <h1>관제탑</h1>
        <p>
          Claude의 동작을 제어·관리하는 <strong>모든 파일 공간</strong>을 한곳에서 조망합니다.
          <strong> WSL</strong>과 <strong>Windows</strong>는 별개 환경으로 각각 관리하고, 공유 콘텐츠만
          git 단일 원본으로 둡니다. 카드를 눌러 실제 파일을 열람하세요 <em>(읽기 전용)</em>.
        </p>
        <div className="tower-stats">
          <span><b>{live}</b>/{total} 공간 활성</span>
          <span className="dot" />
          <a href="/ui-standard">🎛️ UI 표준 워크숍</a>
        </div>
      </header>

      {catalog.map((g) => (
        <section className="tower-group" key={g.key}>
          <div className="tg-head">
            <h2>{g.label}</h2>
            <p>{g.note}</p>
          </div>
          <div className="ct-grid">
            {g.spaces.map((sp) => (
              <Card sp={sp} key={sp.root + "/" + sp.rel} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
