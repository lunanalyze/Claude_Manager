"""업데이터 참고 구현 — app\\ 을 갈아끼우고 앱을 다시 띄운다. (Windows 기준)

<b>설치 폴더 밖(%TEMP%)에서 실행한다.</b> 자기가 교체할 폴더 안에서 돌면 파일 잠금이 풀리지 않는다.
쓰는 인터프리터도 app\\ 밖(runtime\\)에 있어야 한다 — 자기 발밑을 치우면 안 된다.

호출 규약:
    python apply.py --root <설치루트> --pack <업데이트zip> --work <임시폴더> \
                    --health <헬스URL> [--version 1.4.2]

핵심 설계는 references/windows-swap.md 에 근거가 있다. 요약:
  · 폴더째 rename 하지 않는다 — 안에 열린 파일이 하나만 있어도 통째로 막힌다(WinError 5).
  · 교체 **전에** 잠금이 풀렸는지 확인한다. 포트가 닫힌 것은 프로세스가 끝난 증거가 아니다.
  · 막힌 폴더는 한 겹 들어가 내용만 옮긴다(폴더 핸들은 자식 이동을 막지 않는다).
  · 실패하면 되돌린다. 반쪽짜리 app\\ 으로 앱을 띄우는 게 업데이트 실패보다 나쁘다.
"""
from __future__ import annotations

import argparse
import ctypes
import ctypes.wintypes as wt
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile

# 팩에는 없지만 교체 중 잃으면 안 되는 사용자 파일(app\ 안에 있는 것).
KEEP_IN_APP = ["api_keys.txt"]

LOG: list[str] = []


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    LOG.append(line)
    print(line, flush=True)


def write_log(work: str) -> None:
    try:
        with open(os.path.join(work, "update.log"), "a", encoding="utf-8") as f:
            f.write("\n".join(LOG) + "\n")
    except OSError:
        pass


# ── 잠금 탐지 ───────────────────────────────────────────────────────────────────

def open_files_under(d: str) -> list[str]:
    """d 안에서 **다른 프로세스가 열고 있는** 파일들의 상대경로.

    CreateFileW 를 dwShareMode=0(공유 금지)으로 열어 본다. 다른 핸들이 있으면
    ERROR_SHARING_VIOLATION(32) 이 난다. 열리면 즉시 닫으므로 파일은 그대로다.
    """
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.CreateFileW.restype = wt.HANDLE
    k32.CreateFileW.argtypes = [wt.LPCWSTR, wt.DWORD, wt.DWORD, ctypes.c_void_p,
                                wt.DWORD, wt.DWORD, wt.HANDLE]
    invalid = wt.HANDLE(-1).value
    busy: list[str] = []
    for dirpath, _dirs, files in os.walk(d):
        for name in files:
            full = os.path.join(dirpath, name)
            h = k32.CreateFileW(full, 0x80000000, 0, None, 3, 0x80, None)  # GENERIC_READ, share=0
            if h == invalid:
                if ctypes.get_last_error() == 32:
                    busy.append(os.path.relpath(full, d))
            else:
                k32.CloseHandle(h)
    return sorted(busy)


def wait_for_unlocked(app_dir: str, timeout: float = 180.0) -> list[str]:
    """app\\ 안의 열린 파일이 없어질 때까지 기다린다. 남으면 그 목록을 돌려준다(빈 목록 = 정상)."""
    deadline = time.time() + timeout
    last_notice = 0.0
    while True:
        busy = open_files_under(app_dir)
        if not busy:
            return []
        if time.time() >= deadline:
            return busy
        if time.time() - last_notice > 15.0:
            last_notice = time.time()
            log(f"아직 사용 중인 파일 {len(busy)}개 — 기다립니다: {', '.join(busy[:3])}")
        time.sleep(1.0)


def log_processes_under(root: str) -> None:
    """설치 폴더에서 실행 중인 프로세스 — 무엇을 닫아야 하는지 알려주려고 남긴다."""
    try:
        ps = ("Get-CimInstance Win32_Process | "
              f"Where-Object {{ $_.ExecutablePath -like '{root}*' }} | "
              "ForEach-Object { \"$($_.ProcessId) $($_.Name)\" }")
        out = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps],
                             capture_output=True, text=True, timeout=20).stdout.strip()
        log(f"설치 폴더에서 실행 중인 프로세스: {out.replace(chr(10), ', ') if out else '없음'}")
    except Exception:  # noqa: BLE001 — 진단 실패가 업데이트 판단을 바꾸지 않는다
        pass


# ── 교체 ───────────────────────────────────────────────────────────────────────

