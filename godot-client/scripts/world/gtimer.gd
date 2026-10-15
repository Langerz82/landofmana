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

class_name GTimer
extends RefCounted
## Port of client/js/timer.js. NOTE: is_over() restarts the timer when it
## returns true, exactly like the JS version (callers rely on that).

var duration := 0
var last_time := 0


func _init(d: int = 0, start_time: int = 0) -> void:
	duration = d
	restart(start_time)


static func now() -> int:
	return Time.get_ticks_msec()


func restart(start_time: int = 0) -> void:
	last_time = start_time if start_time != 0 else now()


func is_over(time: int = 0) -> bool:
	if time == 0:
		time = now()
	if last_time == 0 or time - last_time > duration:
		last_time = time
		return true
	return false


func get_ratio(time: int) -> float:
	return minf(float(time - last_time) / maxf(duration, 1), 1.0)
