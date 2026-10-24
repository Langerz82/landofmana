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

class_name BankWindow
extends GameWindow
## Bank (dialog/bank/*.js, bankhandler.js): 96 slots (5 across, scrolling), gold transfer and the
## "STORE" button that opens the inventory in bank mode.

## Bank is 5 across and as many rows down as BANK_SIZE needs (96 -> 20).
const COLUMNS := 5
const SLOT_SEP := 2
## Rows always shown; more are shown when the screen has room, the rest are
## reached with the scroll bar on the right.
const MIN_ROWS := 2
## Wide enough to grab with a finger on a phone.
const SCROLLBAR_WIDTH := 18

var data: PlayerData
var actions: ItemActions
var inventory_window: InventoryWindow
var slots: Array = []
var selected := -1
var _gold: Label
var _scroll: ScrollContainer
var _grid: GridContainer


func _init() -> void:
	super._init("BANK", Vector2(420, 0))


func build() -> void:
	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_ALWAYS
	_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scroll.follow_focus = true   # gamepad / keyboard focus scrolls the slot into view
	_scroll.get_v_scroll_bar().custom_minimum_size.x = SCROLLBAR_WIDTH
	content.add_child(_scroll)
	_grid = GridContainer.new()
	_grid.columns = COLUMNS
	# Slots expand their columns (keeping their own size, centred), so the
	# 5 columns spread evenly across the full window width.
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", SLOT_SEP)
	_grid.add_theme_constant_override("v_separation", SLOT_SEP)
	_scroll.add_child(_grid)
	for i in range(PlayerData.BANK_SIZE):
		var s := ItemSlot.new()
		s.store_type = PlayerData.Store.BANK
		s.index = i
		s.accepts = ["item"]
		s.pressed.connect(_on_pressed)
		s.activated.connect(func(sl: ItemSlot): _retrieve(sl.index))
		s.secondary.connect(func(sl: ItemSlot): _retrieve(sl.index))
		s.dropped.connect(_on_dropped)
		s.size_flags_horizontal = Control.SIZE_EXPAND | Control.SIZE_SHRINK_CENTER
		_grid.add_child(s)
		slots.append(s)
	_set_visible_rows(MIN_ROWS)
	_gold = UiStyle.label("Bank: 0   Carried: 0", 15, Color(1, 0.85, 0.3))
	content.add_child(_gold)
	# Buttons wrap onto a second line rather than widening the narrow window.
	var h := HFlowContainer.new()
	h.add_theme_constant_override("h_separation", 6)
	h.add_theme_constant_override("v_separation", 6)
	content.add_child(h)
	h.add_child(UiStyle.button("Withdraw gold", func(): actions.transfer_gold(true)))
	h.add_child(UiStyle.button("Deposit gold", func(): actions.transfer_gold(false)))
	h.add_child(UiStyle.button("STORE ITEMS", func():
		inventory_window.open_mode(ItemActions.Mode.BANK, self)
		close()))
	var hint := UiStyle.label("Click an item twice (or double click / drag it to the inventory) to take it out.", 11, Color(1, 1, 1, 0.7))
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(hint)
	# While closed, report the compact size: the HUD picks the mobile UI scale
	# from every window's minimum size (hud.gd fit_ui_scale_to_screen()), and
	# the bank shrinks to fit anyway.
	closed.connect(func(): _set_visible_rows(MIN_ROWS))


func _total_rows() -> int:
	return ceili(float(PlayerData.BANK_SIZE) / COLUMNS)


## Height of one slot row plus its gap, in HUD units.
func _row_height() -> float:
	return (_grid.get_combined_minimum_size().y + SLOT_SEP) / _total_rows()


func _set_visible_rows(n: int) -> void:
	var g := _grid.get_combined_minimum_size()
	_scroll.custom_minimum_size = Vector2(g.x + SCROLLBAR_WIDTH, n * _row_height() - SLOT_SEP)


## Show as many whole rows as fit in the window's height limit (MAX_SIZE, or
## less on a small screen -- landscape phones and any UI scale included, see
## GameWindow.max_size()), the rest scroll.
func _place() -> void:
	if _scroll:
		var others := _content_root.get_combined_minimum_size().y - _scroll.get_combined_minimum_size().y
		var row_h := _row_height()
		var avail := content_limit().y - others
		_set_visible_rows(clampi(floori((avail + SLOT_SEP) / row_h), 1, _total_rows()))
	super._place()


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	data = d
	actions = a
	inventory_window = inv
	d.bank_changed.connect(refresh)
	d.gold_changed.connect(refresh)


func refresh() -> void:
	if data == null:
		return
	_select(-1)
	for i in range(slots.size()):
		var s: ItemSlot = slots[i]
		var r = data.bank[i]
		if r == null:
			s.clear()
		else:
			s.set_item(ItemTypes.icon(int(r.kind)), ItemTypes.slot_label(r), ItemTypes.durability_percent(r))
			s.tooltip_text = ItemTypes.info_text(r)
			s.payload = r
	_gold.text = "Bank: %s   Carried: %s" % [ItemTypes.short_number(int(data.gold[1])), ItemTypes.short_number(int(data.gold[0]))]


func _select(i: int) -> void:
	if selected >= 0:
		slots[selected].set_selected(false)
	selected = i
	if i >= 0:
		slots[i].set_selected(true)


func _on_pressed(s: ItemSlot) -> void:
	if data.bank[s.index] == null:
		_select(-1)
		return
	if selected == s.index:
		_select(-1)
		_retrieve(s.index)
	else:
		_select(s.index)


func _retrieve(i: int) -> void:
	actions.retrieve_from_bank(i)


func _on_dropped(s: ItemSlot, d: Dictionary) -> void:
	var t := int(d.store)
	if t == PlayerData.Store.EQUIPMENT:
		return
	actions.move_item(t, int(d.slot), PlayerData.Store.BANK, s.index)
