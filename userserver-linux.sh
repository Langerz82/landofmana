#!/bin/bash

tmux kill-session -t rro2-user
cd userserver
npm install -d
npm update

# Node core's own internal debug sections (comma-separated, exact names,
# optional trailing '*' wildcard, case-insensitive) -- e.g. "redis" or
# "fs,redis". Leave empty to disable. Do NOT put "timer", "stream", or a
# bare "*" in here -- those are the sections that print the noisy
# "TIMER ..."/"STREAM ..." lines from lib/internal/timers.js and
# lib/internal/streams/*.
NODE_DEBUG_SECTIONS=""

# NOTE: no longer `> console.log` here -- main.js writes console.log
# itself now (see its console.log/info/warn/error patch), so this process's
# real stdout/stderr stay attached to the tmux pane and `tmux attach -t
# rro2-user` shows live output again. Redirecting here too used to open a
# SECOND, independent writer to the exact same console.log file underneath
# the one main.js already owns -- two file descriptors racing to write the
# same path is what was producing garbled/incomplete-looking output there.
#
# Node core itself prints internal diagnostics straight to stderr whenever
# NODE_DEBUG names a matching section (see NODE_DEBUG_SECTIONS above).
# tmux's server inherits/caches whatever environment was around when it was
# first started, so a NODE_DEBUG set in some earlier shell can otherwise
# leak into every session tmux creates from then on -- setting it explicitly
# right here makes this launch immune to that regardless of what the
# surrounding shell/tmux server happens to have.
tmux new -d -s rro2-user "NODE_DEBUG=$NODE_DEBUG_SECTIONS node ./js/main"