def move_children(src: str, dst: str, timeout: float = 180.0) -> list[str]:
    """src 안의 항목을 dst 로 옮긴다. **src 디렉터리 자체는 건드리지 않는다.**

    기다려도 안 풀린 **폴더**는 한 겹 들어가 내용만 옮기고 껍데기를 남긴다(재귀 폴백) —
    폴더 핸들은 그 폴더의 rename 만 막고 자식 이동은 막지 않는다. 새 팩이 어차피 그 경로에
    파일을 쓰므로 교체는 완성된다.
    """
    os.makedirs(dst, exist_ok=True)
    moved: list[str] = []
    stuck: list[tuple[str, OSError]] = []
    pending = sorted(os.listdir(src))
    deadline = time.time() + timeout
    while pending:
        stuck = []
        for name in pending:
            s, d = os.path.join(src, name), os.path.join(dst, name)
            # 대상이 이미 폴더로 있으면 rename 이 안 된다(WinError 183) — 되돌리기 경로에서
            # 껍데기만 남은 폴더가 그대로 있기 때문이다. 한 겹 들어가 합친다.
            if os.path.isdir(s) and os.path.isdir(d) and not os.path.islink(s):
                try:
                    moved.extend(f"{name}/{x}" for x in move_children(s, d, timeout=30.0))
                except RuntimeError as e:
                    stuck.append((name, OSError(str(e))))
                continue
            try:
                os.rename(s, d)
                moved.append(name)
            except OSError as e:  # noqa: PERF203
                stuck.append((name, e))
        if not stuck:
            return moved
        pending = [n for n, _ in stuck]
        if time.time() >= deadline:
            break
        time.sleep(1.0)

    remaining: list[tuple[str, OSError]] = []
    for name, err in stuck:
        s, d = os.path.join(src, name), os.path.join(dst, name)
        if os.path.isdir(s) and not os.path.islink(s):
            try:
                moved.extend(f"{name}/{x}" for x in move_children(s, d, timeout=30.0))
                if not os.listdir(s):  # 껍데기만 남았다 = 목적 달성
                    log(f"'{name}' 폴더는 잠겨 있어 내용만 옮겼습니다(껍데기는 그대로 둡니다)")
                    continue
                err = OSError(f"{name} 안에 옮기지 못한 항목이 남았습니다")
            except RuntimeError as e:
                err = OSError(str(e))
        remaining.append((name, err))

    if remaining:
        detail = ", ".join(f"{n}({getattr(e, 'winerror', None) or e})" for n, e in remaining)
        raise RuntimeError(f"사용 중인 파일을 옮기지 못했습니다: {detail}"
                           " — 그 파일을 쓰고 있는 프로그램을 닫고 다시 시도하세요.")
    return moved


def clear_children(d: str) -> None:
    """디렉터리는 남기고 안을 비운다 — 되돌리기 전에 반쪽 전개물을 치운다."""
    if not os.path.isdir(d):
        return
    for name in sorted(os.listdir(d)):
        p = os.path.join(d, name)
        if os.path.isdir(p) and not os.path.islink(p):
            shutil.rmtree(p, ignore_errors=True)
        else:
            try:
                os.remove(p)
            except OSError:
                pass


# ── 앱 기동 ────────────────────────────────────────────────────────────────────

def close_stale_consoles(root: str, script_names: tuple[str, ...]) -> None:
    """서버가 끝난 뒤 남은 이 설치본의 콘솔 창을 닫는다.

    `start "" foo.cmd` 는 `cmd /K foo.cmd` 로 떠서 스크립트가 끝나도 창이 남는다. 업데이트를
    한 번 할 때마다 죽은 콘솔이 쌓이고, 그 콘솔이 app\\ 안의 스크립트를 읽고 있으면 교체까지
    막는다. **교체 전에** 부른다 — 재시작 직전에만 부르면 이미 늦다.
    """
    try:
        cond = " -or ".join(f"$_.CommandLine -like '*{root}\\\\{n}*'" for n in script_names)
        ps = ("Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | "
              f"Where-Object {{ {cond} }} | ForEach-Object {{ $_.ProcessId }}")
        out = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps],
                             capture_output=True, text=True, timeout=20).stdout.split()
        pids = [x for x in out if x.strip().isdigit() and int(x) != os.getpid()]
        for pid in pids:
            subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True, timeout=15)
        if pids:
            log(f"남아 있던 콘솔 창 {len(pids)}개 정리 (PID {', '.join(pids)})")
    except Exception:  # noqa: BLE001 — 정리 실패가 업데이트를 막을 이유는 없다
        pass


def launch(root: str, launcher: str = "launch.cmd") -> None:
    """앱을 새 콘솔로 띄운다 — 이 스크립트가 끝나도 살아 있어야 한다.

    **브라우저는 열지 않는다.** 업데이트를 시작한 탭이 이미 헬스체크를 기다리다 스스로
    새로고침하므로, 여기서 또 열면 같은 주소의 탭이 두 개가 된다. 런처가 인자를 모르는
    옛 버전일 수 있어 표식 파일도 함께 남긴다(런처 쪽이 보고 지운다).
    """
    try:
        with open(os.path.join(root, ".no-browser-once"), "w", encoding="ascii") as f:
            f.write("1")
    except OSError:
        pass
    subprocess.Popen(
        ["cmd.exe", "/c", "start", "", os.path.join(root, launcher), "--no-browser"],
        cwd=root,
        creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0),
        close_fds=True,
    )


