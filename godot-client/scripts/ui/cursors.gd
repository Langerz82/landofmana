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

class_name Cursors
## Mouse cursors from img/3/misc/cursors.png (game/gamecursor.js):
## hand, sword (attack), loot and talk.

const SHEET := "res://assets/img/3/misc/cursors.png"
const NAMES := ["hand", "sword", "loot", "talk"]

static var _images: Dictionary = {}
static var _current := ""


static func set_shape(shape: String) -> void:
	if shape == _current or DisplayServer.get_name() == "headless":
		return
	_current = shape
	if _images.is_empty():
		var tex: Texture2D = load(SHEET)
		if tex == null:
			return
		var img := tex.get_image()
		var cell := img.get_height()
		for i in range(NAMES.size()):
			_images[NAMES[i]] = img.get_region(Rect2i(i * cell, 0, cell, cell))
	var im: Image = _images.get(shape)
	if im:
		Input.set_custom_mouse_cursor(im, Input.CURSOR_ARROW, Vector2(4, 4))
