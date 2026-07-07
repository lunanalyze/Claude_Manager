import fs from "node:fs";
import path from "node:path";

/**
 * 제어·관리 가능한 Claude 파일 지형(카탈로그).
 * WSL과 Windows는 별개 환경으로 각각 관리한다(원칙 1·2).
 * 공유 콘텐츠(git 단일 원본)만 repo에 있고, 배선/설정은 환경별로 분리된다.
 */

// 다중 루트. browse 라우트의 첫 세그먼트가 이 키.
export const ROOTS = {
  repo: "/home/raspvery/Claude_Manager",
  wsl: "/home/raspvery/.claude",
  win: "/mnt/c/Users/JBB/.claude",
};

// 절대 노출 금지 파일(비밀·개인정보). 이름 기준.
const SENSITIVE_NAMES = new Set([
  ".credentials.json",
  "history.jsonl",
  ".last-update-result.json",
  "remote-settings.json",
]);
const SENSITIVE_PAT = /credential|secret|token|\.env|\.pem|\.key$/i;
// 원본 로그(JSONL)는 너무 크고 민감하므로 raw 노출 대신 변환본만 본다.
const HIDDEN_EXT = new Set([".jsonl"]);

function isSensitive(name) {
  const low = name.toLowerCase();
  return SENSITIVE_NAMES.has(low) || SENSITIVE_PAT.test(low);
}

// 코드로 렌더 가능한 확장자 → 하이라이트 언어 힌트
export const CODE_LANGS = {
  ".json": "json", ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "tsx", ".jsx": "jsx", ".py": "python",
  ".sh": "bash", ".bash": "bash", ".css": "css", ".html": "html",
  ".toml": "toml", ".yaml": "yaml", ".yml": "yaml", ".txt": "text", ".md": "markdown",
};

// ── 안전 리졸버 ─────────────────────────────────────────────
// 카탈로그에 선언된 공간(및 그 하위)로만 열람을 제한한다.
// ~/.claude 의 런타임 내부(telemetry·sessions·shell-snapshots 등)는 노출하지 않는다.
function allowedSubtrees(rootKey) {
  const base = ROOTS[rootKey];
  const rels = [];
  for (const g of GROUPS) {
    for (const sp of g.spaces) {
      if (sp.root === rootKey) rels.push(path.join(base, sp.rel));
    }
  }
  return rels;
}

function isAllowed(rootKey, abs) {
  const base = ROOTS[rootKey];
  if (abs === base) return true; // 루트는 큐레이션된 공간 인덱스로 렌더
  return allowedSubtrees(rootKey).some(
    (t) => abs === t || abs.startsWith(t + path.sep)
  );
}

// parts[0] = rootKey, 나머지 = 루트 기준 상대경로 세그먼트
export function resolveBrowse(parts) {
  if (!parts || parts.length === 0) return null;
  const [rootKey, ...rest] = parts;
  const base = ROOTS[rootKey];
  if (!base) return null;
  const rel = rest.map(decodeURIComponent).join("/");
  const abs = path.resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null; // 경로 이탈 차단
  if (isSensitive(path.basename(abs))) return null;
  if (!isAllowed(rootKey, abs)) return null; // 카탈로그 공간 밖 차단
  if (!fs.existsSync(abs)) return null;
  return { rootKey, base, rel, abs, isRoot: abs === base };
}

// 특정 환경(root)의 공간들만 스캔해서 반환 (환경 루트 인덱스용)
export function spacesForRoot(rootKey) {
  const out = [];
  for (const g of GROUPS) {
    for (const sp of g.spaces) {
      if (sp.root === rootKey) out.push(scanSpace(sp));
    }
  }
  return out;
}

export function browseHref(rootKey, rel) {
  const segs = rel ? rel.split("/") : [];
  return "/browse/" + [rootKey, ...segs].map(encodeURIComponent).join("/");
}

