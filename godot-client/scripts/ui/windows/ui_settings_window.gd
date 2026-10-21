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

class_name UiSettingsWindow
extends SettingsWindow
## UI Settings (opened from Settings -> "UI Settings"): font size, UI scale,
## health bar speed, shortcut bar layout and (at the bottom) menu / button / panel colours. Uses the row helpers of SettingsWindow;
## saved in user://settings.cfg like the other settings.


func _init() -> void:
	super._init()
	title = "UI SETTINGS"


func build() -> void:
	_begin_rows()
	# Font size: a scale for all text; 1 = normal, above 1 bigger, below 1 smaller.
	var fsb := SpinBox.new()
	fsb.min_value = UiStyle.FONT_SCALE_MIN
	fsb.max_value = UiStyle.FONT_SCALE_MAX
	fsb.step = 0.05
	fsb.value = UiStyle.font_scale
	fsb.tooltip_text = "1 = normal size, above 1 = bigger, below 1 = smaller (default %.1f)" % UiStyle.default_font_scale()
	fsb.value_changed.connect(func(v: float):
		Config.set_setting("ui", "fontscale", snappedf(v, 0.01))
		UiStyle.font_scale = v
		UiStyle.apply_font_scale(get_tree())
		hud.relayout_windows.call_deferred())
	_row("Font size", fsb)
	# UI scale: size of the whole interface (panels, windows, icons and text).
	var usb := SpinBox.new()
	usb.min_value = UiStyle.UI_SCALE_MIN
	usb.max_value = UiStyle.UI_SCALE_MAX
	usb.step = 0.05
	usb.value = UiStyle.ui_scale
	usb.tooltip_text = "Size of the whole interface: 1 = normal, %.1f to %.1f" % [UiStyle.UI_SCALE_MIN, UiStyle.UI_SCALE_MAX]
	usb.value_changed.connect(func(v: float):
		Config.set_setting("ui", "uiscale", snappedf(v, 0.01))
		UiStyle.ui_scale = clampf(v, UiStyle.UI_SCALE_MIN, UiStyle.UI_SCALE_MAX)
		hud.apply_ui_scale())
	_row("UI scale", usb)
	var hb := OptionButton.new()
	var cur_ms := SmoothBar.duration_ms()
	for i in range(BAR_SPEEDS.size()):
		hb.add_item(BAR_SPEEDS[i][0])
		if int(BAR_SPEEDS[i][1]) == cur_ms:
			hb.select(i)
	hb.item_selected.connect(func(i): Config.set_setting("ui", "healthbarms", BAR_SPEEDS[i][1]))
	_row("Health bars", hb)
	var sc := OptionButton.new()
	var cur_sc := str(Config.get_setting("ui", "shortcutstyle", UiStyle.default_shortcut_style()))
	for i in range(SHORTCUT_STYLES.size()):
		sc.add_item(SHORTCUT_STYLES[i][0])
		if SHORTCUT_STYLES[i][1] == cur_sc:
			sc.select(i)
	sc.item_selected.connect(func(i):
		Config.set_setting("ui", "shortcutstyle", SHORTCUT_STYLES[i][1])
		hud.apply_shortcut_style())
	_row("Shortcuts", sc)
	content.add_child(HSeparator.new())
	_color("Menu color", "menucolor", "#38A7DF")
	_color("Button color", "buttoncolor", "#F7B132")
	_color("Panel border", "panelborder", UiStyle.DEFAULT_PANEL_BORDER)
	_color("Panel background", "panelbg", UiStyle.DEFAULT_PANEL_BG, true)
	content.add_child(UiStyle.button("Reset colours", _reset_colors))
	content.add_child(HSeparator.new())
	content.add_child(UiStyle.button("Back to Settings", back_to_settings))


func back_to_settings() -> void:
	close()
	hud.open_window("settings")
