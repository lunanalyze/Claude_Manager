<#
  릴리스 산출물 빌드 — internal(설치본) / external(업데이트 팩 + latest.json) 분리.

  ⚠ 이 파일은 **UTF-8 BOM 으로 저장한다.** PowerShell 5.1 은 BOM 없는 .ps1 을 ANSI(한국어
    Windows 면 CP949)로 읽어, 주석의 한글이 깨지고 그 바이트가 구문으로 파싱돼 스크립트가
    통째로 죽는다. BOM 없이 저장하려면 주석까지 ASCII 로만 쓸 것.

  폴더를 나누는 이유는 편의가 아니라 **사고 방지**다. 한 폴더에 섞어 두면 GitHub 릴리스에
  파일을 끌어다 놓을 때 관리자 키가 든 설치본이 같이 올라간다. public repo 라 한 번 올라가면
  이미 받아간 사람이 있다고 봐야 한다.

      build/installer/internal/   설치본(.exe)  ← 사내 배포 전용. 공개 금지
      build/installer/external/   팩 zip + latest.json  ← 이 둘만 릴리스에 올린다

  스택 의존 부분은 아래 「프로젝트마다 바꾸는 곳」 한 블록에 모아 두었다. 그 아래는 그대로 쓴다.

  사용:
      .\build-release.ps1 -Owner <owner> -Repo <repo> -Notes "표 서식 수정" [-RestartRequired $true]
