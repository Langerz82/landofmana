#!/bin/bash

tmux kill-session -t rro2-game
npm install -d
npm update
cd gameserver

# Node core's own internal debug sections (comma-separated, exact names,
# optional trailing '*' wildcard, case-insensitive) -- e.g. "redis" or
# "fs,redis". Leave empty to disable. Do NOT put "timer", "stream", or a
# bare "*" in here -- those are the sections that print the noisy
# "TIMER ..."/"STREAM ..." lines from lib/internal/timers.js and
# lib/internal/streams/*.
NODE_DEBUG_SECTIONS=""

# NOTE: no longer `> console.log` here -- see userserver-linux.sh's
# identical NOTE for why (main.js now writes console.log itself; the shell
# redirection was both hiding tmux's live output and racing main.js's own
# writer on the same file).
#
# NODE_DEBUG_SECTIONS is set explicitly rather than left to inherit from
# tmux's cached environment -- see userserver-linux.sh's NOTE.
tmux new -d -s rro2-game "NODE_DEBUG=$NODE_DEBUG_SECTIONS node ./js/main"
