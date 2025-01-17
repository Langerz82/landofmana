#!/bin/bash

tmux kill-session -t rro2-game
npm install -d
npm update
cd gameserver
tmux new -d -s rro2-game "node ./js/main > console.log"