def healthy(url: str, timeout: float = 180.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:  # noqa: BLE001 — 아직 안 떴을 뿐
            pass
        time.sleep(2.0)
    return False


# ── 본 흐름 ────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--pack", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--health", required=True, help="복귀 확인용 URL (계약 C1)")
    ap.add_argument("--version", default="")
    ap.add_argument("--launcher", default="launch.cmd")
    a = ap.parse_args()

    root, app_dir = a.root, os.path.join(a.root, "app")
    bak = os.path.join(a.root, "app.bak")
    log(f"업데이트 시작 — 대상 {root}, 버전 {a.version}")

    try:  # 지난 업데이트가 중간에 죽어 남은 표식이 다음 실행의 브라우저를 삼키지 않게
        os.remove(os.path.join(root, ".no-browser-once"))
    except OSError:
        pass

    # 서버가 끝났으면 런처 콘솔들은 껍데기다 — 교체 전에 닫는다.
    close_stale_consoles(root, (a.launcher, os.path.join("app", "open-browser.cmd")))

    busy = wait_for_unlocked(app_dir)
    if busy:
        log(f"app\\ 안의 파일 {len(busy)}개가 아직 사용 중입니다: {', '.join(busy[:5])}")
        log_processes_under(root)
        log("업데이트를 중단합니다 — 열려 있는 창을 모두 닫고 다시 시도하세요.")
        write_log(a.work)
        launch(root, a.launcher)  # 아무것도 건드리지 않았으므로 원래 앱을 그대로 띄운다
        return 1
    log("파일 잠금 해제 확인")

    kept: dict[str, bytes] = {}
    for name in KEEP_IN_APP:
        p = os.path.join(app_dir, name)
        if os.path.isfile(p):
            with open(p, "rb") as f:
                kept[name] = f.read()
            log(f"보관: app\\{name} ({len(kept[name])}B)")

    if os.path.isdir(bak):
        shutil.rmtree(bak, ignore_errors=True)
    try:
        moved = move_children(app_dir, bak)
        log(f"이전 app\\ 내용 → app.bak\\ 이동 ({len(moved)}개)")
    except RuntimeError as e:
        log(str(e))
        try:  # 일부만 옮겨졌을 수 있다 — 반쪽 app\ 으로 띄우면 더 나쁘다
            move_children(bak, app_dir, timeout=30.0)
        except RuntimeError as e2:
            log(f"되돌리기도 실패: {e2} — app.bak\\ 의 내용을 수동으로 app\\ 에 옮겨야 합니다")
        shutil.rmtree(bak, ignore_errors=True)
        write_log(a.work)
        launch(root, a.launcher)
        return 1

    try:
        with zipfile.ZipFile(a.pack) as z:
            # app/ 로 시작하는 항목만. 그 밖의 경로는 무시한다 — zip 안의 ..\ 로 설치 폴더
            # 밖을 덮어쓰지 못하게(zip slip 방지).
            members = [n for n in z.namelist()
                       if n.replace("\\", "/").startswith("app/")
                       and ".." not in n.replace("\\", "/").split("/")]
            if not members:
                raise RuntimeError("팩에 app/ 항목이 없습니다")
            z.extractall(root, members=members)
        log(f"새 app\\ 전개 완료 ({len(members)}개 항목)")

        for name, data in kept.items():
            p = os.path.join(app_dir, name)
            if not os.path.isfile(p):
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "wb") as f:
                    f.write(data)
                log(f"복원: app\\{name}")
    except Exception as e:  # noqa: BLE001
        log(f"전개 실패: {e} — 되돌립니다")
        clear_children(app_dir)
        try:
            move_children(bak, app_dir, timeout=60.0)
            log("app.bak\\ → app\\ 복원 완료")
            shutil.rmtree(bak, ignore_errors=True)
        except RuntimeError as e2:
            log(f"복원 실패: {e2} — app.bak\\ 의 내용을 수동으로 app\\ 에 옮겨야 합니다")
        write_log(a.work)
        launch(root, a.launcher)
        return 1

    log("앱 재시작 …")
    launch(root, a.launcher)
    if healthy(a.health):
        log("헬스체크 통과 — 업데이트 완료")
        shutil.rmtree(bak, ignore_errors=True)
        write_log(a.work)
        return 0

    log("새 버전이 뜨지 않습니다 — 되돌립니다")
    clear_children(app_dir)
    try:
        move_children(bak, app_dir, timeout=60.0)
        log("app.bak\\ → app\\ 복원 완료")
        shutil.rmtree(bak, ignore_errors=True)
    except RuntimeError as e:
        log(f"복원 실패: {e} — app.bak\\ 의 내용을 수동으로 app\\ 에 옮겨야 합니다")
    launch(root, a.launcher)
    write_log(a.work)
    return 1


if __name__ == "__main__":
    sys.exit(main())