#>
param(
  # 사용자에게 받은 **public** repo. pack.url 을 만드는 데 쓴다.
  [Parameter(Mandatory = $true)][string]$Owner,
  [Parameter(Mandatory = $true)][string]$Repo,
  # latest.json 의 notes — 담당자가 읽을 한 줄.
  [string]$Notes = "",
  # 서버·실행 파일이 바뀌면 $true. UI·설정만이면 $false(새로고침만 한다).
  [bool]$RestartRequired = $true,
  # 앱 빌드를 건너뛰고 기존 산출물로 팩만 다시 만든다.
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# ──────────────────────────────────────────────────────────────────────────────
# 프로젝트마다 바꾸는 곳
# ──────────────────────────────────────────────────────────────────────────────

# 버전의 단일 원본(계약 C2). 빌드 설정에서 읽는다 — 손으로 적지 않는다.
#   package.json      : (Get-Content package.json | ConvertFrom-Json).version
#   build.gradle      : 아래 예시
#   pyproject.toml    : (Select-String 'version\s*=\s*"([^"]+)"' ...)
$version = (Select-String -Path (Join-Path $repoRoot "apps\api\build.gradle") `
              -Pattern "^\s*version\s*=\s*'([^']+)'" | Select-Object -First 1
           ).Matches[0].Groups[1].Value

$appName = "MyApp"

# 앱을 빌드해 이 폴더들에 산출물을 만든다. 팩에는 여기 것만 담긴다.
function Invoke-AppBuild {
  # 예: npm --prefix apps/web run build ; ./gradlew bootJar
  throw "Invoke-AppBuild 를 이 프로젝트에 맞게 채우세요."
}

# 팩에 담을 것 — <설치루트>/app/ 아래 구조 그대로. 런타임·사용자 데이터는 넣지 않는다.
function Copy-AppPayload([string]$destAppDir) {
  # 예:
  #   Copy-Item "$repoRoot\apps\api\build\libs\*.jar" "$destAppDir\api\" -Force
  #   Copy-Item "$repoRoot\apps\web\out\*" "$destAppDir\web\out\" -Recurse -Force
  throw "Copy-AppPayload 를 이 프로젝트에 맞게 채우세요."
}

# 설치본(.exe)을 만든다. 관리자 키를 심는다면 여기서만.
function New-Installer([string]$outExe, [string]$payloadDir) {
  # 예: & makensis.exe /DPAYLOAD=$payloadDir /DOUTFILE=$outExe installer.nsi
  throw "New-Installer 를 이 프로젝트에 맞게 채우세요."
}

# ──────────────────────────────────────────────────────────────────────────────
# 여기부터는 공통
# ──────────────────────────────────────────────────────────────────────────────

$work     = Join-Path $repoRoot "build\installer"
$payload  = Join-Path $work "payload"
$internal = Join-Path $work "internal"
$external = Join-Path $work "external"

foreach ($d in @($payload, $internal, $external)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

Write-Host "`n=== 버전 $version" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host "=== 앱 빌드" -ForegroundColor Cyan
  Invoke-AppBuild
}

Write-Host "=== payload 스테이징" -ForegroundColor Cyan
Remove-Item (Join-Path $payload "app") -Recurse -Force -ErrorAction SilentlyContinue
$payloadApp = Join-Path $payload "app"
New-Item -ItemType Directory -Force -Path $payloadApp | Out-Null
Copy-AppPayload $payloadApp

# ── external: 업데이트 팩 ─────────────────────────────────────────────────────
# app/ 만 담는다. 사용자 키 파일은 **넣지 않는다** — 업데이터가 보존했다가 되돌려 놓는다.
Write-Host "=== 업데이트 팩" -ForegroundColor Cyan
$packName = "$appName-Update-$version.zip"
$packPath = Join-Path $external $packName
Remove-Item $packPath -Force -ErrorAction SilentlyContinue

$excluded = @("api_keys.txt", ".env")
Get-ChildItem $payloadApp -Recurse -File |
  Where-Object { $excluded -contains $_.Name } |
  ForEach-Object { Write-Host "  제외: $($_.Name)"; Remove-Item $_.FullName -Force }

Compress-Archive -Path $payloadApp -DestinationPath $packPath -CompressionLevel Optimal
$packSize = (Get-Item $packPath).Length
$packHash = (Get-FileHash $packPath -Algorithm SHA256).Hash.ToLower()
Write-Host "  $packName ($([math]::Round($packSize/1MB,1)) MB)"
Write-Host "  SHA-256 $packHash"

# ── latest.json ───────────────────────────────────────────────────────────────
# zip 을 확정한 뒤 해시를 내고 그 값으로 쓴다. 순서를 바꾸면 해시가 어긋난다.
$latest = [ordered]@{
  version          = $version
  released_at      = (Get-Date -Format "yyyy-MM-dd")
  notes            = $Notes
  restart_required = $RestartRequired
  pack             = [ordered]@{
    name   = $packName
    url    = "https://github.com/$Owner/$Repo/releases/download/v$version/$packName"
    size   = $packSize
    sha256 = $packHash
  }
}
# BOM 없는 UTF-8 로 쓴다 — BOM 이 붙으면 파서가 깨진다(references/latest-json.md).
[System.IO.File]::WriteAllText(
  (Join-Path $external "latest.json"),
  ($latest | ConvertTo-Json -Depth 5),
  (New-Object System.Text.UTF8Encoding($false)))

# ── internal: 설치본 ──────────────────────────────────────────────────────────
Write-Host "=== 설치본(사내 배포 전용)" -ForegroundColor Cyan
$exe = Join-Path $internal "$appName-Setup-$version.exe"
New-Installer $exe $payload

@"
이 폴더의 설치본은 사내 배포 전용입니다.

관리자용 키가 내장되어 있어, 공개 저장소의 릴리스에 올리면 그 키가 그대로 유출됩니다.
공개 릴리스에 올리는 것은 ..\external\ 의 두 파일뿐입니다.

  - $appName-Update-$version.zip
  - latest.json
"@ | Set-Content -Path (Join-Path $internal "README-사내배포전용.txt") -Encoding UTF8

# ── 안내 ──────────────────────────────────────────────────────────────────────
Write-Host @"

릴리스 절차
  1) 태그 v$version 으로 릴리스를 만든다 (latest 로 표시)
  2) 업로드는 external\ 의 **2개 파일만**:
       $packName
       latest.json
  3) 게시 후 검증: references/release-checklist.md 의 「게시 후」

  gh release create v$version "$packPath" "$(Join-Path $external 'latest.json')" ``
    --repo $Owner/$Repo --title "v$version" --notes-file <노트파일> --latest

  ※ 설치본은 internal\ 에 따로 있습니다 — 공개 릴리스에 올리지 마세요.
"@ -ForegroundColor Green
