# 릴리스 검증 목록

한 항목이라도 건너뛰면 사고가 난다. 실제로 겪은 것만 적었다.

## 게시 전

### 빌드 스크립트 자체

- [ ] `.ps1` 에 한글이 있으면 **UTF-8 BOM 으로 저장**했다
      (PowerShell 5.1 은 BOM 없으면 ANSI 로 읽어 한글이 깨지고 스크립트가 통째로 죽는다)
- [ ] `.cmd`/`.bat` 는 **ASCII 로만** 썼다 (cmd.exe 는 콘솔 코드페이지로 읽는다 —
      한글 안내문은 별도 텍스트 파일에 두고 `type` 으로 출력)

### 버전

- [ ] 버전을 **빌드 설정 파일 한 곳**에서만 올렸다 (`package.json`/`build.gradle`/…)
- [ ] 빌드 산출물이 그 버전을 품고 있다 (매니페스트·`__version__`·바이너리 메타)
- [ ] 이전 릴리스보다 **큰** 번호다. 이미 낸 번호를 다시 쓰지 않는다

### 팩 내용 (external/*.zip)

- [ ] 팩에 **시크릿이 없다** — API 키·토큰·인증서·`.env`
- [ ] 팩에 **사용자 데이터가 없다** — DB·업로드 파일·산출물 폴더
- [ ] 팩에 **런타임이 없다**(`app/` 만 담는다)
- [ ] 이번에 고친 코드가 **실제로 들어 있다** — 팩을 열어 해당 파일/문자열을 확인한다
      (빌드를 건너뛰고 옛 산출물을 담는 사고가 가장 흔하다)

```bash
# 예: 팩 안에서 이번 수정의 흔적을 찾는다
unzip -p external/MyApp-Update-1.4.2.zip 'app/web/**/*.js' | grep -c '새 기능 문구'
```

### latest.json

- [ ] `version` 이 빌드 설정과 같다
- [ ] `pack.sha256` 이 **실제 zip 파일의 해시**와 일치한다
- [ ] `pack.size` 가 실제 크기와 같다
- [ ] `pack.url` 이 이번 태그를 가리킨다
- [ ] **BOM 이 없다**
- [ ] `restart_required` 가 실제 변경 범위와 맞다

### internal

- [ ] 설치본이 `internal/` 에만 있고 `external/` 에 없다
- [ ] `internal/README-사내배포전용.txt` 가 있다

## 게시

- [ ] 태그가 `v<버전>` 형식이고 새 태그다
- [ ] **latest 로 표시**했다 (`--latest`) — 안 하면 `releases/latest/download/` 가 옛 것을 가리킨다
- [ ] 업로드한 에셋이 **정확히 2개**다: 팩 zip + `latest.json`
- [ ] 릴리스 노트가 **담당자 언어**다 — "무엇이 좋아졌나". 커밋 메시지·파일명 나열이 아니다

## 게시 후

- [ ] 릴리스 에셋 목록에 **설치본(.exe 등)이 없다** ← 가장 중요
- [ ] `releases/latest/download/latest.json` 이 **새 버전**을 돌려준다
- [ ] 그 JSON의 `pack.url` 이 HTTP 200 이고 `Content-Length` 가 `pack.size` 와 같다
- [ ] **이전 릴리스들의 에셋이 그대로다**(크기 비교) — 실수로 덮어쓰지 않았는지

```bash
gh release view v1.4.2 --repo <owner>/<repo> --json assets \
  | python -c "import json,sys; [print(a['name'], a['size']) for a in json.load(sys.stdin)['assets']]"

curl -sI "$(curl -s https://github.com/<owner>/<repo>/releases/latest/download/latest.json \
  | python -c 'import json,sys; print(json.load(sys.stdin)["pack"]["url"])')" | head -3
```

## 실제 적용 확인

- [ ] 설치된 앱에서 알림이 뜬다
- [ ] 눌러서 **끝까지 적용**된다 (교체 → 재기동 → 헬스체크 → 새로고침)
- [ ] 업데이트 후 **콘솔 창이 쌓이지 않았다**
- [ ] 업데이트 후 **탭이 두 개가 되지 않았다**
- [ ] 사용자 키·데이터가 그대로다

> 업데이터 자체를 고친 회차라면, **그 수정은 이번 업데이트에 적용되지 않는다.**
> 옛 업데이터가 도는 마지막 회차다 — 실패하면 설치본으로 한 번 밀어 올려야 한다.
> (SKILL.md 「업데이터의 자기참조」)

## 실패했을 때

- 설치가 **훼손되지 않았는지** 먼저 본다(앱이 이전 버전으로 살아 있어야 정상)
- 업데이트 로그에서 **무엇이 막았는지** 확인한다 — 파일 이름·프로세스 목록
- 원인이 파일 잠금이면 [windows-swap.md](./windows-swap.md)
- **같은 버전 번호로 다시 올리지 않는다.** 고쳤으면 번호를 올린다
