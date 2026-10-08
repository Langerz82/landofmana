class_name ItemSlot
extends Control
## One square slot showing an item (or skill / shortcut). Supports click,
## double click, right click, drag & drop and a cooldown overlay.
## Replaces the inventory/bank/equipment/shortcut DOM cells of the JS client.

signal pressed(slot: ItemSlot)
signal activated(slot: ItemSlot)        # double click / Enter / A button
signal secondary(slot: ItemSlot)        # right click / X button
signal dropped(slot: ItemSlot, data: Dictionary)
signal drag_released_outside(slot: ItemSlot)

const SIZE := 52

var store_type := -1      # PlayerData.Store or -1 (shortcut, skill, ...)
var index := -1
var drag_kind := "item"   # what _get_drag_data reports: item / skill / shortcut
var accepts: Array = []   # drag kinds this slot accepts
var draggable := true
var icon: Texture2D = null
var background: Texture2D = null
var count_text := ""
var corner_text := ""     # top-left (durability %, level...)
var selected := false
var dimmed := false
var cooldown_text := ""
var payload = null        # whatever the owner wants to keep here

var _drag_started := false


func _init() -> void:
	custom_minimum_size = Vector2(SIZE, SIZE)
	focus_mode = Control.FOCUS_ALL
	mouse_filter = Control.MOUSE_FILTER_STOP
	if background == null:
		background = UiStyle.slot_background(0, 0)


func set_item(tex: Texture2D, count := "", corner := "") -> void:
	icon = tex
	count_text = count
	corner_text = corner
	queue_redraw()


func clear() -> void:
	set_item(null)
	tooltip_text = ""
	payload = null


func set_selected(v: bool) -> void:
	selected = v
	queue_redraw()


func set_dimmed(v: bool) -> void:
	dimmed = v
	queue_redraw()


func set_cooldown(seconds_left: int) -> void:
	var t := str(seconds_left) if seconds_left > 0 else ""
	if t != cooldown_text:
		cooldown_text = t
		queue_redraw()


func has_content() -> bool:
	return icon != null


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	if background:
		draw_texture_rect(background, r, false)
	else:
		draw_rect(r, Color(0, 0, 0, 0.5))
	if icon:
		var isz := Vector2(44, 44)
		draw_texture_rect(icon, Rect2((size - isz) / 2.0, isz), false)
	var font := get_theme_default_font()
	if corner_text != "":
		draw_string_outline(font, Vector2(3, 12), corner_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, Color.BLACK)
		draw_string(font, Vector2(3, 12), corner_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1, 1, 0))
	if count_text != "":
		var w := font.get_string_size(count_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		var at := Vector2(size.x - w - 3, size.y - 4)
		draw_string_outline(font, at, count_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 3, Color.BLACK)
		draw_string(font, at, count_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
	if dimmed:
		draw_rect(r, Color(0, 0, 0, 0.47))
	if cooldown_text != "":
		draw_rect(r, Color(1, 0, 0, 0.47))
		var w2 := font.get_string_size(cooldown_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
		var at2 := Vector2((size.x - w2) / 2, size.y / 2 + 7)
		draw_string_outline(font, at2, cooldown_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 4, Color.BLACK)
		draw_string(font, at2, cooldown_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color.WHITE)
	if selected:
		draw_rect(r.grow(-1), Color.WHITE, false, 3.0)
	elif has_focus():
		draw_rect(r.grow(-1), Color(0.3, 0.5, 1), false, 3.0)


func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_LEFT:
			if e.double_click:
				activated.emit(self)
			else:
				pressed.emit(self)
			accept_event()
		elif e.button_index == MOUSE_BUTTON_RIGHT:
			secondary.emit(self)
			accept_event()
	elif e.is_action_pressed("ui_accept"):
		pressed.emit(self)
		accept_event()
	elif e is InputEventJoypadButton and e.pressed and e.button_index == JOY_BUTTON_X:
		secondary.emit(self)
		accept_event()


func _notification(what: int) -> void:
	if what == NOTIFICATION_FOCUS_ENTER or what == NOTIFICATION_FOCUS_EXIT:
		queue_redraw()
	elif what == NOTIFICATION_DRAG_END and _drag_started:
		_drag_started = false
		if not get_viewport().gui_is_drag_successful():
			drag_released_outside.emit(self)


func _get_drag_data(_at: Vector2) -> Variant:
	if not draggable or icon == null:
		return null
	_drag_started = true
	var preview := TextureRect.new()
	preview.texture = icon
	preview.custom_minimum_size = Vector2(44, 44)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.modulate = Color(1, 1, 1, 0.8)
	var c := Control.new()
	c.add_child(preview)
	preview.position = -Vector2(22, 22)
	set_drag_preview(c)
	return {"drag": drag_kind, "store": store_type, "slot": index, "source": self, "payload": payload}


func _can_drop_data(_at: Vector2, data: Variant) -> bool:
	return data is Dictionary and accepts.has(data.get("drag", "")) and data.get("source") != self


func _drop_data(_at: Vector2, data: Variant) -> void:
	dropped.emit(self, data)
