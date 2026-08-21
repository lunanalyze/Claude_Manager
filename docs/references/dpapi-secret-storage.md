# Windows DPAPI로 로컬 시크릿(API 키) 저장 — CryptProtectData via ctypes

> 참고(reference) 문서 · 강제 표준 아님. "이런 요구를 이렇게 풀었고, 이렇게 검증한다"는 재사용 사례.

- **프로젝트**: 조사연구 도우미 (ResearchReportAutomation) / `app.py`
- **스택/버전**: Python 3.10+ 표준 라이브러리만 (`ctypes`, `base64`) — 외부 의존 없음. Windows 전용(DPAPI).
- **관련 파일**: `app.py:3814-3861`(protect/unprotect/save/load/DATA_BLOB), `app.py:46`(KEY_PATH), `paths.py:10`(CONFIG_DIR)
- **작성일**: 2026-07-07
- **키워드**: DPAPI, CryptProtectData, CryptUnprotectData, ctypes windll, 로컬 API 키 저장, openai_key.bin, secret at rest, Windows 자격증명, LocalFree, DATA_BLOB

## 언제 참고
- 로컬 데스크톱 앱에서 **OpenAI/외부 API 키·토큰을 평문 없이** 사용자 PC에 저장해야 할 때.
- 별도 키체인 라이브러리(`keyring` 등) 의존 없이 **표준 라이브러리만으로** 사용자 계정에 묶인 암호화를 하고 싶을 때.
- 암호화 실패(정책·비Windows) 시에도 앱이 죽지 않게 **graceful fallback**이 필요할 때.

## 문제 / 목표
사용자 PC에 OpenAI API 키를 저장하되 평문 파일은 피하고 싶다. 완전한 키 관리 서버는 과하고,
사용자마다 다른 마스터 비밀번호를 받기도 번거롭다. Windows DPAPI(`CryptProtectData`)는 **현재
로그인 사용자 계정**에 묶인 암호화를 커널이 대신 해주므로, 별도 키 관리 없이 "이 PC의 이 사용자만
복호화 가능"을 얻는다. 단, `ctypes`로 Win32 API를 직접 호출해야 하고 메모리 해제(`LocalFree`)를
빠뜨리면 누수가 난다.

## 접근 방식 (핵심 아이디어)
1. `DATA_BLOB` 구조체(`cbData`+`pbData`)를 ctypes로 정의 → Win32가 요구하는 in/out 컨테이너.
2. 저장: `CryptProtectData`로 암호화한 바이트에 **`b"dpapi:"` 프리픽스**를 붙여 파일로. 실패하면
   `b"b64:"` 프리픽스 + base64로 폴백(암호화는 아니지만 최소한 눈에 안 띔).
3. 로드: 파일 앞 프리픽스로 어느 경로로 저장됐는지 판별해 대응 복호화.
4. out blob은 커널이 `LocalAlloc`으로 잡아준 것 → 반드시 `kernel32.LocalFree`로 해제.

## 핵심 코드

```python
# app.py:3860 — Win32 DATA_BLOB (in/out 공용 컨테이너)
class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
```

```python
# app.py:3814 — 암호화. 성공 시 blob_out을 즉시 bytes로 복사하고 LocalFree
def protect_with_dpapi(secret: str) -> bytes:
    data = secret.encode("utf-8")
    blob_in = DATA_BLOB(len(data), ctypes.cast(ctypes.create_string_buffer(data), ctypes.POINTER(ctypes.c_char)))
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
    ):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)   # 커널 버퍼 → python bytes 복사
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)           # 반드시 해제 (누수 방지)
```

```python
# app.py:3841 — 프리픽스 태그 저장 + 폴백. 파일이 어느 방식인지 자기서술
def save_api_key(api_key: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        KEY_PATH.write_bytes(b"dpapi:" + protect_with_dpapi(api_key))
    except Exception:
        KEY_PATH.write_bytes(b"b64:" + base64.b64encode(api_key.encode("utf-8")))

# app.py:3849 — 로드: 프리픽스로 분기. 없거나 미지 형식이면 "" (호출측이 재입력 유도)
def load_api_key() -> str:
    if not KEY_PATH.exists():
        return ""
    data = KEY_PATH.read_bytes()
    if data.startswith(b"dpapi:"):
        return unprotect_with_dpapi(data[6:])
    if data.startswith(b"b64:"):
        return base64.b64decode(data[4:]).decode("utf-8")
    return ""
```

