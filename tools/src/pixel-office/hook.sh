#!/bin/sh
# Pixel Office hook launcher (design 1.4, 6.2; REQ-110). Claude Code gives the hook
# event as JSON on stdin; this script takes only a Node 22 at or above the floor
# 22.23.4, asked by its --version, and runs hook.js with the same stdin. A candidate
# below the floor, of another major or that cannot start is skipped for the next one.
# It prints nothing and ends with exit code 0 when no candidate is left: the event is
# then lost, and the session does not notice.

# The floor of tools/: the same value as `engines` of tools/package.json (REQ-110).
node_floor=22.23.4

# State directory: the same rule as resolveStateDir in state-dir.js.
dir=${SAI_PIXEL_OFFICE_DIR:-${HOME:-}/.sai-pixel-office}
# Directory of this script, without a call to dirname.
case "$0" in
  */*) here=${0%/*} ;;
  *) here=. ;;
esac

# Sets n1 n2 n3 to the three parts of <major>.<minor>.<patch> and returns 0; returns 1
# for any other text: empty, a character other than a digit or a dot, fewer or more
# than three parts, an empty part, a leading zero, a part of ten characters or more
# (the shape of meetsNodeFloor in tools/src/node-floor.js).
split3() {
  case "$1" in
    "" | *[!0-9.]*) return 1 ;;
  esac
  rest=$1
  n1=${rest%%.*}
  [ "$n1" != "$rest" ] || return 1
  rest=${rest#*.}
  n2=${rest%%.*}
  [ "$n2" != "$rest" ] || return 1
  n3=${rest#*.}
  case "$n3" in
    *.*) return 1 ;;
  esac
  for part in "$n1" "$n2" "$n3"; do
    case "$part" in
      "") return 1 ;;
      0) ;;
      0*) return 1 ;;
      ??????????*) return 1 ;;
    esac
  done
  return 0
}

# Returns 0 when "<binary> --version" ends with code 0 and prints v<major>.<minor>.<patch>
# with the major of the floor and (minor, patch) at or above the floor's, compared as
# numbers; else 1. It asks once, with stdin closed (the event on stdin is for hook.js)
# and stderr dropped, and prints nothing.
node_ok() {
  v=$("$1" --version < /dev/null 2> /dev/null) || return 1
  case "$v" in
    v*) ;;
    *) return 1 ;;
  esac
  split3 "$node_floor" || return 1
  f1=$n1 f2=$n2 f3=$n3
  split3 "${v#v}" || return 1
  [ "$n1" -eq "$f1" ] || return 1
  [ "$n2" -gt "$f2" ] && return 0
  [ "$n2" -eq "$f2" ] && [ "$n3" -ge "$f3" ] && return 0
  return 1
}

# 1. The Node the server runs under: the server writes its path at each start; it is
# used only when it is at or above the floor.
np=
{ IFS= read -r np; } 2>/dev/null < "$dir/node-path"
if [ -n "$np" ] && [ -f "$np" ] && [ -x "$np" ] && node_ok "$np"; then
  exec "$np" "$here/hook.js"
fi

# 2. node from PATH, if it is at or above the floor (not whatever version is the default).
p=$(command -v node 2>/dev/null)
if [ -n "$p" ] && [ -x "$p" ] && node_ok "$p"; then
  exec "$p" "$here/hook.js"
fi

# 3. Directories from SAI_NODE_FALLBACKS (colon separated), each at or above the floor.
fallbacks=${SAI_NODE_FALLBACKS-/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin}
old_ifs=$IFS
IFS=:
set -f
for d in $fallbacks; do
  if [ -n "$d" ] && [ -x "$d/node" ] && node_ok "$d/node"; then
    IFS=$old_ifs
    set +f
    exec "$d/node" "$here/hook.js"
  fi
done
IFS=$old_ifs
set +f

# 4. No candidate at or above the floor: the event is lost.
exit 0
