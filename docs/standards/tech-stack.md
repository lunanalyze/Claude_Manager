# 기술 스택 표준 (Tech Stack)

새 코드를 짤 때의 **기본 스택**. 특별한 사유가 없으면 아래를 따른다. (예외가 필요하면 그 프로젝트
문서에 사유를 남긴다.)

## Frontend

- **Next.js (App Router) + React** 를 기본으로 한다.
- 언어: **TypeScript** 를 기본으로 한다. *(제안 — 변경 가능)*
- UI 스타일·컴포넌트 규칙은 [UI 표준](./ui/index.md)을 따른다.

## Backend

- **Java 8 (1.8) + Spring Boot** 를 기본으로 한다.
- ⚠️ **버전 제약**: Spring Boot 3.x 는 Java 17 이상을 요구한다. 따라서 Java 8에서는
  **Spring Boot 2.7.x**(Java 8 지원 마지막 라인)를 기본으로 한다. *(제안 — 변경 가능)*
- 빌드 도구: **Gradle** 기본. *(제안 — Maven 선호 시 변경 가능)*

## 경계 원칙

- Front(Next.js)와 Back(Spring Boot)은 **REST(JSON)** 로 통신하는 것을 기본으로 한다.
- 인증·에러 포맷 등 공통 규약이 생기면 이 표준에 항목을 추가한다.

---

> 이 문서는 Claude_Manager의 공유 표준이며, 각 환경 CLAUDE.md가 import해 모든 프로젝트가 참조한다.
> *(제안)* 으로 표시된 항목은 사용자 수락 후 확정한다.
