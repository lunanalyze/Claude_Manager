#!/usr/bin/env bash
# devserver.sh — 로컬 개발 서버 기동/상태/헬스체크/종료 (WSL·bash 전용, jq 불필요)
#
#   devserver.sh status <port>
#   devserver.sh start  <port> <workdir> <command>
#   devserver.sh health <port> [path] [timeout_sec]
#   devserver.sh logs   <port> [lines]
#   devserver.sh stop   <port>
#
# 설계 원칙
#  - 기동은 반드시 detached(setsid) + 로그 리다이렉트. 포그라운드/파이프 금지.
#  - stop 은 start 가 기록한 PID만 죽인다. pkill -f 로 패턴 학살하지 않는다
#    (자기 명령줄에 매칭돼 자기 셸을 죽이는 사고가 실제로 두 번 났다).
#  - health 는 "프로세스가 살아있다"가 아니라 "HTTP 상태코드가 온다"로 판정한다.

set -uo pipefail

RUN_DIR="${LOCAL_SERVER_RUN_DIR:-/home/raspvery/Claude_Manager/local/logs}"
mkdir -p "$RUN_DIR"

log_file()  { echo "$RUN_DIR/$1.log"; }
pid_file()  { echo "$RUN_DIR/$1.pid"; }

die() { echo "ERROR: $*" >&2; exit 1; }

# 포트를 듣고 있는 프로세스 정보 (없으면 빈 출력)
port_owner() {
  local port="$1"
  ss -ltnpH 2>/dev/null | awk -v p=":$port$" '$4 ~ p {$1=$1; print}'
}

# 같은 작업 디렉터리에서 이미 돌고 있는 개발 서버를 찾는다.
# 두 개가 한 .next/ 를 공유하면 빌드 산출물이 서로 덮어써져 라우트가 깨진다
# (page.js 는 사라지고 manifest 만 남아 ENOENT). 실제로 밟은 사고다.
same_dir_servers() {
  local wd; wd="$(readlink -f "$1")"
  local p pid cwd cmd
  for p in /proc/[0-9]*; do
    pid="${p#/proc/}"
    [ "$pid" = "$$" ] && continue
    cwd="$(readlink -f "$p/cwd" 2>/dev/null)" || continue
    [ "$cwd" = "$wd" ] || continue
    cmd="$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null)"
    # 자기 매칭 회피: 이 스크립트 자신과 그것을 부른 셸의 명령줄에도
    # "next dev …" 문자열이 그대로 들어 있다(pkill -f 와 같은 함정).
    case "$cmd" in
      *devserver.sh*|*shell-snapshots*) continue ;;
    esac
    case "$cmd" in
      *next\ dev*|*next-server*|*vite*|*"npm run dev"*|*nodemon*)
        echo "  pid $pid: $(echo "$cmd" | cut -c1-90)" ;;
    esac
  done
}

cmd_status() {
  local port="${1:?port required}"
  local owner; owner="$(port_owner "$port")"
  if [ -z "$owner" ]; then
    echo "port $port: FREE"
    return 1
  fi
  echo "port $port: IN USE"
  echo "  $owner"
  local pf; pf="$(pid_file "$port")"
  if [ -f "$pf" ] && kill -0 "$(cat "$pf")" 2>/dev/null; then
    echo "  (started by this skill, pid $(cat "$pf") — 'stop $port' 로 정리 가능)"
  else
    echo "  (이 스킬이 띄운 게 아님 — 사용자 서버일 수 있다. 죽이기 전에 반드시 물어볼 것)"
  fi
  return 0
}

cmd_start() {
  local port="${1:?port required}"
  local workdir="${2:?workdir required}"
  shift 2
  local command="$*"
  [ -n "$command" ] || die "command required"
  [ -d "$workdir" ] || die "workdir not found: $workdir"

  if port_owner "$port" | grep -q .; then
    echo "port $port 는 이미 사용 중이다. 기동을 중단한다." >&2
    cmd_status "$port" >&2
    echo "→ 남의 서버를 죽이지 말고 다른 포트를 쓰거나, 사용자에게 확인할 것." >&2
    return 1
  fi

  local dup; dup="$(same_dir_servers "$workdir")"
  if [ -n "$dup" ]; then
    echo "같은 디렉터리에서 이미 개발 서버가 돌고 있다:" >&2
    echo "$dup" >&2
    echo "  workdir: $workdir" >&2
    echo "→ 두 dev 서버가 .next/ 를 공유하면 산출물이 서로 덮어써져 라우트가 깨진다." >&2
    echo "   포트를 바꿔도 소용없다. 기존 것을 쓰거나, 정리 후 하나만 띄울 것." >&2
    return 1
  fi

  local lf pf; lf="$(log_file "$port")"; pf="$(pid_file "$port")"
  : > "$lf"; rm -f "$pf"
  # setsid 는 이미 프로세스 그룹 리더면 fork 한다 → 부모의 $! 는 곧 사라지는 껍데기 PID다.
  # 그래서 자식이 자기 $$(=새 세션 리더 = PGID)를 직접 기록하게 하고, exec 로 셸을 대체한다.
  # 이렇게 해야 npm → next → next-server 자손이 전부 같은 그룹에 묶여 한 번에 정리된다.
  ( cd "$workdir" && setsid bash -c "echo \$\$ > '$pf'; exec $command" >>"$lf" 2>&1 & )
  local pid=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.3
    [ -s "$pf" ] && { pid="$(cat "$pf")"; break; }
  done
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "기동 직후 프로세스가 사라졌다. 로그:" >&2
    tail -30 "$lf" >&2
    return 1
  fi
  echo "started: pid=$pid port=$port"
  echo "  log: $lf"
  echo "→ 'health $port' 로 실제 응답을 확인할 것 (프로세스 생존 != 서비스 정상)"
}

