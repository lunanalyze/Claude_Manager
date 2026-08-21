---
title: LLM 검증이 "context window 초과(400)" — extracted.json의 원본 OOXML 노이즈가 수 MB
date: 2026-07-24
type: 실패→해결
status: resolved
stack: Java 8, Spring Boot, OpenAI API, Jackson, 심사 파이프라인(2·3단계)
tags: [openai, context window, 400, input too large, 토큰 초과, extracted.json, raw_docx_xml, raw_drawing_xml, OOXML 노이즈, 프롬프트 입력 상한, LLM 입력 정제]
---

# LLM 검증이 "context window 초과(400)" — extracted.json의 원본 OOXML 노이즈가 수 MB

## 언제 참고
LLM에 "제출 자료 전부"를 실어 검증/분석시킬 때 **"Your input exceeds the context window of this
model" (HTTP 400)** 이 날 때. 특히 문서 추출 산출물(extracted 류 JSON)을 통째로 프롬프트에 넣는 경우.

## 무엇을 하려 했나
2단계 승인신청서 검증: 최종 승인신청서 본문 + 제출 산출물 전부(facts·im_verify·report_verify·
valuation·analysis·**extracted**)를 LLM에 보내 대조.

## 무슨 일이 있었나
```text
OpenAI API 요청 실패 (400): Your input exceeds the context window of this model.
Please adjust your input and try again.
```
본문(`approval_text`/`draft_text`)은 6만자로 잘렸지만, 제출 산출물(`SubmittedArtifacts.putInto`)은
**상한이 없었다**. 실측: `01_extracted.json` 단독 **4.8MB(≈120만 토큰)**. 나머지는 작음
(facts 75KB, analysis 51KB, verify 6KB).

## 원인
`01_extracted.json`(영업부 원문 추출 덤프)의 대부분이 표·이미지의 **원본 OOXML**
(`raw_docx_xml`·`raw_drawing_xml`)이었다 — 소스 문서 내부 구조일 뿐 검증에 쓸 내용이 아닌 노이즈.
파싱해 보니 tables 4.16MB / images 0.13MB가 대부분 raw XML. 실제 내용(paragraphs 114KB, 표 rows,
headings, paragraph_groups)은 30만자 미만.

## 해결 (실제로 통한 것)
`SubmittedArtifacts.putInto`에서 **노이즈 키 재귀 제거 + 산출물당 글자수 상한**.
(apps/api/src/main/java/kr/co/jbbank/ibagent/service/review/SubmittedArtifacts.java)

```java
private static final int MAX_ARTIFACT_CHARS = 150_000;
private static final Set<String> NOISE_KEYS = new HashSet<>(Arrays.asList(
        "raw_docx_xml", "raw_drawing_xml", "style_fingerprint"));

private Object trim(JsonNode node) {
    if (node == null) return null;
    JsonNode cleaned = stripNoise(node);            // NOISE_KEYS 재귀 제거
    String s = cleaned.toString();
    if (s.length() <= MAX_ARTIFACT_CHARS) return cleaned;   // 상한 안이면 구조 유지
    return s.substring(0, MAX_ARTIFACT_CHARS) + "…(이하 생략, 컨텍스트 상한 초과)";
}
// stripNoise: ObjectNode/ArrayNode 재귀 복사하며 NOISE_KEYS 스킵
```
효과: extracted 4.47M→279K자(**94%↓**), paragraphs/표 rows/headings 등 실제 내용 보존.
검증 성공(딜 c4858f69, HTTP 200, 34.7s, 대조 7건·지적 6건).

## 다음엔 이렇게 (재발 방지 규칙)
- **LLM에 넣는 모든 외부 산출물에 글자수 상한을 걸어라.** 본문만 자르고 "부가 자료"를 무제한으로
  실으면 특정 딜/문서에서 조용히 컨텍스트를 넘긴다.
- **문서 추출 JSON은 원본 마크업 필드(`raw_*_xml`, `style_fingerprint` 등)를 먼저 제거하라.**
  이런 필드는 LLM에 무의미하면서 용량의 대부분을 차지한다.
- 초과가 의심되면 **먼저 실측**하라: `wc -c` / `json.dumps` 길이로 어느 산출물이 범인인지 찾고,
  노이즈 필드 제거만으로 얼마나 주는지 계산(파이썬 한 줄) → 상한 값 결정.
- 이 수집기는 **2·3단계가 공유**한다 — 한 곳(`SubmittedArtifacts`)만 고치면 둘 다 적용된다.

## 검증 방법
실패했던 딜에서 `POST /api/runs/<id>/approval-verify` 재실행 → HTTP 200, 정상 결과(consistency·
comparisons·issues) 확인. 필요시 조립된 input 길이를 로깅해 토큰 예산 안인지 점검.

## 출처
프로젝트 `AI_IB_Agent_CA` / SubmittedArtifacts.java(putInto/trim/stripNoise) /
ApprovalVerifyService.java(clip 6만자) / 세션 2026-07-24. 환경: Windows, 모델 gpt-5.6-terra.
