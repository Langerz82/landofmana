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


class_name SoundSettingsWindow
extends SettingsWindow
## Sound Settings (opened from Settings -> "Sound Settings"): sound effects and
## music on / off, and a volume for each (0-100 %, default 100 %). Uses the
## row helpers of SettingsWindow; saved in user://settings.cfg like the other
## settings.


func _init() -> void:
	super._init()
	title = "SOUND SETTINGS"


func build() -> void:
	_begin_rows()
	_toggle("Sound", "audio", "sfx", true, func(v): world.audio.sfx_on = v)
	_volume("Sound volume", world.audio.sfx_volume, func(v): world.audio.set_sfx_volume(v))
	content.add_child(HSeparator.new())
	_toggle("Music", "audio", "music", true, func(v):
		if world.audio.music_on != v:
			world.audio.toggle_music(world.map_index))
	_volume("Music volume", world.audio.music_volume, func(v): world.audio.set_music_volume(v))
	content.add_child(HSeparator.new())
	content.add_child(UiStyle.button("Back to Settings", back_to_settings))


## A 0-100 % volume slider; `apply` gets the volume as 0..1.
func _volume(text: String, current: float, apply: Callable) -> void:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	var slider := HSlider.new()
	slider.min_value = 0
	slider.max_value = 100
	slider.step = 5
	slider.value = roundf(current * 100.0)
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var pct := UiStyle.label("%d%%" % int(slider.value), 14)
	pct.custom_minimum_size = Vector2(44, 0)
	pct.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	slider.value_changed.connect(func(v: float):
		pct.text = "%d%%" % int(v)
		apply.call(v / 100.0))
	h.add_child(slider)
	h.add_child(pct)
	_row(text, h)


func back_to_settings() -> void:
	close()
	hud.open_window("settings")
