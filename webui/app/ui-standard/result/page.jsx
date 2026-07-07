import "../workshop.css";
import { resolvedSelections, selectionStatus, UI_ELEMENTS, candidateName } from "@/lib/ui-standard";
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
            지정한 선택으로 조립한 더미 대시보드입니다. 워크숍에서 후보를 바꾸면 여기에 바로 반영됩니다.
            {confirmed < total && <> 아직 미지정 요소({total - confirmed}개)는 <b>기본값(첫 후보)</b>으로 채워집니다.</>}
          </p>
        </div>
        <div className="res-legend">
          {UI_ELEMENTS.map((e) => (
            <span key={e.id} className="res-chip">{e.title}: <b>{candidateName(e.id, sel[e.id])}</b></span>
          ))}
        </div>
      </div>
      <Assembled sel={sel} />

      <div className="res-cta">
        <div>
          <h3>모든 요소를 실제 화면 맥락에서 보기</h3>
          <p>위 대시보드에 크게 쓰이지 않은 요소까지, 66개 전부를 관리자 앱의 여러 장면(앱 셸·목록·상세·설정·오버레이)에 배치했습니다. 각 장면마다 적용된 요소 목록이 붙습니다.</p>
        </div>
        <a className="cta-btn" href="/ui-standard/showcase">요소 쇼케이스 열기 →</a>
      </div>
    </div>
  );
}