cmd_health() {
  local port="${1:?port required}"
  local path="${2:-/}"
  local timeout="${3:-60}"
  local lf; lf="$(log_file "$port")"
  local start_ts; start_ts="$(date +%s)"

  local url code
  local deadline=$(( start_ts + timeout ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    for host in localhost 127.0.0.1 "[::1]"; do
      url="http://${host}:${port}${path}"
      code="$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$url" 2>/dev/null)"
      if [ -n "$code" ] && [ "$code" != "000" ]; then
        echo "OK  $url -> HTTP $code"
        # 서비스가 뜬 게 확인된 뒤에 localhost 를 다시 확인한다.
        # 폴링 중 단발 실패는 '준비 전'일 뿐이라 바인딩 문제로 단정하면 오판이다.
        if [ "$host" != "localhost" ]; then
          local recheck=""
          for _ in 1 2 3; do
            recheck="$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://localhost:${port}${path}" 2>/dev/null)"
            [ -n "$recheck" ] && [ "$recheck" != "000" ] && break
            sleep 1
          done
          if [ -z "$recheck" ] || [ "$recheck" = "000" ]; then
            echo "  주의: 서비스는 떴는데 localhost 로는 3회 모두 실패했다 ($host 로만 붙음)."
            echo "        localhost 해석 확인: getent ahosts localhost"
            echo "        코드에 하드코딩된 host(127.0.0.1 등)가 있는지 확인할 것."
          fi
        fi
        return 0
      fi
    done
    sleep 2
  done

  echo "FAIL: ${timeout}s 안에 응답 없음 (port $port$path)" >&2
  if [ -f "$lf" ]; then
    echo "--- 헬스체크 시작 이후 로그 ---" >&2
    # 시작 시각 이후에 쌓인 부분만: 시작 전 줄 수를 몰라도 꼬리로 충분
    tail -40 "$lf" >&2
    echo "--- 로그 끝 ---" >&2
    echo "주의: 위 에러가 편집 중 생긴 '지나간' 에러일 수 있다. 소스를 touch 해 재컴파일 후 다시 볼 것." >&2
  fi
  return 1
}

cmd_logs() {
  local port="${1:?port required}"
  local lines="${2:-60}"
  local lf; lf="$(log_file "$port")"
  [ -f "$lf" ] || die "log not found: $lf"
  tail -"$lines" "$lf"
}

cmd_stop() {
  local port="${1:?port required}"
  local pf; pf="$(pid_file "$port")"
  if [ -f "$pf" ]; then
    local pid; pid="$(cat "$pf")"
    if kill -0 "$pid" 2>/dev/null; then
      # start 가 기록한 pid = 새 세션 리더 = PGID. 그룹째 죽여 자손까지 정리한다.
      kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
      sleep 2
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
        sleep 1
      fi
      echo "stopped pid $pid (port $port)"
    else
      echo "pid $pid 는 이미 죽어 있음"
    fi
    rm -f "$pf"
  else
    echo "이 스킬이 띄운 기록이 없다 (port $port)." >&2
    cmd_status "$port" >&2
    echo "→ 사용자 서버일 수 있다. 임의로 죽이지 말 것. 정말 필요하면: fuser -k $port/tcp" >&2
    return 1
  fi

  # 우리가 띄운 서버인데 그룹 kill 이 새어 포트가 남아 있으면, 우리 뒷정리이므로 회수한다.
  if port_owner "$port" | grep -q .; then
    echo "포트 $port 가 아직 잡혀 있어 회수한다 (이 스킬이 띄운 서버의 잔여 프로세스)."
    fuser -k "$port/tcp" 2>/dev/null
    sleep 1
    if port_owner "$port" | grep -q .; then
      echo "주의: 회수 실패. 남은 주인: $(port_owner "$port")" >&2
      return 1
    fi
  fi
  echo "port $port: FREE"
}

case "${1:-}" in
  status) shift; cmd_status "$@" ;;
  start)  shift; cmd_start  "$@" ;;
  health) shift; cmd_health "$@" ;;
  logs)   shift; cmd_logs   "$@" ;;
  stop)   shift; cmd_stop   "$@" ;;
  *)
    sed -n '2,14p' "$0"
    exit 1
    ;;
esac