// 디렉터리 1-depth 목록(민감/숨김 제외)
export function listDir(abs, rootKey, base) {
  const entries = [];
  for (const name of fs.readdirSync(abs)) {
    if (name.startsWith(".") && name !== ".gitignore") continue;
    if (isSensitive(name)) continue;
    const full = path.join(abs, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    const isDir = st.isDirectory();
    if (!isDir && HIDDEN_EXT.has(path.extname(name).toLowerCase())) continue;
    entries.push({
      name,
      isDir,
      size: isDir ? null : st.size,
      mtime: st.mtimeMs,
      href: browseHref(rootKey, path.relative(base, full)),
    });
  }
  entries.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
  );
  return entries;
}

export function readFileSafe(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (HIDDEN_EXT.has(ext)) return null;
  const st = fs.statSync(abs);
  if (st.size > 1_500_000) return { tooBig: true, size: st.size, ext };
  return { content: fs.readFileSync(abs, "utf-8"), ext, size: st.size };
}

// ── 카탈로그(공간 정의) ─────────────────────────────────────
// share: "git"(공유 단일원본) | "env"(환경 전용, 미공유) | "gen"(생성물, git 미포함)
// kind: "dir" | "file"

const SHARED_SPACES = [
  { root: "repo", rel: "docs/standards", kind: "dir", icon: "📐", title: "표준 문서", share: "git",
    desc: "기술 스택·UI 등 모든 프로젝트가 따르는 공유 표준. 각 환경 CLAUDE.md가 @import 해 컨텍스트에 싣는다." },
  { root: "repo", rel: "docs/references", kind: "dir", icon: "📎", title: "참고자료", share: "git",
    desc: "CLAUDE.md에 링크로 거는 참고 문서(UI 참고 등). 무거운 자료는 @import 대신 링크로 걸어 컨텍스트를 아낀다." },
  { root: "repo", rel: "docs/issues", kind: "dir", icon: "🐛", title: "이슈 로그", share: "git",
    desc: "한 번에 안 되어 검증했거나 실패 후 해결한 사례를 한 건당 한 파일로 누적. 다음 세션이 같은 벽을 피하도록 재활용한다(/issue-log)." },
  { root: "repo", rel: "skills", kind: "dir", icon: "🧩", title: "Skills (원본)", share: "git",
    desc: "skill 소스의 단일 원본. 각 환경 ~/.claude/skills 가 이곳을 심링크/복사해 설치한다." },
  { root: "repo", rel: "CLAUDE.md", kind: "file", icon: "📖", title: "프로젝트 지침", share: "git",
    desc: "Claude_Manager 자체의 운영 지침 — 설계 원칙·구축 순서·검증된 스펙." },
];

// 환경 전용 공간 템플릿(WSL/Windows 공통 모양)
function envSpaces(root) {
  return [
    { root, rel: "CLAUDE.md", kind: "file", icon: "🧭", title: "전역 지침 (CLAUDE.md)", share: "env",
      desc: "이 환경의 모든 세션에 항상 실리는 전역 지침. 보통 공유 표준을 @import 만 한다(원본 복제 금지)." },
    { root, rel: "settings.json", kind: "file", icon: "⚙️", title: "설정 (settings.json)", share: "env",
      desc: "hook 배선·권한(permissions)·환경변수·모델·테마. 원칙 1 — 배선은 환경별로 분리하며 git 공유 금지." },
    { root, rel: "settings.local.json", kind: "file", icon: "🔒", title: "로컬 설정", share: "env",
      desc: "개인/비밀 오버라이드용 로컬 설정. 커밋하지 않는다." },
    { root, rel: "keybindings.json", kind: "file", icon: "⌨️", title: "키 바인딩", share: "env",
      desc: "단축키 커스텀. 이 환경에만 적용된다." },
    { root, rel: "skills", kind: "dir", icon: "🧩", title: "Skills (설치)", share: "env",
      desc: "이 환경에 설치된 skill. 원본은 repo이며 여기서는 심링크/복사로 연결한다." },
    { root, rel: "commands", kind: "dir", icon: "⌘", title: "Custom Commands", share: "env",
      desc: "사용자 정의 슬래시 명령(/name). 자주 쓰는 지시를 명령으로 굳혀 재사용한다." },
    { root, rel: "agents", kind: "dir", icon: "🤖", title: "Subagents", share: "env",
      desc: "사용자 정의 서브에이전트. 특정 역할(리뷰어 등)을 별도 에이전트로 정의." },
    { root, rel: "output-styles", kind: "dir", icon: "🎭", title: "Output Styles", share: "env",
      desc: "응답 출력 스타일(말투·형식) 프리셋." },
    { root, rel: "plugins", kind: "dir", icon: "🔌", title: "Plugins", share: "env",
      desc: "설치된 플러그인·마켓플레이스 등록 정보." },
    { root, rel: "projects", kind: "dir", icon: "🗂️", title: "세션 원본 (projects)", share: "gen",
      desc: "세션 transcript 원본(JSONL)과 메모리가 프로젝트 slug별로 쌓이는 곳. 원본 JSONL은 뷰어에서 가린다." },
  ];
}

