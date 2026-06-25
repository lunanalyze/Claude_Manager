import fs from "node:fs";
import path from "node:path";

// repo 루트 = webui/ 의 상위 폴더. (next dev/build 는 webui/ 에서 실행)
export const REPO_ROOT = path.resolve(process.cwd(), "..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");
const TRANSCRIPTS_DIR = path.join(REPO_ROOT, "local", "transcripts");

// slug(=repo 루트 기준 상대경로 세그먼트) → 절대경로. 경로 이탈 방지.
export function resolveSlug(slugSegments) {
  const rel = slugSegments.map(decodeURIComponent).join("/");
  const abs = path.resolve(REPO_ROOT, rel);
  if (abs !== REPO_ROOT && !abs.startsWith(REPO_ROOT + path.sep)) return null;
  if (!abs.endsWith(".md")) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

function relSlug(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep);
}

function walkMd(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walkMd(full));
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}

function titleFromFile(absPath) {
  try {
    const txt = fs.readFileSync(absPath, "utf-8");
    const m = txt.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  return path.basename(absPath, ".md");
}

function toItem(absPath) {
  const slug = relSlug(absPath);
  return {
    title: titleFromFile(absPath),
    slug,
    href: "/view/" + slug.map(encodeURIComponent).join("/"),
    rel: slug.join("/"),
    mtime: fs.statSync(absPath).mtimeMs,
  };
}

// 사이드바용 그룹들. (이번 버전: WSL 로그만)
export function getSidebarGroups() {
  const docs = walkMd(DOCS_DIR)
    .map(toItem)
    .sort((a, b) => a.rel.localeCompare(b.rel));

  const transcripts = walkMd(TRANSCRIPTS_DIR)
    .map(toItem)
    .sort((a, b) => b.rel.localeCompare(a.rel)); // 최신(날짜 내림차순) 먼저

  return [
    { key: "docs", label: "문서 (docs)", items: docs },
    { key: "transcripts", label: "세션 로그 (WSL)", items: transcripts },
  ];
}

export function readDoc(slugSegments) {
  const abs = resolveSlug(slugSegments);
  if (!abs) return null;
  return {
    title: titleFromFile(abs),
    rel: path.relative(REPO_ROOT, abs),
    content: fs.readFileSync(abs, "utf-8"),
  };
}
