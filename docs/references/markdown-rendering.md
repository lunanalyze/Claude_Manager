# 마크다운 렌더링 함정 (Markdown Rendering Gotchas)

react-markdown + remark 계열로 마크다운을 렌더링할 때 자주 마주치는 함정과 대응책을 모은다.
(표준이 아니라 **참고** — 프로젝트 상황에 맞게 취사선택)

---

## 물결(`~`) 하나가 의도치 않은 취소선이 됨

**증상**: `~5~10~`, `~범위~표시~`처럼 물결이 두 번 이상 나오는 텍스트에서, 그 사이가
취소선으로 렌더링된다.

**원인**: `remark-gfm`은 GFM 사양의 취소선(`~~text~~`, 물결 두 개)뿐 아니라 **편의상
물결 하나(`~text~`)도 취소선**으로 처리하는 게 기본값(`singleTilde: true`)이다. 그래서 물결
하나짜리가 두 개 짝지어지면 취소선이 된다.

**해법 (대중적)**: 플러그인에 `singleTilde: false`를 주어 **`~~`만** 취소선으로 인정한다.
GitHub 본체 동작과도 더 가까워진다.

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

<ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]}>
  {content}
</ReactMarkdown>
```

- 이후 `~5~10~` 등은 그대로 텍스트로 남고, 취소선이 필요하면 `~~취소선~~`을 쓴다.
- 물결 **두 개**가 들어간 범위 표기(`~~x~~y`)까지 막아야 하면 이 옵션으로 부족 →
  렌더 전 텍스트 이스케이프 또는 커스텀 remark 플러그인 필요.

> 실제 적용 사례: Project_Manager `components/Markdown.tsx` (Claude 대화 렌더링).
