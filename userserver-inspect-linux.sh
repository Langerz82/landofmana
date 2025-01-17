#!/bin/bash

tmux kill-session -t rro2-user
cd userserver
npm install -d
npm update
tmux new -d -s rro2-user "node --inspect-brk=0.0.0.0:9228 js/main > console.log"
