# 이슈 로그 (Issues) — 실패·검증 사례 누적

Claude Code에게 뭔가 시켰을 때 **한 번에 되지 않아 검증이 필요했거나**, **한 번 실패한 뒤**
(Claude 스스로 또는 사용자 지시·대화로) 해결한 사례를 **한 건당 한 파일**로 쌓는다.
목적은 **재활용** — 다음 세션이 같은 벽에 부딪히지 않도록, 먼저 검색해 참고한다.

- 참고자료(`../references/`)와 다르다: 저긴 "어떻게 구현했나", 여긴 **"무엇이 안 됐고 어떻게 뚫었나 +
  다음엔 어떻게 피하나"**의 기록이다.
- 한 이슈 = 한 파일(`<slug>.md`). frontmatter에 `type/status/stack/tags`를 달아
  **나중에 임베딩→RAG 자동 검색**이 가능하도록 설계했다(당장은 이 색인 + `grep` 검색).
- 새 이슈는 [`issue-log`](../../skills/issue-log/SKILL.md) skill로 남긴다. 두 가지 방식:
  - **지정 기록** — `/issue-log` : 방금 짚은 사례 하나를 기록.
  - **전체 스윕** — `/issue-log sweep` : 이 환경의 프로젝트 transcript를 훑어 발생했던 이슈를 소급 백필.

## 사용 습관 (재활용 흐름)

- **위험하거나 낯선 작업 전, 먼저 `docs/issues/` 를 검색**해 기존 사례가 있는지 본다.
  ```bash
  grep -rin "<키워드>" docs/issues/        # 예: grep -rin "jq" docs/issues/
  ```
- 이번에 삽질했다면 끝나고 `/issue-log` 로 남겨 다음 세션이 반복하지 않게 한다.

## 목록

- [dev 서버 포그라운드 "실행 안 됨" 오판 + 파이프 행](./dev-server-foreground-hang.md) — 장기 실행 서버는 detached+로그+curl로 · `npm run dev, setsid, fuser, EADDRINUSE`
- [recharts 차트가 curl HTML엔 안 보임 (SSR 오판)](./recharts-ssr-curl-empty.md) — ResponsiveContainer는 클라이언트 하이드레이션 후 렌더 · `recharts, SSR, curl`
- [Next.js SSR HTML grep 시 텍스트가 `<!-- -->`로 쪼개짐](./nextjs-ssr-html-grep-comment-nodes.md) — 매칭 전 주석 노드 제거 · `react ssr, comment nodes, grep`
- [recharts 색이 CSS var()로 불안정 → JS 색 매핑](./recharts-css-var-svg-color.md) — SVG 차트는 토큰 대신 JS 색 맵 · `recharts, css variable, svg`
- [WSL jq 미설치 → exit 127, JSON은 python3](./wsl-jq-missing.md) — 셸 JSON 파싱은 python3/node · `wsl, jq, command not found`
- [한글 `.ps1` 이 CP949로 읽혀 ParserError](./powershell-ps1-korean-cp949-parsererror.md) — WSL이 만든 .ps1은 ASCII로 쓸 것(BOM+OutputEncoding 대안) · `powershell, ps1, 인코딩, cp949, ParserError`
- [python-docx 템플릿 치환 후 bold 유실](./python-docx-template-bold-lost.md) — 서식은 run 단위, 치환 후 코드에서 `run.bold=True` 재적용 · `python-docx, bold, placeholder 치환`
- [한글 docx 폰트 미적용(맑은 고딕 무시)](./docx-korean-font-eastasia.md) — `w:rFonts`의 `w:eastAsia`를 함께 설정해야 한글에 먹음 · `python-docx, 한글 폰트, eastAsia`
- [로컬 서버 exe 잔존·중복 기동](./local-server-exe-singleton-port.md) — 기동 전 `socket.connect_ex`로 포트 점유 확인 + idle 자동 shutdown · `로컬 서버, 포트 점유, PyInstaller`
- [LLM이 bullet별로 객체를 쪼개 반환 → 병합 덮어쓰기로 bullet 1개로 붕괴](./llm-bullet-merge-overwrite-schema-variance.md) — LLM JSON 병합은 덮어쓰기 금지·빈 슬롯만 채움, 값 적으면 응답 원본부터 확인 · `LLM, JSON 스키마 변형, 병합 덮어쓰기, bullet 유실, 모델 교체`
- [POI로 복사한 표가 참조 스타일 누락으로 첫 행 렌더 안 됨](./poi-docx-copied-table-missing-style-render.md) — 표 복사 시 참조 pStyle을 대상 styles.xml로 함께 복사, docx 검증은 LibreOffice PNG 렌더로 · `apache poi, xwpf, pStyle, styles.xml, 셀 음영 렌더, LibreOffice 렌더 검증`
- [LLM 입력 context window 초과(400) — extracted.json 원본 OOXML 노이즈 수 MB](./llm-context-window-extracted-ooxml-noise.md) — 부가 산출물에 글자수 상한 + `raw_*_xml` 노이즈 제거(4.8MB→279K) · `openai, context window, 400, raw_docx_xml, 프롬프트 입력 상한`
