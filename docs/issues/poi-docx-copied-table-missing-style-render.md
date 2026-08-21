---
title: POI로 다른 문서의 표를 복사해 넣으면 참조 스타일(pStyle) 누락으로 첫 행이 통째로 렌더 안 됨
date: 2026-07-24
type: 실패→해결
status: resolved
stack: Java 8, Spring Boot, Apache POI 5.2.5(XWPF), docx, LibreOffice(렌더 검증)
tags: [apache poi, xwpf, docx, 표 복사, pStyle, styles.xml, 스타일 누락, 셀 음영 렌더, cross-document, LibreOffice 렌더 검증, 심사보고서]
---

# POI로 다른 문서의 표를 복사해 넣으면 참조 스타일(pStyle) 누락으로 첫 행이 통째로 렌더 안 됨

## 언제 참고
Apache POI(XWPF)로 **서식 문서(template.docx)의 표를 다른 문서(예: 승인신청서.docx)로 복사**해
넣었는데, Word/한글/뷰어에서 그 표의 **특정 행(특히 음영+흰 글씨 제목 박스)이 안 보이거나 잘려**
나올 때. 증상이 "제목이 중간까지만 나온다" 처럼 보일 수 있다. 표 XML(`w:shd fill`, 글자색 등)은
분명히 있는데 렌더만 다를 때.

## 무엇을 하려 했나
심사보고서 조립기: 최종 승인신청서 .docx를 열어 첫 제목표를 `title_template.docx`의 심사보고서
제목표로 교체(`newTbl.getCTTbl().set(tplTbl.getCTTbl().copy())`). 파란 "심사보고서(신규)" 박스가
맨 위에 나와야 함.

## 무슨 일이 있었나
사용자: "Title에서 '투자금융부/홍'까지만 나오는 현상". 생성물을 LibreOffice로 PNG 렌더해 보니
**맨 위 파란 제목 박스("심사보고서(신규)"·"작성일")가 통째로 사라지고** 그 아래 "신청점/부장…"
부터 보였다. 그런데 셀 음영·글자색 XML은 원본 서식과 **바이트 단위로 동일**했다.

```text
report row0 cell0 shd: fill=336699  · run color=FFFFFF  · pStyle=a3   (원본 서식과 동일)
그런데도 파란 박스가 렌더 안 됨 → 표 자체가 아니라 "주변 문서" 차이가 원인
```

## 원인
제목 박스 문단이 **pStyle="a3"**(커스텀 "바탕글" 스타일)를 참조하는데, **대상 문서(승인신청서)의
styles.xml엔 "a3"가 정의돼 있지 않았다.** 참조가 끊긴 첫 행이 렌더링되지 않았다.
확증: 정상 렌더되던 `title_template.docx`에서 **a3 스타일만 삭제하고** 렌더 → 동일 증상 재현.
(셀 음영은 셀 단위라 스타일과 무관할 것 같지만, 실제 뷰어는 pStyle 미해결 시 그 문단/행 렌더를
망가뜨린다.)

## 해결 (실제로 통한 것)
표를 복사할 때 **그 표가 참조하는 pStyle을 서식 문서에서 대상 문서 styles.xml로 함께 복사**한다.
`DocxReport.copyReferencedStyles` (apps/api/.../service/review/DocxReport.java):

```java
XWPFStyles rs = doc.getStyles();          // 대상(승인신청서) 스타일
XWPFStyles ts = tpl.getStyles();          // 서식 문서 스타일
for (String id : referencedPStyleIds(tplTbl)) {   // ⚠️ 참조 id는 '서식 문서 표'에서 읽어야 함
    if (rs.getStyle(id) != null) continue;
    CTStyle ct = (CTStyle) ts.getStyle(id).getCTStyle().copy();
    if (ct.isSetName()) ct.getName().setVal("보고서서식_" + id);  // 이름 충돌만 피하면 됨(참조는 id)
    rs.addStyle(new XWPFStyle(ct));        // XWPFStyle(CTStyle) 생성자 접근 가능
}
```

⚠️ **핵심 함정 2개:**
1. 참조 pStyle id는 **삽입된 표(newTbl)가 아니라 서식 문서의 표(tplTbl)에서** 읽어라 —
   `getCTTbl().set(copy)` 직후 삽입 표의 POI 래퍼는 문단 캐시가 안 갱신돼 `getRows()`가 비어 보인다.
2. 이름(w:name) 충돌 회피: 대상에 같은 이름("바탕글")이 있을 수 있으니 복사본 name만 고유하게.
   pStyle 참조는 **id**로 하므로 name은 바꿔도 됨.

## 다음엔 이렇게 (재발 방지 규칙)
- **POI로 표/문단을 문서 간 복사하면, 그것이 참조하는 스타일(pStyle/rStyle/tblStyle)이 대상
  styles.xml에 있는지 확인하고 없으면 함께 복사하라.** 직접 서식(음영·색)이 XML에 있어도, pStyle
  미해결이면 그 행/문단 렌더가 깨진다.
- `set(copy)` 이후의 POI 래퍼는 캐시가 낡는다 — **원본(서식 문서) 객체에서 메타(스타일 id 등)를 읽어라.**
- **docx 렌더 검증은 텍스트 추출이 아니라 실제 렌더로.** `soffice --headless --convert-to png --outdir <dir> <docx>`
  로 첫 페이지 PNG를 떠서 눈으로 본다. 텍스트 추출(w:t 순회)은 자동번호·음영·스타일 렌더 문제를 못 잡는다.
- 격리 실험으로 원인 좁히기: 정상본에서 의심 요소(스타일 하나)만 제거해 증상이 재현되는지 본다.

## 검증 방법
`soffice --headless --convert-to png` 로 생성 docx 첫 페이지를 렌더 → 파란 제목 박스·작성일·
신청점/부장 전체가 보이는지 육안 확인. 또는 생성물 styles.xml에 참조 pStyle이 존재하는지 grep.
(확인함: 코엔텍 딜 report — 파란 박스 정상 표시, 상단 빈 공간 사라짐.)

## 출처
프로젝트 `AI_IB_Agent_CA` / apps/api/src/main/java/kr/co/jbbank/ibagent/service/review/DocxReport.java
`copyReferencedStyles`, `swapTitle` / 세션 2026-07-24. 환경: Windows, POI 5.2.5, LibreOffice.
