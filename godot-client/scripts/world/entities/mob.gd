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

class_name Mob
extends Character
## Port of client/js/entity/mob.js

var data: Dictionary = {}
var is_aggressive := false


func setup_kind(k: int, lvl: int) -> void:
	kind = k
	data = GameData.get_mob(k)
	var base_idle: int = int(data.get("idleSpeed", 1000))
	idle_speed = randi_range(int(base_idle * 2 / 3), int(base_idle * 4 / 3))
	level = lvl if lvl > 0 else int(data.get("level", 1))
	attack_range = int(data.get("attackRange", 1))
	is_aggressive = bool(data.get("isAggressive", false))
	set_move_rate(int(data.get("moveSpeed", 500)))
	set_attack_rate(int(data.get("attackRate", 1000)))
	var hp := int(data.get("hp", 200)) * maxi(level, 1)
	stats.hp = hp
	stats.hpMax = hp


func get_sprite_name() -> String:
	return str(data.get("spriteName", ""))
