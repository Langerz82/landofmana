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

class_name AchievementWindow
extends GameWindow
## Achievements log (achievementhandler.js).

var data: PlayerData
var _list: VBoxContainer


func _init() -> void:
	super._init("ACHIEVEMENTS", Vector2(420, 0))


func build() -> void:
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	flex_scroll = scroll
	flex_height = 260
	content.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)


func bind(d: PlayerData) -> void:
	data = d
	d.achievements_changed.connect(func():
		if visible:
			refresh())


func refresh() -> void:
	for c in _list.get_children():
		c.queue_free()
	for a in data.achievements:
		var row := HBoxContainer.new()
		var l := UiStyle.label(str(a.summary), 14)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		var pct := 0
		if int(a.objectCount) > 0:
			pct = int(float(a.count) / float(a.objectCount) * 100)
		row.add_child(UiStyle.label("%d%%" % pct, 14, Color(0.6, 1, 0.6) if pct >= 100 else Color.WHITE))
		_list.add_child(row)
	if data.achievements.is_empty():
		_list.add_child(UiStyle.label("No achievements yet.", 14, Color(1, 1, 1, 0.7)))
