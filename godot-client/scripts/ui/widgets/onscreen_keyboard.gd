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

class_name OnScreenKeyboard
extends PanelContainer
## On-screen keyboard for typing chat with a gamepad. gamepad.gd shows it
## only while chat is open AND the gamepad is the input in use (any real
## keyboard / mouse input hides it again), and routes the buttons:
##   A type the selected key / phrase    B delete (empty line: close chat)
##   X space    Y shift    L1 / R1 letters <-> symbols
##   Start send    Select close
## Everything also works by clicking the keys.

signal send_requested
signal close_requested

## Quick chat: one press puts the phrase into the chat line.
const QUICK := ["Hi!", "Thanks!", "Help!", "Follow me!", "Trade?", "Join my party?", "Good game!", "brb"]
const LETTERS := ["1234567890", "qwertyuiop", "asdfghjkl'", "zxcvbnm,.?"]
const SYMBOLS := ["1234567890", "!@#$%^&*()", "-_=+/\\:;\"'", "<>[]{}|~`,"]
const KEY_W := 34

var target: LineEdit            # the chat line being typed into
var symbols := false
var caps := false
var _rows: VBoxContainer
var _shift_btn: Button
var _layer_btn: Button


func _ready() -> void:
	add_theme_stylebox_override("panel", UiStyle.panel(0.92))
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	add_child(v)
	var quick := HFlowContainer.new()
	quick.add_theme_constant_override("h_separation", 4)
	quick.add_theme_constant_override("v_separation", 4)
	quick.custom_minimum_size.x = KEY_W * 10 + 36
	v.add_child(quick)
	for phrase in QUICK:
		var p: String = phrase
		var b := UiStyle.button(p, func(): type_text(p))
		b.focus_mode = Control.FOCUS_ALL
		quick.add_child(b)
	_rows = VBoxContainer.new()
	_rows.add_theme_constant_override("separation", 4)
	v.add_child(_rows)
	var special := HBoxContainer.new()
	special.add_theme_constant_override("separation", 4)
	special.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(special)
	_shift_btn = _special("Shift", toggle_caps, special)
	_layer_btn = _special("#+=", toggle_layer, special)
	_special("Space", func(): type_text(" "), special, KEY_W * 3)
	_special("Del", func(): backspace(), special)
	_special("Send", func(): send_requested.emit(), special)
	_special("Close", func(): close_requested.emit(), special)
	var hint := UiStyle.label("A type   B delete   X space   Y shift   L1/R1 symbols   Start send   Select close", 11, Color(1, 1, 1, 0.7))
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(hint)
	_build_keys()


func _special(text: String, cb: Callable, parent: Control, w := 0) -> Button:
	var b := UiStyle.button(text, cb, w)
	b.focus_mode = Control.FOCUS_ALL
	parent.add_child(b)
	return b


## The key rows for the current layer / case. The focused key's place is kept
## when the rows are rebuilt (shift, layer switch).
func _build_keys() -> void:
	var keep := Vector2i(-1, -1)
	var f := get_viewport().gui_get_focus_owner() if is_inside_tree() else null
	for r in range(_rows.get_child_count()):
		var row := _rows.get_child(r)
		for c in range(row.get_child_count()):
			if row.get_child(c) == f:
				keep = Vector2i(c, r)
	for row in _rows.get_children():
		_rows.remove_child(row)
		row.queue_free()
	var layout: Array = SYMBOLS if symbols else LETTERS
	for r in range(layout.size()):
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 4)
		h.alignment = BoxContainer.ALIGNMENT_CENTER
		_rows.add_child(h)
		var line: String = layout[r]
		for ch in line:
			var t: String = ch.to_upper() if caps and not symbols else ch
			var b := UiStyle.button(t, func(): type_text(t), KEY_W)
			b.focus_mode = Control.FOCUS_ALL
			h.add_child(b)
	if keep.x >= 0:
		var row := _rows.get_child(keep.y)
		row.get_child(mini(keep.x, row.get_child_count() - 1)).grab_focus()
	_shift_btn.toggle_mode = true
	_shift_btn.set_pressed_no_signal(caps)
	_layer_btn.text = "abc" if symbols else "#+="


## Where the gamepad focus starts: the first letter key ("q").
func first_key() -> Control:
	if _rows.get_child_count() > 1:
		return _rows.get_child(1).get_child(0)
	return _rows.get_child(0).get_child(0)


func type_text(t: String) -> void:
	if target == null:
		return
	target.insert_text_at_caret(t)


## Delete the character before the caret. False when the line is empty.
func backspace() -> bool:
	if target == null or target.text.is_empty():
		return false
	var col := target.caret_column
	if col > 0:
		target.delete_text(col - 1, col)
		target.caret_column = col - 1
	return true


func toggle_caps() -> void:
	caps = not caps
	_build_keys()


func toggle_layer() -> void:
	symbols = not symbols
	_build_keys()
