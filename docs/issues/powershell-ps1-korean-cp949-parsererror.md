---
title: WSL에서 만든 한글 .ps1 을 powershell.exe -File 로 돌리면 ParserError
date: 2026-07-21
type: 실패→해결
status: resolved
stack: WSL Ubuntu → Windows PowerShell 5.1(powershell.exe), .ps1, ko-KR / CP949
tags: [powershell, ps1, 인코딩, encoding, cp949, euc-kr, utf-8, BOM, ParserError, UnexpectedToken, 한글 깨짐, wslpath, Stop-Process, Get-NetTCPConnection, windows interop]
---

# WSL에서 만든 한글 `.ps1` 을 `powershell.exe -File` 로 돌리면 ParserError

## 언제 참고
- WSL에서 **Windows 프로세스·포트를 제어**하려고 `.ps1` 스크립트를 써서 `powershell.exe` 로 넘길 때.
- 스크립트 안에 **한글 문자열**(출력 메시지·주석)이 있을 때.
- `ParserError` / `UnexpectedToken` 이 나는데 **문법은 아무리 봐도 멀쩡할 때.**

## 무엇을 하려 했나
Windows 쪽 8000 포트를 점유한 Spring Boot 프로세스를 종료하고 해제를 확인하려고,
WSL에서 heredoc으로 `.ps1` 을 만들어 `powershell.exe -File` 로 실행했다.

```bash
cat > /path/stop8000.ps1 <<'PS'
...
if ($still) { "실패: 8000 아직 점유 (pid " + $still.OwningProcess + ")" } else { "OK: 8000 해제됨" }
PS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w /path/stop8000.ps1)"
```

## 무슨 일이 있었나
스크립트가 **한 줄도 실행되지 않고** 파싱 단계에서 죽었다. 에러 메시지 자체도 깨져서 나왔다.

```text
...\stop8000.ps1:6 문자:16
+ if ($still) { "?�패: 8000 ?�직 ?�유 (pid " + $still.OwningProcess + ")"  ...
+                ~~~~
'?�패:' 토큰입니다.
    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : UnexpectedToken
```

`실패:` 가 `?�패:` 로 뭉개지면서 **문자열 리터럴의 경계가 깨져** 토큰 파서가 넘어갔다.

## 원인
`powershell.exe`(Windows PowerShell 5.1)는 **BOM 없는 파일을 UTF-8이 아니라 시스템 ANSI
코드페이지(한국어 Windows = CP949)로 읽는다.**

WSL의 `cat`/heredoc이 만든 파일은 **BOM 없는 UTF-8**이다. 그래서:

- 한글 1글자 = UTF-8 3바이트 → CP949 기준으로는 엉뚱한 1~2글자로 해석된다.
- 그 과정에서 `"` 앞뒤 바이트가 어그러져 **문자열이 안 닫힌 것처럼** 보이고 파싱이 실패한다.
- **파싱 단계**라서 스크립트 내용과 무관하게 통째로 죽는다. 로직 문제로 오인하기 쉽다.

> PowerShell 7(`pwsh.exe`)은 기본이 UTF-8이라 이 문제가 없다. 하지만 이 PC에서 WSL이
> 호출하는 건 `powershell.exe`(5.1)다.

## 해결 (실제로 통한 것)
**스크립트를 영문(ASCII)만으로 다시 썼다.** 즉시 통과했다.

```bash
cat > /path/stop8000.ps1 <<'PS'
$p = Get-CimInstance Win32_Process -Filter "ProcessId=27336" -ErrorAction SilentlyContinue
if (-not $p) { "ALREADY_GONE"; exit }
Stop-Process -Force -Id 27336
Start-Sleep -Seconds 2
$still = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue
if ($still) { "STILL_HELD pid=" + $still.OwningProcess } else { "OK port 8000 released" }
PS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w /path/stop8000.ps1)"
# → OK port 8000 released
```

한글이 **꼭 필요하면** BOM을 붙인다. 단 **문제가 두 겹**이라는 점을 알아야 한다 —
BOM은 *입력(파싱)* 만 고치고, *출력* 은 여전히 CP949로 돌아온다. (아래는 전부 실측 확인함)

| 조건 | 파싱 | 출력 |
|---|---|---|
| BOM 없음 | ✗ `ParserError` | — |
| BOM 있음 | ✓ 통과 | ✗ `�ѱ� ��� �׽�Ʈ` (CP949 바이트) |
| BOM + `[Console]::OutputEncoding` | ✓ | ✓ `한글 출력 테스트` |
| BOM + WSL에서 `iconv -f CP949` | ✓ | ✓ `한글 출력 테스트` |

```bash
# 방법 1 — 스크립트 안에서 출력 인코딩을 UTF-8로 (권장)
printf '\xEF\xBB\xBF' > /path/script.ps1          # UTF-8 BOM 먼저
cat >> /path/script.ps1 <<'PS'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
"한글 출력 테스트"
PS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w /path/script.ps1)"

# 방법 2 — 출력을 WSL 쪽에서 디코딩
powershell.exe ... -File "$(wslpath -w /path/script.ps1)" | iconv -f CP949 -t UTF-8
```

## 다음엔 이렇게 (재발 방지 규칙)
- **WSL에서 만드는 `.ps1` 은 ASCII만 쓴다.** 출력 메시지도 영문으로(`OK ...`, `STILL_HELD ...`).
  결과를 사람에게 보여줄 때 한국어로 옮기는 건 WSL 쪽에서 하면 된다.
- 한글이 불가피하면 **UTF-8 BOM + `[Console]::OutputEncoding` 을 둘 다** 건다.
  BOM만 붙이면 파싱은 되지만 출력이 깨져서 "반쯤 고쳐진" 상태가 된다.
- 짧은 명령은 파일 대신 `powershell.exe -NoProfile -Command "..."` 로 넘긴다. 단 bash와
  PowerShell의 **따옴표 이스케이프가 두 겹**이라, 조금만 길어지면 `unexpected EOF` 가 난다
  (이번에도 먼저 `-Command` 로 시도했다가 그 에러를 봤다). **길어지면 파일 + ASCII** 가 안전하다.
- 파일 경로는 `wslpath -w` 로 변환해 넘긴다.
- `ParserError`/`UnexpectedToken` 이 뜨는데 문법이 멀쩡해 보이면 **문법이 아니라 인코딩을 먼저 의심한다.**
- 같은 결의 함정: Windows에서 python을 부를 때 `PYTHONIOENCODING=utf-8` 를 붙인다.

## 검증 방법
```bash
# 파일이 BOM 없는 UTF-8인지 확인 (한글이 들어갔다면 위험 신호)
file /path/script.ps1
head -c 3 /path/script.ps1 | xxd    # efbbbf 면 BOM 있음

# 실행 후 의도한 상태가 됐는지 (에러 메시지가 아니라 상태로 확인)
powershell.exe -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort 8000"
```

## 관련
- [작업 규칙](../standards/working-agreement.md) 규칙 4 — Windows 프로젝트까지 함께 고려한다.
- [포트 점유 표준](../standards/ports.md) — Windows 프로세스·포트 확인 명령 모음.
