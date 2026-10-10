class_name GameWindow
extends PanelContainer
## Base for the in-game windows (dialog/dialog.js + the HTML ".frame"
## markup): a title bar you can drag, a close button and a content box.

signal opened
signal closed

var title := ""
var content: VBoxContainer
var _title_label: Label
var _title_bar: PanelContainer
var _dragging := false
var _drag_offset := Vector2.ZERO
var _placed := false
var hud = null
var world = null


func _init(t := "", min_size := Vector2(300, 200)) -> void:
	title = t
	custom_minimum_size = min_size
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP


func _ready() -> void:
	add_theme_stylebox_override("panel", UiStyle.panel())
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	add_child(v)
	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", UiStyle.title_bar())
	_title_bar = bar
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	bar.gui_input.connect(_on_bar_input)
	v.add_child(bar)
	var h := HBoxContainer.new()
	bar.add_child(h)
	_title_label = UiStyle.label(title, 16, Color.WHITE, UiStyle.KOMIKA)
	_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(_title_label)
	var x := Button.new()
	x.text = " X "
	x.focus_mode = Control.FOCUS_NONE
	UiStyle.style_button(x)
	x.pressed.connect(close)
	h.add_child(x)
	content = VBoxContainer.new()
	content.add_theme_constant_override("separation", 6)
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(content)
	build()


## Re-apply the title bar colour (Settings -> Menu color).
func restyle_title() -> void:
	if _title_bar:
		_title_bar.add_theme_stylebox_override("panel", UiStyle.title_bar())


## Override to add controls to `content`.
func build() -> void:
	pass


## Override to refresh contents when shown.
func refresh() -> void:
	pass


func set_title(t: String) -> void:
	title = t
	if _title_label:
		_title_label.text = t


func open() -> void:
	visible = true
	move_to_front()
	refresh()
	_place.call_deferred()
	_focus_first()
	opened.emit()


## Centre the window the first time it opens (once its contents exist), and
## keep it on screen above the shortcut bar afterwards.
func _place() -> void:
	reset_size()
	var vp := get_parent_area_size()   # HUD units (the HUD may be scaled)
	var bottom_margin := 70.0
	if not _placed:
		_placed = true
		position = ((vp - Vector2(0, bottom_margin) - size) / 2.0).round()
	position.x = clampf(position.x, 0, maxf(0, vp.x - size.x))
	position.y = clampf(position.y, 0, maxf(0, vp.y - bottom_margin - size.y))


func close() -> void:
	if not visible:
		return
	visible = false
	closed.emit()


func toggle() -> void:
	if visible:
		close()
	else:
		open()


func _focus_first() -> void:
	# Gamepad navigation (gamepad.js selectFirstItem): focus the first button.
	var f := _find_focusable(content)
	if f:
		f.grab_focus.call_deferred()


func _find_focusable(n: Node) -> Control:
	for c in n.get_children():
		if c is Control and c.visible:
			if c.focus_mode == Control.FOCUS_ALL and (c is BaseButton or c is ItemSlot):
				return c
			var r := _find_focusable(c)
			if r:
				return r
	return null


func _on_bar_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		_dragging = e.pressed
		_drag_offset = _to_parent(e.global_position) - position
		if e.pressed:
			move_to_front()
	elif e is InputEventMouseMotion and _dragging:
		var vp := get_parent_area_size()
		var p := _to_parent(e.global_position) - _drag_offset
		position = Vector2(clampf(p.x, -size.x + 60, vp.x - 60), clampf(p.y, 0, vp.y - 30))


## A screen (viewport) position in the parent's coordinates, so dragging
## follows the pointer 1:1 with a scaled HUD.
func _to_parent(screen_pos: Vector2) -> Vector2:
	var pc := get_parent_control()
	return pc.get_global_transform_with_canvas().affine_inverse() * screen_pos if pc else screen_pos


func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		move_to_front()


func _unhandled_input(e: InputEvent) -> void:
	if visible and (e.is_action_pressed("ui_cancel")) and has_focus_inside():
		close()
		get_viewport().set_input_as_handled()


func has_focus_inside() -> bool:
	var f := get_viewport().gui_get_focus_owner()
	return f != null and is_ancestor_of(f)


## Small helper: HBox row of buttons.
func button_row(buttons: Array) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	for b in buttons:
		h.add_child(b)
	return h
