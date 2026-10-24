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
## Looks NPC (dialog/appearance/*.js), two tabs:
##  UNLOCK     - the locked looks you can buy with gems; "Preview" shows one
##               on your character in the APPEARANCE tab.
##  APPEARANCE - your character at its in-game size, switching between your
##               unlocked looks (AppearanceDialog.changeLookArmor()), or a
##               previewed locked look with its unlock button.
## The footer shows the gem count.

const TAB_UNLOCK := 0
const TAB_APPEARANCE := 1

var preview: SpritePreview
var _look_panel: VBoxContainer
var _name_label: Label
var _status_label: Label
var _cycle_row: HBoxContainer
var _unlock_btn: Button
var _current_btn: Button
var _owned: Array = []
var _owned_i := 0
var _appearance_index := -1   # -1: showing the player's current look


func _init() -> void:
	super._init("LOOKS", Vector2(420, 0))


func build() -> void:
	super.build()
	set_tabs(["UNLOCK", "APPEARANCE"])
	_build_look_panel()


func _build_look_panel() -> void:
	_look_panel = VBoxContainer.new()
	_look_panel.add_theme_constant_override("separation", 6)
	_look_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_look_panel.visible = false
	content.add_child(_look_panel)
	content.move_child(_look_panel, list_scroll.get_index() + 1)   # above the gems footer
	_name_label = UiStyle.label("", 18, Color(1, 1, 0.6), UiStyle.KOMIKA)
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_look_panel.add_child(_name_label)
	_status_label = UiStyle.label("", 13, Color(1, 1, 1, 0.7))
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_look_panel.add_child(_status_label)
	preview = SpritePreview.new()
	preview.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	preview.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_look_panel.add_child(preview)
	_cycle_row = button_row([UiStyle.button("< Prev", func(): _cycle(-1), 80),
		UiStyle.button("Next >", func(): _cycle(1), 80)])
	_cycle_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_look_panel.add_child(_cycle_row)
	_unlock_btn = UiStyle.button("Unlock this look", _unlock_previewed, 140)
	_current_btn = UiStyle.button("Show my look", show_player, 110)
	var row := button_row([_unlock_btn, _current_btn])
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	_look_panel.add_child(row)


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	super.bind(d, a, inv)
	d.appearances_changed.connect(func():
		_collect_owned()
		if not visible:
			return
		if tab == TAB_UNLOCK:
			_rebuild()
		elif _appearance_index >= 0 and data.has_appearance(_appearance_index):
			show_player()   # just unlocked: it is one of yours now
		elif _appearance_index >= 0:
			show_appearance(_appearance_index)
		else:
			show_player())


func open() -> void:
	tab = TAB_UNLOCK
	_appearance_index = -1
	_collect_owned()
	super.open()
	actions.client().send([Types.Messages.CW_REQUEST, 0])


## Gems only (looks are bought with gems).
func _refresh_gold() -> void:
	if data:
		_gold.text = "Gems: %d" % data.gems


func tab_changed(i: int) -> void:
	var looks := i == TAB_APPEARANCE
	list_scroll.visible = not looks
	_look_panel.visible = looks
	# The list takes the spare height on UNLOCK; the look panel on APPEARANCE.
	flex_scroll = null if looks else list_scroll
	if looks:
		show_player()
	_queue_fit()


func _category() -> String:
	return "armorarcher" if world.player.is_archer() else "armor"


func _collect_owned() -> void:
	_owned.clear()
	if data == null or world == null or world.player == null:
		return
	var cat := _category()
	for i in range(GameData.appearances.size()):
		if str(GameData.appearances[i].get("type", "")) == cat and data.has_appearance(i):
			_owned.append(i)


func rows() -> void:
	if tab != TAB_UNLOCK:
		return
	var cat := _category()
	var n := 0
	for i in range(GameData.appearances.size()):
		var ap: Dictionary = GameData.appearances[i]
		var price := _price(i)
		if str(ap.get("type", "")) != cat or data.has_appearance(i) or price <= 0:
			continue
		n += 1
		add_row(UiStyle.sprite_frame(str(ap.get("sprite", ""))), str(ap.get("name", "")), "",
			"%d gems" % price, "Preview", _preview.bind(i))
	if n == 0:
		add_info("Loading..." if data.appearance_prices.is_empty() else "You own every look.")


## UNLOCK row "Preview": show that look on the character in APPEARANCE.
func _preview(i: int) -> void:
	_on_tab(TAB_APPEARANCE)
	show_appearance(i)


## Show the player's current armor look and weapon.
func show_player() -> void:
	_appearance_index = -1
	var p = world.player if world else null
	if p == null:
		return
	var armor = p.get_sprite(0)
	var weapon = p.get_sprite(1)
	var armor_id: String = armor.id if armor else ""
	_set_preview(armor_id, weapon.id if weapon else "")
	_name_label.text = armor_id
	for j in range(_owned.size()):
		if GameData.get_appearance_sprite(_owned[j]) == armor_id:
			_owned_i = j
			_name_label.text = str(GameData.appearances[_owned[j]].get("name", ""))
	_status_label.text = "Your current look"
	_cycle_row.visible = true
	_unlock_btn.visible = false
	_current_btn.visible = false


## Show the player wearing locked appearance i with their current weapon.
func show_appearance(i: int) -> void:
	_appearance_index = i
	var p = world.player if world else null
	var weapon = p.get_sprite(1) if p else null
	_set_preview(GameData.get_appearance_sprite(i), weapon.id if weapon else "")
	_name_label.text = str(GameData.appearances[i].get("name", ""))
	var price := _price(i)
	_status_label.text = "Previewing  -  %d gems" % price if price > 0 else "Previewing"
	_cycle_row.visible = false
	_unlock_btn.visible = price > 0
	_current_btn.visible = true


## Draw the sprites at the size the player has in the game world right now:
## sprites are drawn at their logical size times the camera zoom
## (World.game_scale, which follows Settings -> Zoom), and windows sit in the
## HUD, which is scaled by the UI scale -- so undo that here.
func _set_preview(armor_id: String, weapon_id: String) -> void:
	var zoom: float = world.game_scale if world else World.BASE_SCALE
	preview.scale_px = zoom / maxf(UiStyle.ui_scale, 0.01)
	var box := Vector2.ZERO
	for id in [armor_id, weapon_id]:
		var def = GameData.get_sprite(id) if id != "" else null
		if def != null:
			box = box.max(Vector2(def.width, def.height) * preview.scale_px)
	preview.custom_minimum_size = (box + Vector2(16, 16)).max(Vector2(120, 120)).ceil()
	preview.set_sprites(armor_id, weapon_id)


func _price(i: int) -> int:
	return int(data.appearance_prices[i]) if data and i < data.appearance_prices.size() else 0


## AppearanceDialog.changeLookArmor()
func _cycle(step: int) -> void:
	if _owned.is_empty():
		return
	_owned_i = posmod(_owned_i + step, _owned.size())
	var id: int = _owned[_owned_i]
	world.player.set_sprite_by_index(0, id)
	actions.client().send([Types.Messages.CW_LOOKUPDATE, 0, id])
	show_player()


func _unlock_previewed() -> void:
	var i := _appearance_index
	if i < 0:
		return
	var price := _price(i)
	hud.confirm(GameData.tr_lang("SHOP_UNLOCK_CONFIRM", [price]), func(ok: bool):
		if ok:
			actions.client().send([Types.Messages.CW_APPEARANCEUNLOCK, i, price]))
