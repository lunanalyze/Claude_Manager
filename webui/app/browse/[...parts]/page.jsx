import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ROOTS, resolveBrowse, listDir, readFileSafe, browseHref, findSpace, spacesForRoot, CODE_LANGS } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function prettyRoot(rootKey) {
  return { repo: "Claude_Manager", wsl: "WSL ~/.claude", win: "Windows .claude" }[rootKey] ?? rootKey;
}

// 상단 경로 브레드크럼(각 세그먼트 클릭 가능)
function Crumb({ rootKey, rel }) {
  const segs = rel ? rel.split("/") : [];
  const parts = [];
  let acc = "";
  parts.push({ label: prettyRoot(rootKey), href: browseHref(rootKey, "") });
  for (const s of segs) {
    acc = acc ? `${acc}/${s}` : s;
    parts.push({ label: s, href: browseHref(rootKey, acc) });
  }
  return (
    <div className="crumb">
      {parts.map((p, i) => (
        <span key={p.href}>
          {i > 0 && <span className="sep"> / </span>}
          {i === parts.length - 1 ? <span>{p.label}</span> : <a href={p.href}>{p.label}</a>}
        </span>
      ))}
    </div>
  );
}

function fmt(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function BrowsePage({ params }) {
  const { parts } = await params;
  const r = resolveBrowse(parts);
  if (!r) notFound();

  const st = fs.statSync(r.abs);
  const space = findSpace(r.rootKey, r.rel);

  // 환경 루트: 런타임 내부 대신 큐레이션된 공간 인덱스를 보여준다.
  if (r.isRoot) {
    return (
      <article>
        <Crumb rootKey={r.rootKey} rel={r.rel} />
        <EnvIndex rootKey={r.rootKey} />
      </article>
    );
  }

  return (
    <article>
      <Crumb rootKey={r.rootKey} rel={r.rel} />
      {space && (
        <div className="space-note">
          <div className="sn-title">{space.icon} {space.title}</div>
          <p>{space.desc}</p>
        </div>
      )}

      {st.isDirectory() ? (
        <DirView r={r} />
      ) : (
        <FileView abs={r.abs} />
      )}
    </article>
  );
}

function EnvIndex({ rootKey }) {
  const spaces = spacesForRoot(rootKey);
  return (
    <div className="dirview">
      <h1 className="dv-title">{prettyRoot(rootKey)} <span className="dv-count">관리 공간 {spaces.length}개</span></h1>
      <p className="space-note" style={{ borderLeftColor: "var(--muted)" }}>
        이 환경에서 제어·관리하는 공간만 큐레이션해 보여줍니다. (런타임 내부 폴더는 노출하지 않음)
      </p>
      <ul className="dv-list">
        {spaces.map((sp) => (
          <li key={sp.rel}>
            {sp.exists ? (
              <a href={sp.href}>
                <span className="dv-ico">{sp.icon}</span>
                <span className="dv-name">{sp.title}
                  <span className="dv-sub"> — {sp.desc}</span>
                </span>
                <span className="dv-meta">{sp.kind === "dir" ? `${sp.count ?? 0}개` : "파일"}</span>
              </a>
            ) : (
              <span className="dv-off">
                <span className="dv-ico">{sp.icon}</span>
                <span className="dv-name">{sp.title}<span className="dv-sub"> — {sp.desc}</span></span>
                <span className="dv-meta">없음</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DirView({ r }) {
  const entries = listDir(r.abs, r.rootKey, r.base);
  return (
    <div className="dirview">
      <h1 className="dv-title">{r.rel ? path.basename(r.abs) : prettyRoot(r.rootKey)} <span className="dv-count">{entries.length}개</span></h1>
      {entries.length === 0 ? (
        <div className="dv-empty">빈 공간입니다. (아직 파일이 없습니다)</div>
      ) : (
        <ul className="dv-list">
          {entries.map((e) => (
            <li key={e.href}>
              <a href={e.href}>
                <span className="dv-ico">{e.isDir ? "📁" : "📄"}</span>
                <span className="dv-name">{e.name}</span>
                <span className="dv-meta">
                  {e.isDir ? "" : `${e.size} B · `}{fmt(e.mtime)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileView({ abs }) {
  const file = readFileSafe(abs);
  if (!file) notFound();
  if (file.tooBig) {
    return <div className="dv-empty">파일이 너무 큽니다({Math.round(file.size / 1024)} KB). 뷰어에서 생략합니다.</div>;
  }
  if (file.ext === ".md") {
    return (
      <div className="md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {file.content}
        </ReactMarkdown>
      </div>
    );
  }
  const lang = CODE_LANGS[file.ext] ?? "text";
  return (
    <div className="md">
      <pre><code className={`language-${lang}`}>{file.content}</code></pre>
    </div>
  );
}
