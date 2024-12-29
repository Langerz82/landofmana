#!/bin/bash

tmux kill-session -t rro2-game
npm install -d
npm update
cd gameserver
tmux new -d -s rro2-game "node --inspect-brk=0.0.0.0:9229 js/main > console.log"
