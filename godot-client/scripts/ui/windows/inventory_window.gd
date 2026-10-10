class_name InventoryWindow
extends GameWindow
## Equipment + inventory (inventorydialog/*.js, equipmenthandler.js). The
## same window is reused by the shops in their "modes" (sell, enchant,
## repair, bank, auction) exactly like the JS client.

const EQUIP_BG := [Vector2i(1, 0), Vector2i(1, 1), Vector2i(0, 1), Vector2i(1, 2), Vector2i(2, 2)]
const EQUIP_NAMES := ["Helm", "Chest", "Gloves", "Boots", "Weapon"]
const MODE_TEXT := {0: "DROP", 1: "SELL", 2: "REPAIR", 3: "ENCHANT", 4: "BANK", 5: "LIST"}

var data: PlayerData
var actions: ItemActions
var equip_slots: Array = []
var inv_slots: Array = []
var sel_type := -1
var sel_slot := -1
var select_time := 0      # ms tick of the last selection (shortcut assignment picks the newest)
var back_window: GameWindow = null   # reopened when this closes (inventoryDialog.backPage)
var _gold: Label
var _gems: Label
var _price: Label
var _action: Button
var _mode_label: Label
var _info: Label


func _init() -> void:
	super._init("EQUIPMENT", Vector2(560, 0))


func build() -> void:
	var eh := HBoxContainer.new()
	eh.add_theme_constant_override("separation", 6)
	content.add_child(eh)
	eh.add_child(UiStyle.label("Equipped:", 13))
	for i in range(PlayerData.EQUIPMENT_SIZE):
		var s := _make_slot(PlayerData.Store.EQUIPMENT, i)
		s.background = UiStyle.slot_background(EQUIP_BG[i].x, EQUIP_BG[i].y)
		s.tooltip_text = EQUIP_NAMES[i]
		eh.add_child(s)
		equip_slots.append(s)
	_mode_label = UiStyle.label("", 13, Color(1, 0.85, 0.3))
	_mode_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_mode_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	eh.add_child(_mode_label)
	var grid := GridContainer.new()
	grid.columns = 10
	grid.add_theme_constant_override("h_separation", 2)
	grid.add_theme_constant_override("v_separation", 2)
	content.add_child(grid)
	for i in range(PlayerData.INVENTORY_SIZE):
		var s := _make_slot(PlayerData.Store.INVENTORY, i)
		grid.add_child(s)
		inv_slots.append(s)
	_info = UiStyle.label("", 12, Color(0.85, 0.85, 1))
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_info.custom_minimum_size = Vector2(500, 0)
	content.add_child(_info)
	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 12)
	content.add_child(bottom)
	var gold_btn := Button.new()
	gold_btn.flat = true
	gold_btn.tooltip_text = "In bank mode: click to move gold to the bank"
	gold_btn.pressed.connect(func():
		if actions.mode == ItemActions.Mode.BANK:
			actions.transfer_gold(false))
	_gold = UiStyle.label("Gold: 0", 14, Color(1, 0.85, 0.3))
	gold_btn.add_child(_gold)
	gold_btn.custom_minimum_size = Vector2(130, 24)
	bottom.add_child(gold_btn)
	_gems = UiStyle.label("Gems: 0", 14, Color(0.6, 1, 1))
	bottom.add_child(_gems)
	_price = UiStyle.label("", 14, Color(1, 1, 0.5))
	_price.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_price.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	bottom.add_child(_price)
	_action = UiStyle.button("DROP", _on_action_pressed, 100)
	_action.visible = false
	bottom.add_child(_action)


func bind(d: PlayerData, a: ItemActions) -> void:
	data = d
	actions = a
	d.inventory_changed.connect(_refresh_inventory)
	d.equipment_changed.connect(_refresh_equipment)
	d.gold_changed.connect(_refresh_gold)
	a.mode_changed.connect(func(_m): refresh())


func _make_slot(t: int, i: int) -> ItemSlot:
	var s := ItemSlot.new()
	s.store_type = t
	s.index = i
	s.accepts = ["item"]
	s.pressed.connect(_on_slot_pressed)
	s.activated.connect(_on_slot_activated)
	s.secondary.connect(_on_slot_activated)
	s.dropped.connect(_on_slot_dropped)
	s.drag_released_outside.connect(_on_drag_outside)
	return s


func _on_slot_activated(slot: ItemSlot) -> void:
	_deselect()
	actions.activate_item(slot.store_type, slot.index)


func refresh() -> void:
	if data == null:
		return
	_mode_label.text = "" if actions.mode == ItemActions.Mode.NORMAL else "Mode: " + str(MODE_TEXT.get(actions.mode, ""))
	_deselect()
	_refresh_inventory()
	_refresh_equipment()
	_refresh_gold()


func _fill(s: ItemSlot, r) -> void:
	if r == null:
		s.clear()
		s.set_dimmed(false)
		return
	var kind := int(r.kind)
	s.set_item(ItemTypes.icon(kind), ItemTypes.slot_label(r), ItemTypes.durability_percent(r))
	s.tooltip_text = ItemTypes.info_text(r)
	s.payload = r
	s.set_dimmed(actions.mode != ItemActions.Mode.NORMAL and not actions.selectable_in_mode(r))


