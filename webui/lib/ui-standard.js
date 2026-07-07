import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "@/lib/content";
import { UI_ELEMENTS, UI_GROUPS, defaultSelections, candidateName } from "@/lib/ui-elements";

export { UI_ELEMENTS, UI_GROUPS, defaultSelections, candidateName };

// 확정된 선택의 단일 원본 (표준 그 자체). git 추적.
const SELECTIONS_PATH = path.join(REPO_ROOT, "docs", "standards", "ui", "selections.json");

export function readSelections() {
  try {
    const raw = fs.readFileSync(SELECTIONS_PATH, "utf-8");
    const saved = JSON.parse(raw);
    // 유효성: 존재하는 요소/후보만 남긴다.
    const out = {};
    for (const el of UI_ELEMENTS) {
      const v = saved[el.id];
      if (v && el.candidates.some((c) => c.id === v)) out[el.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeSelection(elementId, candidateId) {
  const el = UI_ELEMENTS.find((e) => e.id === elementId);
  if (!el) throw new Error("unknown element: " + elementId);
  if (!el.candidates.some((c) => c.id === candidateId))
    throw new Error("unknown candidate: " + candidateId);
  const cur = readSelections();
  cur[elementId] = candidateId;
  fs.mkdirSync(path.dirname(SELECTIONS_PATH), { recursive: true });
  fs.writeFileSync(SELECTIONS_PATH, JSON.stringify(cur, null, 2) + "\n", "utf-8");
  return cur;
}

// 선택 + 기본값 병합 (조립 페이지가 항상 렌더되도록)
export function resolvedSelections() {
  return { ...defaultSelections(), ...readSelections() };
}

export function selectionStatus() {
  const saved = readSelections();
  return { total: UI_ELEMENTS.length, confirmed: Object.keys(saved).length, saved };
}
