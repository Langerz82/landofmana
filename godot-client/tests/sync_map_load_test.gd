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

extends "res://tests/map_transition_test.gd"
## Map loading without threads (what a Web export without "Thread Support"
## gets): maps load on the main thread, behind the black screen.
## Run: godot res://tests/sync_map_load_test.tscn [-- --shots=DIR]


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	check("desktop build can use threads", world.can_use_threads())
	world.sync_map_loading = true
	world.map_cache.clear()
	await wait(300)
	await watch_teleport("sync_to_town", func(): world.warp_to_town())
	check("no loader thread used", world._loading_thread == null)
	check("map drawn", world.current_map != null and world.current_map.loaded and world.map_renderer.bg_layers[0].get_used_cells().size() > 0)
	var door = null
	for d in world.current_map.doors:
		if d.tmap != world.map_index:
			door = d
			break
	if door:
		world.map_cache.clear()
		await watch_teleport("sync_door", func(): world.teleport_maps(door.tmap, door.tx, door.ty, door.id))
		check("door map loaded", world.map_index == door.tmap and world.current_map.map_index == door.tmap)
	_report()