비자명한 점: `ctypes.string_at(pbData, cbData)`는 커널이 준 버퍼를 **python bytes로 복사**한다.
이 복사 없이 blob을 그대로 참조하면 `LocalFree` 후 dangling 포인터가 된다. 그래서 `try/finally`로
복사→해제 순서를 강제한다. `unprotect_with_dpapi`(`app.py:3828`)는 `CryptUnprotectData`로 같은 구조.

## 동작 원리 / 흐름
- 저장 시 커널이 **현재 사용자 자격증명 + 머신 키**로 데이터를 봉인. 결과 바이트는 다른 사용자/다른
  PC에서는 복호화 불가.
- `b"dpapi:"`/`b"b64:"` 프리픽스가 파일을 **자기서술(self-describing)** 로 만들어, 마이그레이션이나
  DPAPI 사용 불가 환경에서도 로드 로직이 형식을 안전하게 판별한다.
- 엣지: DPAPI가 실패해도(그룹 정책·비Windows) 앱은 죽지 않고 base64로 저장 → 키 입력 UX 유지.
  단 b64는 난독화일 뿐 암호화가 아님(아래 함정 참고).

## 검증 방법 (How to verify)

```bash
# 라운드트립 + 저장 형식(프리픽스) + 파일이 평문이 아님을 한 번에 확인
cd "C:\Users\JBB\Desktop\조사연구 자동화"
python -c "import app; app.save_api_key('sk-verify-1234'); \
print('roundtrip:', app.load_api_key()); \
raw=app.KEY_PATH.read_bytes(); \
print('prefix:', raw[:6]); \
print('plaintext_leak:', b'sk-verify-1234' in raw)"
# 기대:
#   roundtrip: sk-verify-1234
#   prefix: b'dpapi:'
#   plaintext_leak: False        ← DPAPI 경로면 평문이 파일에 안 남음
```

- 정상 신호: `roundtrip`이 입력과 동일, `prefix`가 `b'dpapi:'`, `plaintext_leak: False`.
- 흔한 오판: `prefix`가 `b'b64:'`면 DPAPI가 실패해 폴백된 것 → 이때 `plaintext_leak: True`가
  **정상**(b64는 평문 복원 가능). 폴백이 떴다는 건 환경 문제이지 코드 버그가 아님.
- 검증 후 정리: `python -c "import app; app.KEY_PATH.unlink(missing_ok=True)"`

## 결정과 함정 (왜 이렇게 했나)
- **DPAPI 선택**: `keyring` 등 외부 의존 없이 표준 라이브러리만으로 "이 사용자만 복호화" 달성.
  키 관리 서버·마스터 비번 불필요. 대안(평문·자체 대칭키+하드코딩 키)보다 실질 보안이 높다.
- **프리픽스 태그**: 파일 확장자로는 형식을 못 담으니 바이트 프리픽스로 형식 버전을 새김. 후일
  포맷을 늘려도 하위호환.
- **함정 — LocalFree 누락**: out blob은 `CryptProtectData`가 `LocalAlloc`으로 잡은 것. 해제 안 하면
  누수. `try/finally`로 강제.
- **함정 — b64 폴백은 암호화가 아님**: DPAPI 실패 시 base64는 그냥 인코딩. 위협모델상 "평문 파일은
  피한다" 수준의 완화일 뿐, 파일 탈취 시 복원됨. 강한 보안이 필요하면 폴백을 base64 대신 "저장 거부 +
  세션 메모리 보관"으로 바꿀 것.
- **함정 — 비Windows**: `ctypes.windll`은 Windows 전용. 크로스플랫폼이면 macOS Keychain/libsecret
  분기 필요.

## 다른 프로젝트에 재사용하려면 (체크리스트)
- [ ] `ctypes.wintypes`는 import 필요(`import ctypes.wintypes`) — 일부 환경에서 자동 로드 안 됨.
- [ ] `KEY_PATH`/`CONFIG_DIR`를 앱 데이터 경로로 교체(`%LOCALAPPDATA%\<앱>\config`).
- [ ] Windows 전용임을 전제 — 타 OS 지원 시 키체인 분기 추가.
- [ ] 위 검증 스니펫으로 라운드트립·프리픽스·평문미노출 확인.

## 출처
- `app.py:3814-3861`, `app.py:46`(KEY_PATH), `paths.py:10`(CONFIG_DIR). 원본이 바뀔 수 있으니
  재현 전 현재 코드와 대조 권장.
