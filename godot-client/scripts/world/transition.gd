# This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
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

class_name Transition
extends RefCounted
## Port of client/js/transition.js. Steps an entity one pixel at a time,
## |mod_value| times per game tick, until the update function returns true.

var in_progress := false
var mod_value := 0
var update_fn: Callable = Callable()
var stop_fn: Callable = Callable()
var obj = null


func _init(o = null) -> void:
	obj = o


func start(update_function: Callable, stop_function: Callable, value: int) -> void:
	update_fn = update_function
	stop_fn = stop_function
	mod_value = value
	in_progress = true


func step() -> void:
	if not in_progress or mod_value == 0 or not update_fn.is_valid():
		return
	var count := absi(mod_value)
	var m := 1 if mod_value > 0 else -1
	for _i in range(count):
		if not in_progress:
			stop()
			break
		if update_fn.call(obj, m):
			stop()
			break


func stop() -> void:
	if stop_fn.is_valid():
		stop_fn.call(obj)
	in_progress = false
