---
title: Next.js SSR HTML을 grep할 때 텍스트가 <!-- -->로 쪼개져 매칭 실패
date: 2026-07-07
type: 검증
status: resolved
stack: Next.js/React SSR, curl, grep, python3
tags: [react ssr, comment nodes, hydration marker, grep, curl, 텍스트 매칭, 검증]
---

# Next.js SSR HTML을 grep할 때 텍스트가 `<!-- -->`로 쪼개져 매칭 실패

## 언제 참고
- 렌더된 페이지에 특정 **문구가 있는지 `curl | grep`** 으로 확인할 때.
- 특히 `{표현식}`이 섞인 텍스트(예: `커버리지 {a} / {b}`)를 부분 문자열로 찾을 때 grep이 안 잡힐 때.

## 무엇을 하려 했나
쇼케이스 페이지에 "커버리지 66 / 66" 문구가 렌더되는지 `curl | grep` 으로 검증.

## 무슨 일이 있었나
화면엔 분명히 있는데 grep이 **매칭 실패**:

```text
$ curl -s .../showcase | grep -oE "커버리지 66 / 66"
(빈 결과)
```

## 원인
React SSR은 인접한 **텍스트 노드/표현식 경계에 `<!-- -->` 주석 마커**를 삽입한다
(하이드레이션 경계 표시용). 그래서 화면엔 이어 보여도 HTML 바이트열은 쪼개진다:

```text
커버리지 <!-- -->66<!-- --> / <!-- -->66
```
→ `커버리지 66 / 66` 이라는 연속 문자열은 원본 HTML에 존재하지 않아 grep이 못 찾는다.

## 해결 (실제로 통한 것)
매칭 **전에 `<!-- -->` 주석 마커를 제거**한다.

```bash
curl -s .../showcase | python3 -c "
import sys,re
h=re.sub(r'<!--\s*-->','',sys.stdin.read())   # 하이드레이션 주석 제거
print('OK' if re.search(r'커버리지 66 / 66', h) else 'MISS')
"
```

## 다음엔 이렇게 (재발 방지 규칙)
- SSR HTML에서 **표현식이 섞인 문구**를 검증할 땐, grep 전에 `<!-- -->` 를 제거한다(python `re.sub`).
- 또는 값이 삽입되지 않는 **정적 부분 문자열**(예: 클래스명 `sc-cover-badge`, 고정 라벨)로 검증한다.
- 순수 정적 텍스트는 이 문제가 없지만, `{a} / {b}` 같은 조합은 거의 항상 쪼개진다고 가정한다.

## 검증 방법
주석 제거 후 정규식이 매칭되면 정상. 클래스명 등 정적 마커도 함께 확인하면 이중 확인.

## 출처
이 repo webui 요소 쇼케이스 커버리지 검증(2026-07-07).
