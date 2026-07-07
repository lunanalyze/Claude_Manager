# Claude_Manager 동기화 (Windows)
# repo를 최신화(git pull)하고, skills를 ~/.claude/skills 로 재복사한다.
# Windows는 DrvFs 심링크 대신 복사로 설치한다(WSL은 심링크). settings.json hook 배선은 건드리지 않는다(원칙 1).
$ErrorActionPreference = "Stop"

$repo      = Split-Path -Parent $PSScriptRoot          # scripts\ 의 상위 = repo 루트
$skillsSrc = Join-Path $repo "skills"
$skillsDst = Join-Path $env:USERPROFILE ".claude\skills"

Write-Host "→ git pull ($repo)"
git -C $repo pull --ff-only

New-Item -ItemType Directory -Force -Path $skillsDst | Out-Null
Get-ChildItem -Directory $skillsSrc | ForEach-Object {
    $dst = Join-Path $skillsDst $_.Name
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse $_.FullName $dst
    Write-Host "  ✓ skill 복사: $($_.Name)"
}

$installed = (Get-ChildItem -Directory $skillsDst | Select-Object -ExpandProperty Name) -join ", "
Write-Host "완료. 설치된 skills: $installed"