// 그룹 정의(순서 = 화면 순서)
const GROUPS = [
  { key: "shared", label: "공유 콘텐츠 (git 단일 원본)",
    note: "WSL·Windows가 각자 clone 해 읽는다. 콘텐츠만 공유하고 배선은 공유하지 않는다(원칙 1·2).",
    spaces: SHARED_SPACES },
  { key: "wsl", label: "WSL 환경 (~/.claude)",
    note: "현재 이 환경. 설정·배선은 이 환경에만 적용된다.",
    spaces: envSpaces("wsl") },
  { key: "win", label: "Windows 환경 (/mnt/c/Users/JBB/.claude)",
    note: "Windows 네이티브 Claude Code. WSL에서 마운트로 열람하되 별개 환경으로 관리한다.",
    spaces: envSpaces("win") },
  { key: "gen", label: "생성물 (git 미포함)",
    note: "각 환경 로컬에 쌓이는 변환 로그. WebUI가 읽어 보여준다(원칙 4).",
    spaces: [
      { root: "repo", rel: "local/transcripts", kind: "dir", icon: "📜", title: "세션 로그 (변환·WSL)", share: "gen",
        desc: "transcript-to-md skill로 변환된 읽기 좋은 세션 기록. Windows 변환분은 4단계에서 추가된다." },
    ] },
];

// 파일시스템 스캔으로 각 공간 상태 계산
function scanSpace(sp) {
  const base = ROOTS[sp.root];
  const abs = path.join(base, sp.rel);
  const out = { ...sp, rootPath: base, absPath: abs, href: browseHref(sp.root, sp.rel),
    exists: false, count: null, mtime: null, isSymlink: false };
  try {
    const lst = fs.lstatSync(abs);
    out.exists = true;
    out.isSymlink = lst.isSymbolicLink();
    const st = fs.statSync(abs); // 심링크 따라감
    out.mtime = st.mtimeMs;
    if (sp.kind === "dir" && st.isDirectory()) {
      out.count = fs.readdirSync(abs).filter(
        (n) => !n.startsWith(".") && !isSensitive(n) && !HIDDEN_EXT.has(path.extname(n).toLowerCase())
      ).length;
    } else if (sp.kind === "file") {
      out.size = st.size;
    }
  } catch { /* 없음 */ }
  return out;
}

export function getCatalog() {
  return GROUPS.map((g) => ({
    ...g,
    spaces: g.spaces.map(scanSpace),
  }));
}

// browse 페이지 상단에 보여줄 공간 설명(경로 일치 시)
export function findSpace(rootKey, rel) {
  for (const g of GROUPS) {
    for (const sp of g.spaces) {
      if (sp.root === rootKey && sp.rel === rel) return sp;
    }
  }
  return null;
}
