#!/bin/sh
# Pixel Office hook launcher (design 1.4, 6.2). Claude Code gives the hook
# event as JSON on stdin; this script finds Node 22 and runs hook.js with the
# same stdin. It prints nothing and ends with exit code 0 when no Node 22 is
# found: the event is then lost, and the session does not notice.

# State directory: the same rule as resolveStateDir in state-dir.js.
dir=${SAI_PIXEL_OFFICE_DIR:-${HOME:-}/.sai-pixel-office}
# Directory of this script, without a call to dirname.
case "$0" in
  */*) here=${0%/*} ;;
  *) here=. ;;
esac

# 1. The Node the server runs under: the server writes its path at each start.
np=
{ IFS= read -r np; } 2>/dev/null < "$dir/node-path"
if [ -n "$np" ] && [ -f "$np" ] && [ -x "$np" ]; then
  exec "$np" "$here/hook.js"
fi

node_is_22() {
  v=$("$1" --version 2>/dev/null) || return 1
  case "$v" in
    v22.*) return 0 ;;
  esac
  return 1
}

# 2. node from PATH, if it is Node 22 (not whatever version is the default).
p=$(command -v node 2>/dev/null)
if [ -n "$p" ] && [ -x "$p" ] && node_is_22 "$p"; then
  exec "$p" "$here/hook.js"
fi

# 3. Directories from SAI_NODE_FALLBACKS (colon separated).
fallbacks=${SAI_NODE_FALLBACKS-/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin}
old_ifs=$IFS
IFS=:
set -f
for d in $fallbacks; do
  if [ -n "$d" ] && [ -x "$d/node" ] && node_is_22 "$d/node"; then
    IFS=$old_ifs
    set +f
    exec "$d/node" "$here/hook.js"
  fi
done
IFS=$old_ifs
set +f

# 4. No Node 22: the event is lost.
exit 0
