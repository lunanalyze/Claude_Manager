# scripts — 환경 동기화

repo를 최신화(`git pull`)하고 skills를 각 환경의 `~/.claude/skills` 에 설치한다.
원본은 repo의 `skills/` 이며, **WSL은 심링크·Windows는 복사**로 설치한다
(Claude_Manager/CLAUDE.md 원칙 2·3). `settings.json` 의 hook 배선은 공유·수정하지 않는다(원칙 1).

## 사용

- **WSL**
  ```bash
  bash scripts/sync-wsl.sh
  ```
- **Windows** (PowerShell)
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\sync-windows.ps1
  # 또는:  pwsh scripts/sync-windows.ps1
  ```

두 스크립트 모두 `git pull --ff-only` → skills 재설치 순으로 동작한다.
- WSL: 각 skill을 `~/.claude/skills/<name>` 심링크로 보장(새 skill도 자동 링크).
- Windows: 각 skill을 `~/.claude/skills/<name>` 로 덮어써 복사(새/변경 skill 반영).

> 원격: `github.com/lunanalyze/Claude_Manager` (private). 첫 pull 시 Windows는
> Git 자격증명 관리자(GCM) 브라우저 로그인 한 번이 필요할 수 있다.
