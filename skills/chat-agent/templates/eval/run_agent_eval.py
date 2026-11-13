"""Agent 평가 실행기 — 실제 LLM 을 호출한다(비용·시간 발생).

  python eval/run_agent_eval.py [--only D01,Q01] [--model 모델명] [--hold]

지표: data_reached_pct(데이터 도달률) ≥ 90% 이고 clarify 문항 전부 통과면 pass.
참고 지표: 미확인 숫자 수, 문항당 도구 호출 수, 평균 시간, 오류 수.
한 문항이 실패해도 멈추지 않는다 — 오류는 traceback·실패 턴·그 턴의 도구 인자까지 남긴다
(기록이 없으면 원인 추적이 불가능했다).
결과: data/eval/agent_eval_<모델>_<시각>.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from agent import prompts  # noqa: E402
from agent.llm import OllamaLLM  # noqa: E402
from agent.loop import run_turn  # noqa: E402

DOMAIN = "OO"   # chat_api.DOMAIN 과 맞춘다


def _key_hit(call: dict, key) -> bool:
    if key is None:
        return True
    vals = json.dumps(call.get("args", {}), ensure_ascii=False)
    return str(key) in vals


def _cond_hit(calls, cond) -> bool:
    if "all_of" in cond:
        return all(_cond_hit(calls, c) for c in cond["all_of"])
    if "any_of" in cond:
        return any(_cond_hit(calls, c) for c in cond["any_of"])
    return any(c["ok"] and c["tool"] == cond["tool"] and _key_hit(c, cond.get("key")) for c in calls)


def run_item(llm, item) -> dict:
    exp, calls, history, rec = item["expect"], [], [], {"id": item["id"], "cat": item.get("cat")}
    t0 = time.time()
    asked_first = None
    try:
        for i, q in enumerate(item["turns"]):
            if i > 0 and rec.get("last_status") != "asked":
                break
            r = run_turn(llm, q, system=prompts.agent_system(DOMAIN), history=history)
            if asked_first is None:
                asked_first = r["status"] == "asked"
            calls += r["tools"]
            rec.update(last_status=r["status"], unverified=rec.get("unverified", 0) + len(r["unverified"]))
            history += [{"role": "user", "content": q}, {"role": "assistant", "content": r["reply"]}]
        rec["reached"] = _cond_hit(calls, exp)
        rec["clarify_ok"] = (asked_first is True) if exp.get("clarify_first") else None
    except Exception as e:  # noqa: BLE001
        rec.update(reached=False, error=f"{type(e).__name__}: {e}", traceback=traceback.format_exc(),
                   failed_turn=len(history) // 2, calls=[{"tool": c["tool"], "args": c["args"]} for c in calls])
    rec.update(n_calls=len(calls), sec=round(time.time() - t0, 1))
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--model")
    ap.add_argument("--hold", action="store_true", help="보류 세트만 실행")
    a = ap.parse_args()
    items = yaml.safe_load((Path(__file__).parent / "agent_eval.yaml").read_text(encoding="utf-8"))
    items = [x for x in items if bool(x.get("hold")) == a.hold]
    if a.only:
        ids = set(a.only.split(","))
        items = [x for x in items if x["id"] in ids]
    llm = OllamaLLM(model=a.model)
    recs = []
    for x in items:
        r = run_item(llm, x)
        recs.append(r)
        print(f"{r['id']:5} {'O' if r['reached'] else 'X'} calls={r['n_calls']} {r['sec']}s {r.get('error', '')}")
    n = len(recs) or 1
    reached = sum(r["reached"] for r in recs) / n * 100
    clar = [r for r in recs if r.get("clarify_ok") is not None]
    summary = {"model": llm.model, "data_reached_pct": round(reached, 1),
               "clarify_pass": all(r["clarify_ok"] for r in clar),
               "unverified_total": sum(r.get("unverified", 0) for r in recs),
               "avg_calls": round(sum(r["n_calls"] for r in recs) / n, 2),
               "avg_sec": round(sum(r["sec"] for r in recs) / n, 1),
               "errors": sum(1 for r in recs if r.get("error"))}
    summary["pass"] = summary["data_reached_pct"] >= 90 and summary["clarify_pass"]
    out = ROOT / "data" / "eval"
    out.mkdir(parents=True, exist_ok=True)
    safe_model = llm.model.replace(":", "_").replace("/", "_")
    path = out / f"agent_eval_{safe_model}_{datetime.now():%Y%m%d_%H%M%S}.json"
    path.write_text(json.dumps({"summary": summary, "items": recs}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    print(f"저장: {path}")
    return 0 if summary["pass"] else 1


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    sys.exit(main())
