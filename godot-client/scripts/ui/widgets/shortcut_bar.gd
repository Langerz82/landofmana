class_name ShortcutBar
extends PanelContainer
## Shortcut bar (shortcut/*.js): six slots for consumables (type 1) and
## skills (type 2), keys 1-6, cooldown display, drag to install/swap, plus
## the attack button (#attack-shortcut).

var data: PlayerData
var actions: ItemActions
var world = null
var slots: Array = []
var _box: BoxContainer
var _attack: Button
var style := "horizontal-asc"


func _ready() -> void:
	add_theme_stylebox_override("panel", UiStyle.panel(0.6))
	mouse_filter = Control.MOUSE_FILTER_STOP
	_rebuild_box()


func _rebuild_box() -> void:
	if _box:
		for c in _box.get_children():
			_box.remove_child(c)
		_box.queue_free()
	_box = VBoxContainer.new() if style.begins_with("vertical") else HBoxContainer.new()
	_box.add_theme_constant_override("separation", 4)
	add_child(_box)
	if slots.is_empty():
		for i in range(PlayerData.SHORTCUT_COUNT):
			var s := ItemSlot.new()
			s.index = i
			s.drag_kind = "shortcut"
			s.key_label = str(i + 1)
			s.accepts = ["item", "skill", "shortcut"]
			s.focus_mode = Control.FOCUS_NONE
			s.pressed.connect(_on_slot_pressed)
			s.secondary.connect(func(sl: ItemSlot): actions.install_shortcut(sl.index, 0, -1))
			s.dropped.connect(_on_dropped)
			s.tooltip_text = "Shortcut %d (key %d). Select a skill or potion and click here (or drag it here); right click to clear." % [i + 1, i + 1]
			slots.append(s)
		_attack = UiStyle.button("ATK", func(): world.make_player_interact_next_to())
		_attack.custom_minimum_size = Vector2(52, 52)
		_attack.focus_mode = Control.FOCUS_NONE
		_attack.tooltip_text = "Attack / interact (Space)"
	var order: Array = []
	order.append(_attack)
	order.append_array(slots)
	if style.ends_with("desc"):
		order.reverse()
	for c in order:
		_box.add_child(c)


func bind(w, d: PlayerData, a: ItemActions) -> void:
	world = w
	data = d
	actions = a
	d.shortcuts_changed.connect(refresh)
	d.skills_changed.connect(refresh)
	refresh()


func set_style(s: String) -> void:
	style = s
	_rebuild_box()
	reset_size()


func refresh() -> void:
	if data == null:
		return
	for i in range(slots.size()):
		var s: ItemSlot = slots[i]
		var sc: Dictionary = data.shortcuts[i]
		var t := int(sc.type)
		var id := int(sc.id)
		if t == 1 and id > 0:
			var n := data.item_total_count(id)
			s.set_item(ItemTypes.icon(id), str(n))
			s.set_dimmed(n == 0)
			s.payload = {"type": t, "id": id}
		elif t == 2 and id >= 0:
			s.set_item(ItemTypes.skill_icon(id), "")
			s.set_dimmed(data.skill_level_of(id) <= 0)
			s.payload = {"type": t, "id": id}
		else:
			s.clear()
			s.set_dimmed(false)


func _process(_d: float) -> void:
	if actions == null:
		return
	for i in range(slots.size()):
		var sc: Dictionary = data.shortcuts[i]
		slots[i].set_cooldown(int(ceil(actions.cooldown_left(int(sc.type), int(sc.id)) / 1000.0)))


## Click a skill in the skills window or an item in the inventory, then a
## shortcut slot: the slot gets that skill / item type. Otherwise the click
## runs the shortcut.
func _on_slot_pressed(s: ItemSlot) -> void:
	var hud = world.hud if world else null
	if hud and hud.has_method("take_shortcut_pick"):
		var pick: Dictionary = hud.take_shortcut_pick()
		if not pick.is_empty():
			if pick.get("consumable", true):
				actions.install_shortcut(s.index, int(pick.type), int(pick.id))
			else:
				hud.add_notification("Only potions and food can go on the shortcut bar.")
			return
	actions.exec_shortcut(s.index)


func _on_dropped(s: ItemSlot, d: Dictionary) -> void:
	match str(d.drag):
		"item":
			var r = data.get_room(int(d.store), int(d.slot))
			if r != null and int(d.store) == 0 and ItemTypes.is_consumable(int(r.kind)):
				actions.install_shortcut(s.index, 1, int(r.kind))
		"skill":
			actions.install_shortcut(s.index, 2, int(d.slot))
		"shortcut":
			actions.swap_shortcuts(int(d.slot), s.index)
