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

extends "res://tests/play_test.gd"
## Checks that mobs end up where the server's WC_MOVEPATH said they would.

var last_end: Dictionary = {}
var hooked := false


func _process(_d: float) -> void:
	if world == null:
		return
	if not hooked and world.client:
		hooked = true
		var orig: Callable = world.client.handlers[Types.Messages.WC_MOVEPATH]
		world.client.on(Types.Messages.WC_MOVEPATH, func(d):
			var id := int(d[2])
			last_end[id] = [d[d.size() - 1], Time.get_ticks_msec()]
			orig.call(d))
	if world.map_status < 2 or not world.started:
		return
	var now := Time.get_ticks_msec()
	if phase == 0:
		t0 = now
		phase = 1
	elif phase == 1 and now - t0 > 12000:
		var ok := 0
		var bad := 0
		for id in last_end:
			var e = world.entities.get(id)
			if e == null or now - last_end[id][1] < 2500:
				continue
			var endp = last_end[id][0]
			if e.x == int(endp[0]) and e.y == int(endp[1]):
				ok += 1
			else:
				bad += 1
				print("MISMATCH id=", id, " at ", e.x, ",", e.y, " expected ", endp, " moving=", e.is_moving(), " path=", e.move_path, " o=", e.orientation)
		print("mob sync ok=", ok, " bad=", bad)
		get_tree().quit(0)
