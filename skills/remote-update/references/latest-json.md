# `latest.json` — 조회 대상 파일

앱이 실행될 때마다 읽는 **단 하나의 파일**이다. 서버가 없으므로 이 파일이 곧 "배포 서버"다.

## 위치

```
https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

`releases/latest/download/` 는 GitHub이 **가장 최근 릴리스로 자동 리다이렉트**해 주는 경로다.
그래서 클라이언트는 버전을 몰라도 항상 최신 것을 읽는다 — 앱에 박히는 URL은 이 하나뿐이다.

> 릴리스를 만들 때 **latest 로 표시**해야 이 경로가 그 릴리스를 가리킨다.
> (`gh release create ... --latest`)

## 스키마

```json
{
    "version":  "1.4.2",
    "released_at":  "2026-09-16",
    "notes":  "표 서식 오류 수정 · 일괄 실행 버튼 추가",
    "restart_required":  true,
    "pack":  {
                 "name":  "MyApp-Update-1.4.2.zip",
                 "url":  "https://github.com/<owner>/<repo>/releases/download/v1.4.2/MyApp-Update-1.4.2.zip",
                 "size":  71395394,
                 "sha256":  "1c92e9121866c97c5acddf87cc1d6bb07147fe6ae5d7e1fff9271426d01708af"
             }
}
```

| 필드 | 뜻 | 없으면 |
|---|---|---|
| `version` | 이 릴리스의 버전. 앱이 자기 버전과 **문자열 비교**한다 | 업데이트 판단 불가 |
| `released_at` | 표시용 날짜 | 배너에 날짜가 안 나옴 |
| `notes` | 배너에 한 줄로 보일 요약 | 무엇이 바뀌는지 모른 채 누르게 됨 |
| `restart_required` | 서버·실행 파일이 바뀌는가 | 아래 참조 |
| `pack.name` | 파일 이름 | — |
| `pack.url` | 내려받을 절대 URL | 다운로드 불가 |
| `pack.size` | 바이트. 배너에 "68MB"로 보여 준다 | 크기 표시 없음 |
| `pack.sha256` | 무결성 검증 | **검증 없이 교체하게 된다 — 넣을 것** |

## 규칙

### BOM 없이 쓴다

UTF-8 **BOM이 붙으면 파서가 깨진다.** 언어에 따라 첫 글자가 `﻿` 로 읽혀 JSON 파싱이
실패한다. 생성 스크립트에서 BOM 없는 UTF-8로 쓰고, 게시 후에도 첫 바이트를 확인한다.

```powershell
# PowerShell 5.1 의 Out-File/Set-Content 는 BOM을 붙이는 경우가 있다 — 명시적으로 쓴다
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
```

### sha256 은 실제 zip에서 계산한다

`latest.json` 을 먼저 쓰고 zip을 다시 만들면 해시가 어긋난다. **zip을 확정한 뒤 해시를 내고
그 값으로 `latest.json` 을 쓴다.** 게시 후 검증에서 다시 한 번 대조한다.

### `restart_required` 를 정직하게 쓴다

| 무엇이 바뀌었나 | 값 | 클라이언트 동작 |
|---|---|---|
| 서버 실행 파일·런타임 의존성 | `true` | 앱 종료 → 교체 → 재기동 → 화면 새로고침 |
| 정적 자원(UI)·프롬프트·설정만 | `false` | 교체 후 **새로고침만** |

`true` 인데 `false` 로 적으면 옛 서버가 새 UI를 서빙해 어긋난다. 애매하면 `true` 가 안전하다.

### 버전 문자열은 단조 증가시킨다

클라이언트가 문자열/세그먼트 비교로 판단한다. `1.4.10` 이 `1.4.9` 보다 크게 비교되는지
구현을 확인하고, 자신 없으면 **자리수를 맞춰** 쓴다(`1.04.10`). 가장 안전한 것은
**되돌리지 않는 것** — 잘못 냈으면 내리지 말고 다음 번호로 올려 덮는다.

## 조회 실패는 조용히 넘긴다

사내망·오프라인·GitHub 차단 환경이 흔하다. 조회가 실패했다고 앱 첫 화면에 오류를 띄우면
"업데이트도 아닌데 앱이 고장난 것처럼" 보인다.

- 조회 실패 → **배너를 띄우지 않는다**(무음)
- 필요하면 설정 화면에서만 "확인할 수 없음"으로 알린다
- 서버를 경유해 조회한다면 그 엔드포인트는 실패해도 `200 + { available: false, note: "..." }`
  로 돌려주는 편이 화면이 단순해진다
