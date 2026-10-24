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

class_name StoreWindow
extends ShopWindowBase
## NPC shop (dialog/store/*.js): consumables, armor and weapons to buy, plus
## SELL which opens the inventory in sell mode.

var min_level := 1
var max_level := 100


func _init() -> void:
	super._init("SHOPS", Vector2(420, 0))


func build() -> void:
	super.build()
	set_tabs(["CONSUME", "ARMOR", "WEAPON"])
	add_footer_button("SELL", func():
		inventory_window.open_mode(ItemActions.Mode.SELL, self)
		close())


func open_levels(mn: int, mx: int) -> void:
	min_level = mn
	max_level = mx
	tab = 0
	open()


func rows() -> void:
	var item_type := tab + 1   # 1 consumables, 2 armor, 3 weapons
	var items := ItemTypes.get_item_list(item_type, min_level, max_level)
	for it in items:
		var kind := int(it.kind)
		if item_type == 1 and not ItemTypes.is_consumable(kind):
			continue
		if item_type == 2 and not ItemTypes.is_armor(kind):
			continue
		if item_type == 3 and not ItemTypes.is_weapon(kind):
			continue
		var room := PlayerData.make_room(0, kind, 1, 900, 900, 0)
		var desc := ItemTypes.info_text(room)
		var title := ItemTypes.name_of(kind)
		if ItemTypes.is_consumable(kind):
			title = ("x%d " % int(it.buyCount) if int(it.buyCount) > 0 else "") + desc
			desc = ""
		add_row(ItemTypes.icon(kind), title, desc, ItemTypes.short_number(ItemTypes.get_buy_price(kind)),
			"Buy", actions.buy.bind(item_type, kind), null, ItemTypes.info_text(room))
	if items.is_empty():
		add_info("Nothing for sale here.")
