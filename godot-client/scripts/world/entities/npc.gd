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

class_name Npc
extends Character
## Port of client/js/entity/npcstatic.js and npcmove.js (type decides which).

var npc_quest_id := 0
var dialogue: Array = []
var dialogue_index := 0
var dialogue_delay := 0  # ms per line, from the server (0 = default)
var report_speech_end := false  # tell the server when this WC_SPEECH dialogue ends
var quest = null


func get_sprite_name() -> String:
	if type == Types.EntityType.NPCMOVE:
		return "npc%d_%d" % [1 + (int(kind / 8) % 4), 1 + (kind % 8)]
	return str(GameData.get_npc(kind).get("uid", ""))


func title() -> String:
	var d := GameData.get_npc(kind)
	return str(d.get("title", d.get("name", d.get("uid", ""))))


func sync_view() -> void:
	# NpcMove sprites are drawn half a tile higher (rendererdrawentities.js)
	draw_offset = Vector2(0, -(TS >> 1)) if type == Types.EntityType.NPCMOVE else Vector2.ZERO
	super.sync_view()
