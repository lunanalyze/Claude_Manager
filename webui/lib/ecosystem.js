import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { REPO_ROOT } from "@/lib/content";

// 개발 생태계 시각화용 데이터 — 실제 git 상태·파일시스템에서 매번 새로 읽는다.
// (페이지는 force-dynamic → '새로고침'이 곧 최신 재스캔)

const WIN_CLONE = "/mnt/c/Users/JBB/Claude_Manager";
const WSL_CLAUDE_SKILLS = "/home/raspvery/.claude/skills";
const WIN_CLAUDE_SKILLS = "/mnt/c/Users/JBB/.claude/skills";

function git(cwd, args) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function countMd(dir, { recursive = false, skipReadme = false } = {}) {
  let n = 0;
  let names = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (recursive) { const r = countMd(full, { recursive, skipReadme }); n += r.count; }
      } else if (name.endsWith(".md")) {
        if (skipReadme && name.toLowerCase() === "readme.md") continue;
        n++; names.push(name);
      }
    }
  } catch {}
  return { count: n, names };
}

function skillsIn(dir) {
  const out = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let lst;
      try { lst = fs.lstatSync(full); } catch { continue; }
      if (lst.isSymbolicLink()) out.push({ name, method: "심링크" });
      else if (lst.isDirectory()) out.push({ name, method: "복사" });
    }
  } catch {}
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getEcosystem() {
  const repo = REPO_ROOT;

  const origin = git(repo, "remote get-url origin");
  const branch = git(repo, "rev-parse --abbrev-ref HEAD");
  const wslHead = git(repo, "rev-parse --short HEAD");
  const originHead = git(repo, "rev-parse --short origin/main");
  const commits = git(repo, "rev-list --count HEAD");
  const lastMsg = git(repo, "log -1 --pretty=%s");
  const lastDate = git(repo, "log -1 --pretty=%cd --date=short");

  const skillNames = (() => {
    try { return fs.readdirSync(path.join(repo, "skills")).filter((n) => !n.startsWith(".")); }
    catch { return []; }
  })();

  const content = {
    standards: countMd(path.join(repo, "docs", "standards"), { recursive: true }).count,
    references: countMd(path.join(repo, "docs", "references"), { skipReadme: true }).count,
    issues: countMd(path.join(repo, "docs", "issues"), { skipReadme: true }).count,
    skills: skillNames,
  };

  const winExists = fs.existsSync(WIN_CLONE);
  const winHead = winExists ? git(WIN_CLONE, "rev-parse --short HEAD") : null;

  const envs = [
    {
      key: "wsl",
      name: "WSL Ubuntu",
      icon: "🐧",
      clone: repo.replace("/home/raspvery", "~"),
      head: wslHead,
      claudeSkills: skillsIn(WSL_CLAUDE_SKILLS),
      webui: true,
      inSync: wslHead && originHead ? wslHead === originHead : null,
    },
    {
      key: "win",
      name: "Windows",
      icon: "🪟",
      clone: winExists ? "C:\\Users\\JBB\\Claude_Manager" : "(clone 없음)",
      head: winHead,
      claudeSkills: skillsIn(WIN_CLAUDE_SKILLS),
      webui: false,
      inSync: winHead && originHead ? winHead === originHead : null,
    },
  ];

  const originName = origin
    ? origin.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "")
    : null;

  return {
    hub: {
      provider: "GitHub",
      name: originName ?? "(원격 없음)",
      url: origin,
      branch: branch ?? "main",
      head: originHead ?? wslHead,
      commits: commits ? Number(commits) : null,
      lastMsg,
      lastDate,
    },
    content,
    envs,
    scannedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
}