func _refresh_inventory() -> void:
	for i in range(inv_slots.size()):
		_fill(inv_slots[i], data.inventory[i])
	_update_cooldowns()


func _refresh_equipment() -> void:
	for i in range(equip_slots.size()):
		_fill(equip_slots[i], data.equipment[i])


func _refresh_gold() -> void:
	_gold.text = "Gold: " + ItemTypes.short_number(int(data.gold[0]))
	_gems.text = "Gems: %d" % data.gems


func _process(_d: float) -> void:
	if visible:
		_update_cooldowns()


func _update_cooldowns() -> void:
	var left := int(ceil(actions.item_cooldown_left() / 1000.0)) if actions else 0
	for s in inv_slots:
		var r = s.payload
		s.set_cooldown(left if (r != null and ItemTypes.is_consumable(int(r.kind))) else 0)


# ------------------------------------------------------------ selection

func _slot_ctrl(t: int, i: int) -> ItemSlot:
	if i < 0:
		return null
	if t == PlayerData.Store.EQUIPMENT:
		return equip_slots[i] if i < equip_slots.size() else null
	return inv_slots[i] if i < inv_slots.size() else null


func _deselect() -> void:
	var s := _slot_ctrl(sel_type, sel_slot)
	if s:
		s.set_selected(false)
	sel_type = -1
	sel_slot = -1
	if _action:
		_action.visible = false
		_price.text = ""
		_info.text = ""


func _select(t: int, i: int) -> void:
	_deselect()
	sel_type = t
	sel_slot = i
	select_time = Time.get_ticks_msec()
	var s := _slot_ctrl(t, i)
	s.set_selected(true)
	var r = data.get_room(t, i)
	_info.text = ItemTypes.info_text(r) if r != null else ""
	var price := actions.mode_price(t, i)
	_price.text = ("Price: %d" % price) if price >= 0 else ""
	_action.text = str(MODE_TEXT.get(actions.mode, "DROP"))
	_action.visible = not (actions.mode == ItemActions.Mode.NORMAL and t == PlayerData.Store.EQUIPMENT)


## The selected inventory item, for "click an item, then a shortcut slot".
## Returns {type: 1, id: kind} for a consumable, {} otherwise.
func shortcut_pick() -> Dictionary:
	if not visible or actions.mode != ItemActions.Mode.NORMAL or sel_type != PlayerData.Store.INVENTORY or sel_slot < 0:
		return {}
	var r = data.get_room(sel_type, sel_slot)
	if r == null:
		return {}
	return {"type": 1, "id": int(r.kind), "consumable": ItemTypes.is_consumable(int(r.kind))}


func clear_shortcut_pick() -> void:
	_deselect()


## InventoryDialog click logic: first click selects, clicking the selected
## item again activates it, clicking another slot moves/swaps.
func _on_slot_pressed(s: ItemSlot) -> void:
	var r = data.get_room(s.store_type, s.index)
	if sel_slot < 0:
		if r != null and actions.selectable_in_mode(r):
			_select(s.store_type, s.index)
		return
	if s.store_type == sel_type and s.index == sel_slot:
		var t := sel_type
		var i := sel_slot
		_deselect()
		actions.activate_item(t, i)
		return
	var st := sel_type
	var ss := sel_slot
	_deselect()
	if actions.mode != ItemActions.Mode.NORMAL:
		if r != null and actions.selectable_in_mode(r):
			_select(s.store_type, s.index)
		return
	_move(st, ss, s.store_type, s.index)


func _move(src_t: int, src_i: int, dst_t: int, dst_i: int) -> void:
	var r = data.get_room(src_t, src_i)
	if r == null:
		return
	if dst_t == PlayerData.Store.EQUIPMENT:
		if src_t != PlayerData.Store.EQUIPMENT and ItemTypes.is_equippable(int(r.kind)):
			actions.use_item(src_t, src_i)
		return
	if src_t == PlayerData.Store.EQUIPMENT:
		actions.client().send_item_slot([1, 2, src_i, 0, dst_t, dst_i])
		return
	actions.move_item(src_t, src_i, dst_t, dst_i)


func _on_slot_dropped(s: ItemSlot, d: Dictionary) -> void:
	_deselect()
	_move(int(d.store), int(d.slot), s.store_type, s.index)


func _on_drag_outside(s: ItemSlot) -> void:
	# Dropping an item on the game world drops it on the ground.
	if actions.mode != ItemActions.Mode.NORMAL or s.store_type != PlayerData.Store.INVENTORY:
		return
	if hud and hud.is_pointer_over_ui():
		return
	actions.drop_item(s.store_type, s.index)


func _on_action_pressed() -> void:
	if sel_slot < 0:
		return
	var t := sel_type
	var i := sel_slot
	_deselect()
	actions.activate_item(t, i, true)


func close() -> void:
	var was_visible := visible
	super.close()
	if not was_visible:
		return
	if actions and actions.mode != ItemActions.Mode.NORMAL:
		actions.set_mode(ItemActions.Mode.NORMAL)
	if back_window:
		var b := back_window
		back_window = null
		b.open()


## Opens the inventory in a shop mode (store/bank/auction "SELL"/"STORE" buttons).
func open_mode(m: int, back: GameWindow = null) -> void:
	actions.set_mode(m)
	back_window = back
	open()
