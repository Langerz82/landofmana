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


class_name AppearanceWindow
extends ShopWindowBase
## Looks NPC (dialog/appearance/*.js): lists the locked looks you can unlock
## with gems. The preview, switching between unlocked looks and unlocking
## live in the looks preview window (LookPreviewWindow), opened with
## "View Looks" or a look's "Preview" button.


func _init() -> void:
	super._init("LOOKS", Vector2(420, 0))


func build() -> void:
	super.build()
	# Bottom-right of the footer (the gems line expands to fill the left).
	add_footer_button("View Looks", open_look_preview)
	closed.connect(func():
		var w = _look_window()
		if w:
			w.close())


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	super.bind(d, a, inv)
	d.appearances_changed.connect(func():
		if visible:
			_rebuild())


func open() -> void:
	super.open()
	actions.client().send([Types.Messages.CW_REQUEST, 0])


## Gems only (looks are bought with gems).
func _refresh_gold() -> void:
	if data:
		_gold.text = "Gems: %d" % data.gems


func _category() -> String:
	return "armorarcher" if world.player.is_archer() else "armor"


func rows() -> void:
	var cat := _category()
	var n := 0
	for i in range(GameData.appearances.size()):
		var ap: Dictionary = GameData.appearances[i]
		var price: int = int(data.appearance_prices[i]) if i < data.appearance_prices.size() else 0
		if str(ap.get("type", "")) != cat or data.has_appearance(i) or price <= 0:
			continue
		n += 1
		add_row(UiStyle.sprite_frame(str(ap.get("sprite", ""))), str(ap.get("name", "")), "",
			"%d gems" % price, "Preview", _preview.bind(i))
	if n == 0:
		add_info("Loading..." if data.appearance_prices.is_empty() else "You own every look.")


func _preview(i: int) -> void:
	var w = _look_window()
	if w:
		w.open()
		w.show_appearance(i)


## Open the looks preview window on the player's current look.
func open_look_preview() -> void:
	var w = _look_window()
	if w:
		w.open()
		w.show_player()


func _look_window() -> LookPreviewWindow:
	var w: LookPreviewWindow = hud.window("lookpreview") as LookPreviewWindow if hud else null
	if w:
		w.beside = self
	return w
