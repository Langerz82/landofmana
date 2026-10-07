class_name TouchJoystick
extends Control
## On-screen joystick for touch screens (settings "Joystick", the JS client
## used virtualjoystick.js). Emits the 4-way direction the stick points to.

signal direction_changed(o: int)

var radius := 60.0
var _touch := -1
var _center := Vector2.ZERO
var _knob := Vector2.ZERO
var _dir := 0


func _ready() -> void:
	custom_minimum_size = Vector2(radius * 2 + 20, radius * 2 + 20)
	mouse_filter = Control.MOUSE_FILTER_STOP


func _draw() -> void:
	var c := size / 2.0
	draw_circle(c, radius, Color(1, 1, 1, 0.12))
	draw_arc(c, radius, 0, TAU, 48, Color(1, 1, 1, 0.5), 2.0)
	draw_circle(c + _knob, radius * 0.4, Color(1, 1, 1, 0.35))


func _gui_input(e: InputEvent) -> void:
	var pos := Vector2.ZERO
	var down := false
	var up := false
	if e is InputEventScreenTouch:
		pos = e.position
		down = e.pressed
		up = not e.pressed
	elif e is InputEventScreenDrag:
		pos = e.position
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		pos = e.position
		down = e.pressed
		up = not e.pressed
	elif e is InputEventMouseMotion and _touch >= 0:
		pos = e.position
	else:
		return
	accept_event()
	if down:
		_touch = 0
	if up:
		_touch = -1
		_knob = Vector2.ZERO
		_set_dir(0)
		queue_redraw()
		return
	if _touch < 0:
		return
	var off := pos - size / 2.0
	_knob = off.limit_length(radius)
	queue_redraw()
	if off.length() < radius * 0.3:
		_set_dir(0)
	elif absf(off.x) > absf(off.y):
		_set_dir(Types.Orientation.RIGHT if off.x > 0 else Types.Orientation.LEFT)
	else:
		_set_dir(Types.Orientation.DOWN if off.y > 0 else Types.Orientation.UP)


func _set_dir(o: int) -> void:
	if o != _dir:
		_dir = o
		direction_changed.emit(o)
