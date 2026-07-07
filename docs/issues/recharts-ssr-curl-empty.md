---
title: recharts 차트가 curl한 HTML엔 안 보임 (SSR 렌더 오판)
date: 2026-07-07
type: 검증
status: verified
stack: Next.js App Router, recharts(ResponsiveContainer)
tags: [recharts, ResponsiveContainer, SSR, hydration, curl, 차트 검증, next.js, use client]
---

# recharts 차트가 curl한 HTML엔 안 보임 (SSR 렌더 오판)

## 언제 참고
- recharts(또는 컨테이너 크기에 의존하는 클라이언트 위젯)를 넣은 페이지를 **curl로 검증**할 때.
- "차트가 안 그려지는 것 같다"는 인상을 받았을 때(HTML에 `<svg>`/차트 마크업이 없음).

## 무엇을 하려 했나
차트가 실제로 렌더되는지 `curl`로 페이지 HTML을 받아 확인.

## 무슨 일이 있었나
curl'd HTML에 차트 SVG/시리즈 마크업이 **없어서** "렌더가 안 된다"고 오해.
(정작 브라우저에서는 정상적으로 그려짐.)

## 원인
recharts `ResponsiveContainer`는 **부모 컨테이너의 실제 크기**를 재서 그린다.
SSR 시점엔 크기가 0이라 **빈 렌더** → 서버가 내려주는(=curl로 받는) HTML엔 차트가 없다.
실제 그림은 **브라우저 하이드레이션 후 클라이언트에서** 생성된다.

## 해결 (검증 방법 교정)
- curl로는 **라우트/컴파일 정상 여부(200)** 와 **차트 컨테이너·제목·데이터 마커** 존재만 확인한다.
- 시각적 렌더는 **브라우저**로 확인한다.
- 차트 컴포넌트가 `"use client"` 인지, 데이터가 주입됐는지로 간접 검증.

```bash
# OK: 라우트가 200이고 차트 카드/제목 마커가 있으면 "정상"으로 간주
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/page
curl -s http://localhost:4321/page | grep -oE "월별 매출|chart-frame|sc-canvas"
# curl HTML에 <svg>가 없다고 실패로 판단하지 말 것
```

## 다음엔 이렇게 (재발 방지 규칙)
- **recharts를 curl'd(SSR) HTML로 시각 검증하지 말 것.** SVG는 클라이언트에서만 생긴다.
- 서버 응답으로는 200 + 컨테이너/마커만 확인하고, 실제 그림은 브라우저에서 본다.
- 같은 원리가 "크기 측정 후 그리는" 다른 클라이언트 위젯에도 적용된다.

## 검증 방법
브라우저에서 차트가 보이면 정상. curl HTML의 SVG 부재는 정상 동작이다.

## 출처
이 repo webui UI 표준 워크숍/조립 페이지 작업(2026-07-07). recharts 3.9.x.
