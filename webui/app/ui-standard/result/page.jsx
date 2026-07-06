import "../workshop.css";
import { resolvedSelections, selectionStatus, UI_ELEMENTS } from "@/lib/ui-standard";
import Assembled from "./Assembled";

export const dynamic = "force-dynamic";

export default function ResultPage() {
  const sel = resolvedSelections();
  const { confirmed, total } = selectionStatus();

  return (
    <div className="res-page">
      <div className="res-banner">
        <div>
          <a href="/ui-standard">← 워크숍으로</a>
          <h1>조립된 표준 페이지</h1>
          <p>
            확정된 선택으로 조립한 더미 대시보드입니다.
            {confirmed < total && <> 아직 미확정 요소({total - confirmed}개)는 <b>기본값(첫 후보)</b>으로 채워집니다.</>}
          </p>
        </div>
        <div className="res-legend">
          {UI_ELEMENTS.map((e) => (
            <span key={e.id} className="res-chip">{e.title}: <b>{sel[e.id]}</b></span>
          ))}
        </div>
      </div>
      <Assembled sel={sel} />
    </div>
  );
}
