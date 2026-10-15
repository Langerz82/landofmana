# This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2023-2026 Joshua Langley and contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. See the LICENSE file in the project root,
# or <https://www.gnu.org/licenses/>.

extends Node
## Drives the real UI (Main scene): login screen -> character select -> world.
## Run under a display: godot --rendering-driver opengl3 res://tests/ui_flow_test.tscn -- --shots=DIR

var main: Node
var shots := ""
var user := "uitester"
var pw := "pw12345"
var stage := 0
var t0 := 0
var tried_register := false


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.substr(8)
		if a.begins_with("--user="): user = a.substr(7)
	main = load("res://scripts/main.gd").new()
	add_child(main)
	get_tree().create_timer(60).timeout.connect(func(): print("TIMEOUT stage ", stage); get_tree().quit(1))


func _process(_d: float) -> void:
	var now := Time.get_ticks_msec()
	match stage:
		0:
			var l = main.login
			if l and l._ready_for_login:
				stage = -1
				await _shot("ui_01_login")
				l._user.text = user
				l._pass.text = pw
				l._try_login(false)
				t0 = now
				stage = 1
		1:
			var l = main.login
			if l == null:
				return
			if l._player_box.visible:
				stage = -1
				if l.uc.players.is_empty():
					l._new_name.text = user.capitalize().replace(" ", "")
					await _shot("ui_02_select")
					l._create()
				else:
					await _shot("ui_02_select")
					l._play()
				stage = 2
			elif not tried_register and l._status.text == GameData.tr_lang("LOGIN_INVALID"):
				tried_register = true
				l._try_login(true)
		2:
			if main.world and main.world.started and main.world.map_status >= 2:
				t0 = now
				stage = 3
		3:
			if now - t0 > 1500:
				stage = 4
				await _shot("ui_03_world")
				print("UI FLOW OK")
				get_tree().quit(0)


func _shot(n: String) -> void:
	if shots == "":
		return
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(shots + "/" + n + ".png")
